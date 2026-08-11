/**
 * Criação e resolução dos grupos de WhatsApp de um projeto.
 *
 * Três públicos, um grupo cada: cliente, equipe de instalação e homologação.
 * O JID devolvido na criação fica em whatsapp_groups e é a identidade permanente
 * do grupo — nunca procuramos grupo por nome.
 *
 * Fixos da Solo em todo grupo: o número conectado (entra sozinho, é o dono) mais
 * os administradores de WHATSAPP_ADMIN_PHONES.
 */
import { db } from "@workspace/db";
import {
  projectsTable,
  plantsTable,
  servicesTable,
  installerAccountsTable,
  homologacaoTechniciansTable,
  whatsappGroupsTable,
  type WhatsappGroup,
  type WhatsappGroupKind,
  type WhatsappGroupParticipant,
} from "@workspace/db/schema";
import { eq, and, ne, desc } from "drizzle-orm";
import { logger } from "./logger";
import { GRUPO_AVATAR_JPEG_BASE64 } from "./grupo-avatar";
import { buildGroupSubject, buildGroupSubjectFull, pontuarGrupo } from "./whatsapp-subject";
import {
  createGroup,
  fetchAllGroups,
  getInviteCode,
  isPlausibleBrazilianPhone,
  normalizeGroupJid,
  normalizePhone,
  resolveJids,
  updateGroupDescription,
  updateGroupPicture,
} from "./whatsmiau";

export { buildGroupSubject, buildGroupSubjectFull, pontuarGrupo };

// ─── Participantes ────────────────────────────────────────────────────────────

export interface ParticipanteResolvido {
  phone: string;
  papel: string;
}

/**
 * Administradores da Solo que entram em todo grupo, de WHATSAPP_ADMIN_PHONES
 * ("5585996487923:Mateus,5585999289511:Gabriel" — o rótulo após `:` é opcional).
 *
 * O número conectado não vai na lista: ele é o dono do grupo e entra sozinho.
 */
export function adminParticipants(): ParticipanteResolvido[] {
  const raw = process.env.WHATSAPP_ADMIN_PHONES;
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [phone, papel] = entry.split(":");
      return { phone: phone.trim(), papel: papel?.trim() || "Solo" };
    })
    .filter((p) => {
      if (isPlausibleBrazilianPhone(p.phone)) return true;
      logger.error({ phone: p.phone }, "WHATSAPP_ADMIN_PHONES tem número inválido — ignorado");
      return false;
    });
}

/** Quem entra no grupo, por público. Números inválidos ou ausentes são descartados. */
export async function resolveParticipants(
  projectId: number,
  kind: WhatsappGroupKind,
): Promise<{ participantes: ParticipanteResolvido[]; avisos: string[] }> {
  const avisos: string[] = [];
  const participantes = [...adminParticipants()];
  if (participantes.length === 0) {
    avisos.push("WHATSAPP_ADMIN_PHONES não configurado — o grupo sai só com o número da Solo.");
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) throw new Error("Projeto não encontrado");

  if (kind === "cliente") {
    if (project.clientPhone && isPlausibleBrazilianPhone(project.clientPhone)) {
      participantes.push({ phone: project.clientPhone, papel: "Cliente" });
    } else {
      avisos.push(
        project.clientPhone
          ? `Telefone do cliente inválido (${project.clientPhone}) — o grupo será criado sem ele.`
          : "Projeto sem telefone do cliente — o grupo será criado sem ele.",
      );
    }
  }

  if (kind === "instalacao") {
    // Equipe do serviço de instalação mais recente do projeto.
    const [servico] = await db
      .select({ equipe: servicesTable.equipeExecucao })
      .from(servicesTable)
      .where(and(eq(servicesTable.projectId, projectId), ne(servicesTable.status, "Cancelado")))
      .orderBy(desc(servicesTable.id))
      .limit(1);
    const equipe = servico?.equipe;
    if (!equipe) {
      avisos.push("Nenhum serviço com equipe designada — o grupo sai só com a Solo.");
    } else {
      const [conta] = await db
        .select({
          nome: installerAccountsTable.name,
          telefone: installerAccountsTable.responsavelTelefone,
        })
        .from(installerAccountsTable)
        .where(eq(installerAccountsTable.teamName, equipe))
        .limit(1);
      if (conta?.telefone && isPlausibleBrazilianPhone(conta.telefone)) {
        participantes.push({ phone: conta.telefone, papel: `Equipe ${conta.nome}` });
      } else {
        avisos.push(`Equipe "${equipe}" está sem telefone do responsável cadastrado.`);
      }
    }
  }

  if (kind === "homologacao") {
    if (project.homologacaoTechnicianId == null) {
      avisos.push("Nenhum técnico de homologação atribuído — o grupo sai só com a Solo.");
    } else {
      const [tecnico] = await db
        .select({
          nome: homologacaoTechniciansTable.name,
          telefone: homologacaoTechniciansTable.phone,
        })
        .from(homologacaoTechniciansTable)
        .where(eq(homologacaoTechniciansTable.id, project.homologacaoTechnicianId));
      if (tecnico?.telefone && isPlausibleBrazilianPhone(tecnico.telefone)) {
        participantes.push({ phone: tecnico.telefone, papel: `Técnico ${tecnico.nome}` });
      } else {
        avisos.push(`Técnico "${tecnico?.nome ?? "?"}" está sem telefone cadastrado.`);
      }
    }
  }

  // Mesmo número em dois papéis (o dono também é admin, p.ex.) quebraria a criação.
  const vistos = new Set<string>();
  const unicos = participantes.filter((p) => {
    const d = normalizePhone(p.phone);
    if (vistos.has(d)) return false;
    vistos.add(d);
    return true;
  });

  return { participantes: unicos, avisos };
}

// ─── Vincular grupo que já existe ─────────────────────────────────────────────
// A Solo já tinha ~50 grupos criados na mão antes do ERP ("Solo | Usina - Tiago
// (6,30 kWp)"). Recriar seria perder o histórico de conversa. Então listamos os
// grupos do número conectado e deixamos apontar qual é o de cada projeto.

export interface GrupoDisponivel {
  jid: string;
  subject: string;
  size: number;
  /** Projeto que já usa este grupo, se houver. */
  vinculadoA: { projectId: number; kind: WhatsappGroupKind } | null;
  /** 0–1: parecença com o nome do cliente. Só vem quando há projeto no pedido. */
  score?: number;
}

/**
 * Grupos do número conectado, marcando os já vinculados e — quando um projeto é
 * informado — ordenados pela parecença com o nome do cliente.
 */
export async function listarGruposDisponiveis(
  clientName?: string,
): Promise<{ grupos: GrupoDisponivel[]; erro?: string }> {
  const res = await fetchAllGroups();
  if (!res.ok) return { grupos: [], erro: res.error };

  const jaVinculados = await db
    .select({
      jid: whatsappGroupsTable.jid,
      projectId: whatsappGroupsTable.projectId,
      kind: whatsappGroupsTable.kind,
    })
    .from(whatsappGroupsTable);
  const porJid = new Map(jaVinculados.map((v) => [v.jid, v]));

  const grupos: GrupoDisponivel[] = res.data.map((g) => {
    const v = porJid.get(g.id);
    return {
      jid: g.id,
      subject: g.subject ?? "(sem nome)",
      size: g.size ?? 0,
      vinculadoA: v ? { projectId: v.projectId, kind: v.kind as WhatsappGroupKind } : null,
      ...(clientName ? { score: pontuarGrupo(g.subject ?? "", clientName) } : {}),
    };
  });

  if (clientName) {
    grupos.sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || a.subject.localeCompare(b.subject));
  } else {
    grupos.sort((a, b) => a.subject.localeCompare(b.subject));
  }
  return { grupos };
}

/**
 * Aponta um grupo existente para o projeto. Não mexe no grupo: não renomeia, não
 * troca a foto, não adiciona ninguém — o grupo já está funcionando e é do
 * cliente, mudar sem pedir seria invasivo.
 */
export async function vincularGrupo(
  projectId: number,
  kind: WhatsappGroupKind,
  jid: string,
): Promise<WhatsappGroup> {
  const res = await fetchAllGroups();
  if (!res.ok) throw new Error(`Não deu para conferir a lista de grupos: ${res.error}`);

  const grupo = res.data.find((g) => g.id === jid);
  if (!grupo) {
    throw new Error("Esse grupo não está na lista do número conectado da Solo");
  }

  const [row] = await db
    .insert(whatsappGroupsTable)
    .values({
      projectId,
      kind,
      jid,
      subject: grupo.subject ?? "(sem nome)",
      subjectFull: grupo.desc || null,
      participants: [],
    })
    .onConflictDoUpdate({
      target: [whatsappGroupsTable.projectId, whatsappGroupsTable.kind],
      set: { jid, subject: grupo.subject ?? "(sem nome)", updatedAt: new Date() },
    })
    .returning();

  logger.info({ projectId, kind, jid, subject: grupo.subject }, "Grupo existente vinculado");
  return row;
}

export async function desvincularGrupo(
  projectId: number,
  kind: WhatsappGroupKind,
): Promise<void> {
  await db
    .delete(whatsappGroupsTable)
    .where(and(eq(whatsappGroupsTable.projectId, projectId), eq(whatsappGroupsTable.kind, kind)));
}

// ─── Criação ──────────────────────────────────────────────────────────────────

export interface EnsureGroupResult {
  group: WhatsappGroup;
  criado: boolean;
  avisos: string[];
}

export async function findGroup(
  projectId: number,
  kind: WhatsappGroupKind,
): Promise<WhatsappGroup | null> {
  const [row] = await db
    .select()
    .from(whatsappGroupsTable)
    .where(and(eq(whatsappGroupsTable.projectId, projectId), eq(whatsappGroupsTable.kind, kind)));
  return row ?? null;
}

/**
 * Cria o grupo se ainda não existir. Idempotente: chamar de novo devolve o grupo
 * já gravado sem tocar no WhatsApp — criar duas vezes deixaria o cliente em dois
 * grupos iguais, sem como saber qual é o bom.
 *
 * Foto e descrição são aplicadas depois da criação; se falharem, o grupo já
 * existe e não pode ser perdido, então viram aviso, não erro.
 */
export async function ensureGroup(
  projectId: number,
  kind: WhatsappGroupKind,
): Promise<EnsureGroupResult> {
  const existente = await findGroup(projectId, kind);
  if (existente) return { group: existente, criado: false, avisos: [] };

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
  if (!project) throw new Error("Projeto não encontrado");

  // A potência da ficha da usina é a real; systemPower é a do fechamento.
  const [plant] = await db
    .select({ potencia: plantsTable.potenciaInstaladaKwp })
    .from(plantsTable)
    .where(eq(plantsTable.projectId, projectId))
    .limit(1);
  const potencia = plant?.potencia ?? project.systemPower ?? null;

  const { participantes, avisos } = await resolveParticipants(projectId, kind);
  const subject = buildGroupSubject(project.clientName, potencia, kind);
  const subjectFull = buildGroupSubjectFull(project.clientName, potencia, kind);

  // O JID real vem do WhatsApp — o número digitado não serve para montar JID.
  const resolvidos = await resolveJids(participantes.map((p) => p.phone));
  const comJid = participantes.flatMap((p) => {
    const r = resolvidos.get(p.phone);
    if (!r?.exists || !r.jid) {
      avisos.push(`${p.papel} (${p.phone}) não tem WhatsApp — ficou de fora do grupo.`);
      return [];
    }
    return [{ ...p, jid: r.jid }];
  });

  if (comJid.length === 0) {
    throw new Error(
      "Nenhum participante válido: o WhatsApp exige ao menos um além do número conectado.",
    );
  }

  const criacao = await createGroup(
    subject,
    comJid.map((p) => p.jid),
    subjectFull,
  );
  if (!criacao.ok) throw new Error(`Falha ao criar o grupo no WhatsApp: ${criacao.error}`);

  const jid = normalizeGroupJid(criacao.data);
  if (!jid) throw new Error("O WhatsApp criou o grupo mas não devolveu o JID — verifique manualmente");

  // A resposta diz quem realmente entrou: error != 0 é privacidade barrando.
  const porJid = new Map(
    (criacao.data.participants ?? []).map((p) => [p.jid ?? "", p.error ?? 0]),
  );
  const gravados: WhatsappGroupParticipant[] = comJid.map((p) => {
    const error = porJid.get(p.jid) ?? 0;
    if (error) {
      avisos.push(
        `${p.papel} (${p.phone}) não pôde ser adicionado — a privacidade do contato bloqueia. Mande o convite pelo link.`,
      );
    }
    return { jid: p.jid, papel: p.papel, ...(error ? { error } : {}) };
  });

  const foto = await updateGroupPicture(jid, GRUPO_AVATAR_JPEG_BASE64);
  if (!foto.ok) avisos.push(`Grupo criado, mas a foto não subiu: ${foto.error}`);

  // A descrição já foi enviada na criação; reforçamos só se o gateway ignorou.
  if (!criacao.data.subject || criacao.data.subject !== subject) {
    const desc = await updateGroupDescription(jid, subjectFull);
    if (!desc.ok) avisos.push(`Descrição não aplicada: ${desc.error}`);
  }

  let inviteUrl: string | null = null;
  const convite = await getInviteCode(jid);
  if (convite.ok) {
    inviteUrl =
      convite.data.inviteUrl ??
      (convite.data.inviteCode ? `https://chat.whatsapp.com/${convite.data.inviteCode}` : null);
  }

  const [group] = await db
    .insert(whatsappGroupsTable)
    .values({ projectId, kind, jid, subject, subjectFull, inviteUrl, participants: gravados })
    .returning();

  logger.info({ projectId, kind, jid, subject }, "Grupo de WhatsApp criado");
  return { group, criado: true, avisos };
}
