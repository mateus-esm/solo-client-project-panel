/**
 * Notificação por WhatsApp direto do ERP.
 *
 * GET  /internal/whatsapp/templates            — catálogo de templates
 * GET  /internal/whatsapp/:projectId/contexto  — destinos + variáveis já preenchidas
 * POST /internal/whatsapp/:projectId/grupos    — cria o grupo do público (idempotente)
 * POST /internal/whatsapp/:projectId/enviar    — envia a mensagem e registra no log
 * GET  /internal/whatsapp/:projectId/historico — o que já foi enviado
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  plantsTable,
  servicesTable,
  projectPurchasesTable,
  homologacaoTechniciansTable,
  whatsappGroupsTable,
  whatsappSendsTable,
  WHATSAPP_GROUP_KINDS,
  WHATSAPP_GROUP_KIND_LABELS,
  type WhatsappGroupKind,
} from "@workspace/db/schema";
import { eq, and, ne, desc, isNotNull } from "drizzle-orm";
import { z } from "zod/v4";
import {
  NOTIFICATION_TEMPLATES,
  TEMPLATE_CATEGORIAS,
  contextDefaults,
  type TemplateContext,
} from "../../lib/whatsapp-templates";
import {
  ensureGroup,
  findGroup,
  listarGruposDisponiveis,
  vincularGrupo,
  desvincularGrupo,
} from "../../lib/whatsapp-groups";
import { isPlausibleBrazilianPhone, isWhatsAppConfigured, sendText } from "../../lib/whatsmiau";

const router: IRouter = Router();

const kindSchema = z.enum(WHATSAPP_GROUP_KINDS);

router.get("/whatsapp/templates", (_req, res) => {
  res.json({ categorias: TEMPLATE_CATEGORIAS, templates: NOTIFICATION_TEMPLATES });
});

// ─── Contexto do projeto ──────────────────────────────────────────────────────

interface Destino {
  id: string;
  tipo: "grupo" | "privado";
  kind: WhatsappGroupKind;
  label: string;
  /** JID de grupo ou telefone normalizável; null quando o destino ainda não existe. */
  jid: string | null;
  detalhe: string;
  /** Grupo ainda não criado: o front oferece o botão de criar. */
  podeCriar: boolean;
}

router.get("/whatsapp/:projectId/contexto", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) {
      res.status(404).json({ message: "Projeto não encontrado" });
      return;
    }

    const [plant] = await db
      .select({
        potencia: plantsTable.potenciaInstaladaKwp,
        concessionaria: plantsTable.concessionaria,
        monitoramento: plantsTable.monitoramentoUrl,
      })
      .from(plantsTable)
      .where(eq(plantsTable.projectId, projectId))
      .limit(1);

    const [servico] = await db
      .select({ equipe: servicesTable.equipeExecucao })
      .from(servicesTable)
      .where(and(eq(servicesTable.projectId, projectId), ne(servicesTable.status, "Cancelado")))
      .orderBy(desc(servicesTable.id))
      .limit(1);

    const [compra] = await db
      .select({
        transportadora: projectPurchasesTable.transportadora,
        rastreio: projectPurchasesTable.codigoRastreio,
      })
      .from(projectPurchasesTable)
      .where(
        and(
          eq(projectPurchasesTable.projectId, projectId),
          isNotNull(projectPurchasesTable.codigoRastreio),
        ),
      )
      .orderBy(desc(projectPurchasesTable.id))
      .limit(1);

    const potencia = plant?.potencia ?? project.systemPower ?? null;
    const contexto: TemplateContext = {
      primeiroNome: project.clientName.split(" ")[0],
      nomeCliente: project.clientName,
      potencia: potencia ? `${potencia} kWp` : "",
      cidadeUf: [project.city, project.state].filter(Boolean).join("/"),
      valorProjeto: formatBRL(project.valorProjeto ?? project.receitaBruta),
      equipe: servico?.equipe ?? "",
      concessionaria: plant?.concessionaria ?? "Enel",
      transportadora: compra?.transportadora ?? project.trackingCarrier ?? "",
      codigoRastreio: compra?.rastreio ?? project.trackingCode ?? "",
      linkPortal: process.env.PORTAL_URL ?? "",
      linkMonitoramento: plant?.monitoramento ?? "",
    };

    const grupos = await db
      .select()
      .from(whatsappGroupsTable)
      .where(eq(whatsappGroupsTable.projectId, projectId));
    const porKind = new Map(grupos.map((g) => [g.kind as WhatsappGroupKind, g]));

    const destinos: Destino[] = [];

    // Privado do cliente — sempre primeiro, é o caminho mais usado.
    const telefoneOk = project.clientPhone && isPlausibleBrazilianPhone(project.clientPhone);
    destinos.push({
      id: "privado:cliente",
      tipo: "privado",
      kind: "cliente",
      label: "Privado do cliente",
      jid: telefoneOk ? project.clientPhone : null,
      detalhe: project.clientPhone
        ? telefoneOk
          ? project.clientPhone
          : `${project.clientPhone} — número inválido`
        : "Projeto sem telefone cadastrado",
      podeCriar: false,
    });

    for (const kind of WHATSAPP_GROUP_KINDS) {
      const g = porKind.get(kind);
      destinos.push({
        id: `grupo:${kind}`,
        tipo: "grupo",
        kind,
        label: WHATSAPP_GROUP_KIND_LABELS[kind],
        jid: g?.jid ?? null,
        detalhe: g ? g.subject : "Grupo ainda não criado",
        podeCriar: !g,
      });
    }

    // Privado da equipe de instalação e do técnico de homologação.
    if (project.homologacaoTechnicianId != null) {
      const [tecnico] = await db
        .select({ nome: homologacaoTechniciansTable.name, telefone: homologacaoTechniciansTable.phone })
        .from(homologacaoTechniciansTable)
        .where(eq(homologacaoTechniciansTable.id, project.homologacaoTechnicianId));
      if (tecnico) {
        const ok = tecnico.telefone && isPlausibleBrazilianPhone(tecnico.telefone);
        destinos.push({
          id: "privado:homologacao",
          tipo: "privado",
          kind: "homologacao",
          label: `Privado — ${tecnico.nome}`,
          jid: ok ? tecnico.telefone : null,
          detalhe: ok ? (tecnico.telefone as string) : "Técnico sem telefone cadastrado",
          podeCriar: false,
        });
      }
    }

    res.json({
      configurado: isWhatsAppConfigured(),
      projeto: {
        id: project.id,
        clientName: project.clientName,
        clientPhone: project.clientPhone,
        potencia,
      },
      contexto: { ...contexto, ...contextDefaults(contexto) },
      destinos,
    });
  } catch (err) {
    req.log.error({ err }, "Falha ao montar contexto de WhatsApp");
    res.status(500).json({ message: "Internal server error" });
  }
});

function formatBRL(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ─── Grupos ───────────────────────────────────────────────────────────────────

router.post("/whatsapp/:projectId/grupos", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const parsed = z.object({ kind: kindSchema }).safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Público inválido", errors: parsed.error.issues });
      return;
    }
    if (!isWhatsAppConfigured()) {
      res.status(503).json({ message: "WhatsApp não configurado no servidor" });
      return;
    }

    const { group, criado, avisos } = await ensureGroup(projectId, parsed.data.kind);
    res.status(criado ? 201 : 200).json({ group, criado, avisos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    req.log.error({ err }, "Falha ao criar grupo de WhatsApp");
    res.status(502).json({ message: msg });
  }
});

router.get("/whatsapp/:projectId/grupos", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const rows = await db
      .select()
      .from(whatsappGroupsTable)
      .where(eq(whatsappGroupsTable.projectId, projectId));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Falha ao listar grupos de WhatsApp");
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * Grupos que já existem no WhatsApp da Solo, para apontar qual é o do projeto.
 * Com ?projectId, vêm ordenados pela parecença com o nome do cliente.
 */
router.get("/whatsapp/grupos-disponiveis", async (req, res) => {
  try {
    if (!isWhatsAppConfigured()) {
      res.status(503).json({ message: "WhatsApp não configurado no servidor" });
      return;
    }
    let clientName: string | undefined;
    const projectId = req.query.projectId ? parseInt(String(req.query.projectId), 10) : NaN;
    if (Number.isFinite(projectId)) {
      const [p] = await db
        .select({ name: projectsTable.clientName })
        .from(projectsTable)
        .where(eq(projectsTable.id, projectId));
      clientName = p?.name;
    }
    const { grupos, erro } = await listarGruposDisponiveis(clientName);
    if (erro) {
      res.status(502).json({ message: `Não deu para listar os grupos: ${erro}` });
      return;
    }
    res.json({ grupos, clientName: clientName ?? null });
  } catch (err) {
    req.log.error({ err }, "Falha ao listar grupos disponíveis");
    res.status(500).json({ message: "Internal server error" });
  }
});

/** Aponta um grupo que já existe para o projeto, sem alterar nada no grupo. */
router.post("/whatsapp/:projectId/grupos/vincular", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const parsed = z
      .object({ kind: kindSchema, jid: z.string().endsWith("@g.us") })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const group = await vincularGrupo(projectId, parsed.data.kind, parsed.data.jid);
    res.status(201).json({ group });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    req.log.error({ err }, "Falha ao vincular grupo");
    res.status(502).json({ message: msg });
  }
});

/** Solta o vínculo. O grupo continua existindo no WhatsApp, intacto. */
router.delete("/whatsapp/:projectId/grupos/:kind", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const parsed = kindSchema.safeParse(req.params.kind);
    if (!parsed.success) {
      res.status(400).json({ message: "Público inválido" });
      return;
    }
    await desvincularGrupo(projectId, parsed.data);
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Falha ao desvincular grupo");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Envio ────────────────────────────────────────────────────────────────────

const enviarSchema = z.object({
  destinoId: z.string().min(1),
  /** Texto final, já editado pelo operador — é ele que vai para o WhatsApp. */
  texto: z.string().min(1).max(4096),
  templateCode: z.string().optional(),
  /** Cria o grupo na hora se o destino for um grupo que ainda não existe. */
  criarGrupoSeNecessario: z.boolean().default(false),
});

router.post("/whatsapp/:projectId/enviar", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const parsed = enviarSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    if (!isWhatsAppConfigured()) {
      res.status(503).json({ message: "WhatsApp não configurado no servidor" });
      return;
    }
    const { destinoId, texto, templateCode, criarGrupoSeNecessario } = parsed.data;

    const [tipo, kindRaw] = destinoId.split(":");
    const kindParsed = kindSchema.safeParse(kindRaw);
    if ((tipo !== "grupo" && tipo !== "privado") || !kindParsed.success) {
      res.status(400).json({ message: "Destino inválido" });
      return;
    }
    const kind = kindParsed.data;

    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId));
    if (!project) {
      res.status(404).json({ message: "Projeto não encontrado" });
      return;
    }

    const avisos: string[] = [];
    let target: string | null = null;
    let label = "";

    if (tipo === "grupo") {
      let group = await findGroup(projectId, kind);
      if (!group && criarGrupoSeNecessario) {
        const r = await ensureGroup(projectId, kind);
        group = r.group;
        avisos.push(...r.avisos);
      }
      if (!group) {
        res.status(409).json({ message: "Grupo ainda não criado para este projeto", precisaCriar: true });
        return;
      }
      target = group.jid;
      label = WHATSAPP_GROUP_KIND_LABELS[kind];
    } else if (kind === "cliente") {
      target = project.clientPhone;
      label = "Privado do cliente";
      if (!target) {
        res.status(422).json({ message: "Projeto sem telefone do cliente" });
        return;
      }
    } else if (kind === "homologacao") {
      if (project.homologacaoTechnicianId == null) {
        res.status(422).json({ message: "Nenhum técnico de homologação atribuído" });
        return;
      }
      const [tecnico] = await db
        .select({ nome: homologacaoTechniciansTable.name, telefone: homologacaoTechniciansTable.phone })
        .from(homologacaoTechniciansTable)
        .where(eq(homologacaoTechniciansTable.id, project.homologacaoTechnicianId));
      target = tecnico?.telefone ?? null;
      label = `Privado — ${tecnico?.nome ?? "técnico"}`;
      if (!target) {
        res.status(422).json({ message: "Técnico de homologação sem telefone cadastrado" });
        return;
      }
    } else {
      res.status(400).json({ message: "Envio privado não disponível para este público" });
      return;
    }

    if (tipo === "privado" && !isPlausibleBrazilianPhone(target)) {
      res.status(422).json({ message: `Número inválido: ${target}` });
      return;
    }

    const envio = await sendText(target, texto);

    // O log guarda a falha também: saber que a tentativa existiu evita mandar
    // duas vezes achando que a primeira não saiu.
    const [registro] = await db
      .insert(whatsappSendsTable)
      .values({
        projectId,
        templateCode: templateCode ?? null,
        targetType: tipo,
        targetKind: kind,
        targetJid: target,
        targetLabel: label,
        body: texto,
        status: envio.ok ? "enviado" : "falhou",
        error: envio.ok ? null : envio.error,
        sentBy: "admin",
      })
      .returning();

    if (!envio.ok) {
      res.status(502).json({ message: `Não foi enviado: ${envio.error}`, envio: registro });
      return;
    }
    res.status(201).json({ envio: registro, avisos });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    req.log.error({ err }, "Falha ao enviar WhatsApp");
    res.status(500).json({ message: msg });
  }
});

router.get("/whatsapp/:projectId/historico", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const rows = await db
      .select()
      .from(whatsappSendsTable)
      .where(eq(whatsappSendsTable.projectId, projectId))
      .orderBy(desc(whatsappSendsTable.createdAt))
      .limit(50);
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Falha ao listar histórico de WhatsApp");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
