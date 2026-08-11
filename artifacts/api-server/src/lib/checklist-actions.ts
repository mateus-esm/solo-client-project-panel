/**
 * Resolve quais itens-ação de um projeto estão cumpridos, a partir do dado real.
 *
 * Derivado, nunca gravado: se o técnico for desatribuído, o item volta a pendente
 * sozinho. Gravar exigiria manter dois lugares em sincronia e conviver com estado
 * velho.
 *
 * Avaliação em lote — uma consulta por tipo de condição, não uma por item.
 */
import { db } from "@workspace/db";
import {
  projectsTable,
  plantsTable,
  servicesTable,
  documentsTable,
  paymentsTable,
  schedulingRequestsTable,
  projectPurchasesTable,
  homologacaoProcessosTable,
  whatsappGroupsTable,
  type ChecklistAcao,
} from "@workspace/db/schema";
import { eq, and, isNotNull, ne, sql } from "drizzle-orm";

/** Ações cumpridas de um projeto. O que não está na lista está pendente. */
export async function resolveAcoes(projectId: number): Promise<ChecklistAcao[]> {
  const done = new Set<ChecklistAcao>();

  const [project] = await db
    .select({
      homologacaoTechnicianId: projectsTable.homologacaoTechnicianId,
    })
    .from(projectsTable)
    .where(eq(projectsTable.id, projectId))
    .limit(1);

  if (project?.homologacaoTechnicianId != null) done.add("atribuir_tecnico_homologacao");

  const [processo] = await db
    .select({ numero: homologacaoProcessosTable.numeroSolicitacao })
    .from(homologacaoProcessosTable)
    .where(eq(homologacaoProcessosTable.projectId, projectId))
    .limit(1);
  if (processo?.numero) done.add("protocolo_concessionaria");

  const [plant] = await db
    .select({ id: plantsTable.id, monitoramento: plantsTable.monitoramentoUrl })
    .from(plantsTable)
    .where(eq(plantsTable.projectId, projectId))
    .limit(1);
  if (plant) done.add("cadastrar_usina");
  if (plant?.monitoramento) done.add("liberar_monitoramento");

  const [doc] = await db
    .select({ id: documentsTable.id })
    .from(documentsTable)
    .where(and(eq(documentsTable.projectId, projectId), isNotNull(documentsTable.fileUrl)))
    .limit(1);
  if (doc) done.add("anexar_documentos_cliente");

  const [pay] = await db
    .select({ id: paymentsTable.id })
    .from(paymentsTable)
    .where(and(eq(paymentsTable.projectId, projectId), eq(paymentsTable.status, "pago")))
    .limit(1);
  if (pay) done.add("registrar_pagamento");

  const [sched] = await db
    .select({ id: schedulingRequestsTable.id })
    .from(schedulingRequestsTable)
    .where(eq(schedulingRequestsTable.projectId, projectId))
    .limit(1);
  if (sched) done.add("agendar_com_cliente");

  const [grupo] = await db
    .select({ id: whatsappGroupsTable.id })
    .from(whatsappGroupsTable)
    .where(
      and(eq(whatsappGroupsTable.projectId, projectId), eq(whatsappGroupsTable.kind, "cliente")),
    )
    .limit(1);
  if (grupo) done.add("criar_grupo_whatsapp");

  // Compras: uma consulta agregada resolve "registrada" e "recebida".
  const compras = await db
    .select({ status: projectPurchasesTable.status, n: sql<number>`count(*)::int` })
    .from(projectPurchasesTable)
    .where(eq(projectPurchasesTable.projectId, projectId))
    .groupBy(projectPurchasesTable.status);
  if (compras.length > 0) done.add("registrar_compra");
  if (compras.some((c) => c.status === "recebida")) done.add("receber_material");

  // Serviços de instalação: criado vs concluído.
  const servicos = await db
    .select({ status: servicesTable.status, tipo: servicesTable.tipoServico })
    .from(servicesTable)
    .where(and(eq(servicesTable.projectId, projectId), ne(servicesTable.status, "Cancelado")));
  const instalacao = servicos.filter(
    (s) => (s.tipo ?? "").toLowerCase().includes("instala"),
  );
  if (instalacao.length > 0) done.add("criar_servico_instalacao");
  if (instalacao.some((s) => s.status === "Concluído")) done.add("concluir_servico_instalacao");

  return [...done];
}
