/**
 * Handoff Vendas → Operação.
 *
 * POST /api/webhooks/sales/deal-won — o negócio ganho no pipeline comercial
 * (Jestor) abre cliente + projeto + usina no ERP, numa transação só.
 *
 * Três decisões que explicam o formato do código abaixo:
 *
 * 1. **Idempotente.** O webhook faz retry. `projects.sales_deal_id` é único e o
 *    reenvio devolve 200 com o projeto que já existe, sem criar nada. Recusar
 *    com 409 encheria o log do Jestor de falha para um comportamento normal.
 * 2. **Silencioso para o cliente.** Quem é avisado é a equipe. Boas-vindas e
 *    grupo de WhatsApp são itens-ação do onboarding — um "ganho!" clicado por
 *    engano não pode virar mensagem no WhatsApp do cliente.
 * 3. **Tolerante na entrada, rígido no dado.** Aceita o corpo do Jestor direto
 *    ou repassado pelo n8n, e todo campo é opcional — mas o que entra no banco
 *    passa pela normalização de `sales-payload`.
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  clientsTable,
  plantsTable,
  defaultSubStage,
  clientStepFor,
} from "@workspace/db/schema";
import { eq, and, isNotNull, sql } from "drizzle-orm";
import { stepCompletionPercent } from "../lib/jestor";
import { sendWhatsApp } from "../lib/notifications";
import { normalizePhone } from "./internal/clients";
import {
  lerNegocioGanho,
  temFichaDeUsina,
  type NegocioGanho,
} from "../lib/sales-payload";

const router: IRouter = Router();

const EVENTO_ESPERADO = "deal_won";

/**
 * Segredo próprio do canal de vendas: revogar o do Jestor de projetos não pode
 * derrubar a entrada de negócios novos. Cai no WEBHOOK_SECRET só se o dedicado
 * não estiver configurado, para a integração não nascer bloqueada.
 */
function autorizado(req: any): boolean {
  const secret = process.env.SALES_WEBHOOK_SECRET ?? process.env.WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const header =
    req.headers["x-webhook-secret"] ??
    String(req.headers["authorization"] ?? "").replace(/^Bearer\s+/i, "");
  // O `token` na query existe porque a automação do Jestor nem sempre permite
  // header customizado; a URL do webhook já é secreta e trafega por HTTPS.
  const query = typeof req.query?.token === "string" ? req.query.token : undefined;

  return header === secret || query === secret;
}

/** A transação que `db.transaction` entrega ao callback. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** CPF/CNPJ só com dígitos — "12.345.678/0001-90" e "12345678000190" são o mesmo. */
function normalizeCpfCnpj(raw: string | null): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  return d.length >= 11 ? d : null;
}

/**
 * Cliente existente ou novo. A chave é o telefone normalizado (decisão do
 * roadmap: é por onde a operação fala com o cliente e é único na prática);
 * CPF/CNPJ é a segunda tentativa e, quando chega, preenche o cadastro.
 */
async function resolverCliente(
  tx: Tx,
  n: NegocioGanho,
): Promise<{ id: number; criado: boolean }> {
  const phoneNormalized = normalizePhone(n.cliente.telefone);
  const cpfCnpj = normalizeCpfCnpj(n.cliente.cpfCnpj);

  let existente: { id: number } | undefined;

  if (phoneNormalized) {
    [existente] = await tx
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(eq(clientsTable.phoneNormalized, phoneNormalized))
      .limit(1);
  }
  if (!existente && cpfCnpj) {
    [existente] = await tx
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(eq(clientsTable.cpfCnpj, cpfCnpj))
      .limit(1);
  }

  if (existente) {
    // Negócio novo de cliente conhecido completa o cadastro sem sobrescrever:
    // o que a equipe já corrigiu no ERP vale mais que o que veio do CRM.
    await tx
      .update(clientsTable)
      .set({
        email: sql`coalesce(${clientsTable.email}, ${n.cliente.email})`,
        cpfCnpj: sql`coalesce(${clientsTable.cpfCnpj}, ${cpfCnpj})`,
        address: sql`coalesce(${clientsTable.address}, ${n.instalacao.endereco})`,
        canalCaptacao: sql`coalesce(${clientsTable.canalCaptacao}, ${n.cliente.canalCaptacao})`,
        soloappId: sql`coalesce(${clientsTable.soloappId}, ${n.cliente.soloappId})`,
        updatedAt: new Date(),
      })
      .where(eq(clientsTable.id, existente.id));
    return { id: existente.id, criado: false };
  }

  const [novo] = await tx
    .insert(clientsTable)
    .values({
      name: n.cliente.nome ?? n.dealName ?? `Negócio ${n.dealId}`,
      phone: n.cliente.telefone,
      phoneNormalized,
      email: n.cliente.email,
      cpfCnpj,
      address: n.instalacao.endereco,
      origem: "sales_engine",
      canalCaptacao: n.cliente.canalCaptacao,
      soloappId: n.cliente.soloappId,
    })
    .returning({ id: clientsTable.id });

  return { id: novo.id, criado: true };
}

function resumoParaEquipe(n: NegocioGanho, projectId: number): string {
  const linhas = [
    "🎉 *Negócio fechado — projeto aberto no ERP*",
    "",
    `*Cliente:* ${n.cliente.nome ?? n.dealName ?? "(sem nome)"}`,
  ];
  if (n.contrato.valor != null) {
    linhas.push(`*Valor:* ${n.contrato.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
  }
  if (n.sistema.potenciaKwp != null) linhas.push(`*Sistema:* ${n.sistema.potenciaKwp} kWp`);
  if (n.instalacao.endereco) linhas.push(`*Local:* ${n.instalacao.endereco}`);
  if (n.consultor.nome) linhas.push(`*Consultor:* ${n.consultor.nome}`);
  if (n.indicacao) linhas.push(`*Indicado por:* ${n.indicacao.nome}`);

  const portal = process.env.PORTAL_URL?.replace(/\/$/, "");
  linhas.push("", `Projeto #${projectId}${portal ? ` — ${portal}/interno/projetos/${projectId}` : ""}`);
  return linhas.join("\n");
}

router.post("/webhooks/sales/deal-won", async (req, res) => {
  if (!autorizado(req)) {
    res.status(401).json({ message: "Unauthorized: invalid webhook secret" });
    return;
  }

  const leitura = lerNegocioGanho(req.body);
  if (!leitura.ok) {
    req.log.warn({ motivo: leitura.motivo }, "Payload de negócio ganho ilegível");
    res.status(400).json({ message: leitura.motivo });
    return;
  }

  const { negocio, data } = leitura;

  // Outro evento da mesma automação não é erro — é assunto alheio. 200 para o
  // Jestor não ficar reenviando o que nunca vamos processar.
  if (negocio.evento != null && negocio.evento !== EVENTO_ESPERADO) {
    res.json({ ignored: true, reason: `Evento "${negocio.evento}" não é ${EVENTO_ESPERADO}` });
    return;
  }

  try {
    const resultado = await db.transaction(async (tx) => {
      const [existente] = await tx
        .select({ id: projectsTable.id, clientId: projectsTable.clientId })
        .from(projectsTable)
        .where(eq(projectsTable.salesDealId, negocio.dealId))
        .limit(1);

      if (existente) return { projectId: existente.id, criado: false, plantId: null as number | null };

      const cliente = await resolverCliente(tx, negocio);

      const stage = "onboarding" as const;
      const subStage = defaultSubStage(stage);
      const step = clientStepFor(stage, subStage) ?? 1;

      const [projeto] = await tx
        .insert(projectsTable)
        .values({
          salesDealId: negocio.dealId,
          salesPayload: data,
          clientId: cliente.id,
          clientName: negocio.cliente.nome ?? negocio.dealName ?? `Negócio ${negocio.dealId}`,
          // clientEmail é NOT NULL e sustenta o login OTP do portal. Sem e-mail
          // real, o endereço inválido sinaliza "sem acesso ao portal" em vez de
          // impedir a abertura do projeto.
          clientEmail: negocio.cliente.email ?? `venda-${negocio.dealId}@sem-email.invalid`,
          clientPhone: negocio.cliente.telefone,
          systemPower: negocio.sistema.potenciaKwp ?? 0,
          stage,
          subStage,
          statusStep: step,
          completionPercent: stepCompletionPercent(step),
          valorProjeto: negocio.contrato.valor,
          formaDePagamento: negocio.contrato.condicoesPagamento,
          observacoesGerais: negocio.contrato.observacoes,
          dataDeFechamento: negocio.contrato.dataFechamento,
          consultorNome: negocio.consultor.nome,
          consultorEmail: negocio.consultor.email,
          consultorTelefone: negocio.consultor.telefone,
          linkProposta: negocio.contrato.linkProposta,
          linkContrato: negocio.contrato.linkContrato,
          comissaoEsperada: negocio.contrato.comissaoEsperada,
          comissaoFixa: negocio.contrato.comissaoFixa,
          indicadoPor: negocio.indicacao?.nome ?? null,
          indicadoPorTelefone: normalizePhone(negocio.indicacao?.telefone ?? null),
        })
        .returning({ id: projectsTable.id });

      let plantId: number | null = null;
      if (temFichaDeUsina(negocio)) {
        const [usina] = await tx
          .insert(plantsTable)
          .values({
            projectId: projeto.id,
            clientId: cliente.id,
            name: negocio.dealName ?? negocio.cliente.nome,
            status: "Em implantação",
            concessionaria: negocio.instalacao.concessionaria,
            enderecoInstalacao: negocio.instalacao.endereco,
            consumoMedioMensal: negocio.instalacao.consumoMedioKwh,
            potenciaInstaladaKwp: negocio.sistema.potenciaKwp,
            moduloFabricante: negocio.sistema.moduloFabricante,
            moduloPotenciaW: negocio.sistema.moduloPotenciaW,
            moduloQuantidade: negocio.sistema.moduloQuantidade,
            inversorFabricante: negocio.sistema.inversorFabricante,
            inversorPotenciaKw: negocio.sistema.inversorPotenciaKw,
            inversorQuantidade: negocio.sistema.inversorQuantidade,
            tipoEstrutura: negocio.sistema.tipoEstrutura,
            tipoMonitoramento: negocio.sistema.tipoMonitoramento,
          })
          .returning({ id: plantsTable.id });
        plantId = usina.id;
      }

      return { projectId: projeto.id, criado: true, plantId, clienteCriado: cliente.criado };
    });

    if (!resultado.criado) {
      req.log.info(
        { deal_id: negocio.dealId, project_id: resultado.projectId },
        "Negócio ganho reenviado — projeto já existia",
      );
      res.json({
        message: "Negócio já processado",
        project_id: resultado.projectId,
        created: false,
      });
      return;
    }

    req.log.info(
      {
        deal_id: negocio.dealId,
        project_id: resultado.projectId,
        plant_id: resultado.plantId,
        indicado_por: negocio.indicacao?.nome ?? null,
      },
      "Negócio ganho virou projeto",
    );

    // Fora da transação e sem await: o WhatsApp da equipe não pode desfazer um
    // projeto já gravado nem segurar a resposta do webhook.
    const equipe = process.env.SOLO_TEAM_PHONE;
    if (equipe) {
      sendWhatsApp(equipe, resumoParaEquipe(negocio, resultado.projectId)).catch(() => {});
    }

    res.status(201).json({
      message: "Projeto criado",
      project_id: resultado.projectId,
      plant_id: resultado.plantId,
      created: true,
    });
  } catch (err) {
    req.log.error({ err, deal_id: negocio.dealId }, "Falha ao processar negócio ganho");
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/internal/indicacoes — gestão de indicações.
 *
 * Agrupa por telefone normalizado de quem indicou, com o nome mais recente:
 * a mesma pessoa aparece escrita de formas diferentes entre um card e outro, e
 * agrupar por nome espalharia a mesma indicação em várias linhas.
 * Quem indicou sem telefone cai num grupo por nome.
 */
export const indicacoesRouter: IRouter = Router();

indicacoesRouter.get("/indicacoes", async (req, res) => {
  try {
    const projetos = await db
      .select({
        id: projectsTable.id,
        clientName: projectsTable.clientName,
        valorProjeto: projectsTable.valorProjeto,
        stage: projectsTable.stage,
        indicadoPor: projectsTable.indicadoPor,
        indicadoPorTelefone: projectsTable.indicadoPorTelefone,
        createdAt: projectsTable.createdAt,
      })
      .from(projectsTable)
      .where(and(isNotNull(projectsTable.indicadoPor)))
      .orderBy(projectsTable.id);

    const grupos = new Map<
      string,
      {
        nome: string;
        telefone: string | null;
        projetos: typeof projetos;
        total: number;
        valorTotal: number;
      }
    >();

    for (const p of projetos) {
      const chave = p.indicadoPorTelefone ?? `nome:${(p.indicadoPor ?? "").toLowerCase()}`;
      const g = grupos.get(chave) ?? {
        nome: p.indicadoPor ?? "",
        telefone: p.indicadoPorTelefone,
        projetos: [] as typeof projetos,
        total: 0,
        valorTotal: 0,
      };
      // O último nome visto vence: é a grafia mais recente da mesma pessoa.
      g.nome = p.indicadoPor ?? g.nome;
      g.projetos.push(p);
      g.total += 1;
      g.valorTotal += p.valorProjeto ?? 0;
      grupos.set(chave, g);
    }

    res.json(
      [...grupos.values()].sort((a, b) => b.valorTotal - a.valorTotal || b.total - a.total),
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list indicações");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
