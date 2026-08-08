import { db } from "@workspace/db";
import { projectChecklistItemsTable, projectPurchasesTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";

// Macro stages that only become available after the homologation is approved.
// With compras/logística now a parallel supply track, the gate sits on
// "planejamento_execucao" (pré-execução) — the first macro after homologação.
export const STAGES_REQUIRING_HOMOLOGACAO = ["planejamento_execucao"] as const;

export const HOMOLOGACAO_APPROVAL_SLUGS = [
  "homologacao_aprovacao_e_registro",
  "homologacao_validacao_de_homologacao",
] as const;

export const HOMOLOGACAO_GATE_MESSAGE =
  "Esta etapa só é liberada após a homologação aprovada. Registre a aprovação no checklist de Homologação.";

/** True when the project has at least one completed approval/validation item in the homologation checklist. */
export async function homologacaoAprovada(projectId: number): Promise<boolean> {
  const rows = await db
    .select({ id: projectChecklistItemsTable.id })
    .from(projectChecklistItemsTable)
    .where(
      and(
        eq(projectChecklistItemsTable.projectId, projectId),
        eq(projectChecklistItemsTable.done, true),
        inArray(projectChecklistItemsTable.checklistSlug, [...HOMOLOGACAO_APPROVAL_SLUGS]),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// ─── Gate de suprimentos para a Pré-execução ─────────────────────────────────
// Pré-execução exige pelo menos uma compra efetivada e nenhuma compra efetivada
// sem logística programada/recebida. Shared by the internal and homologação routes
// so the rule cannot drift between them.

export const COMPRAS_GATE_MESSAGE =
  "Registre as compras do projeto (equipamentos/materiais) antes de liberar a Pré-execução.";

export const LOGISTICA_GATE_MESSAGE =
  "Programe a logística de todas as compras registradas antes de liberar a Pré-execução.";

/** Pure rule over the project's purchase statuses — kept separate so it can be unit-tested. */
export function comprasGateErrorFor(statuses: readonly string[]): string | null {
  const efetivadas = statuses.filter((s) => s !== "cotacao");
  if (efetivadas.length === 0) return COMPRAS_GATE_MESSAGE;
  if (efetivadas.some((s) => s === "comprada")) return LOGISTICA_GATE_MESSAGE;
  return null;
}

/** Returns null when supplies are ready for pré-execução, or the 409 message otherwise. */
export async function comprasGateError(projectId: number): Promise<string | null> {
  const purchases = await db
    .select({ status: projectPurchasesTable.status })
    .from(projectPurchasesTable)
    .where(eq(projectPurchasesTable.projectId, projectId));
  return comprasGateErrorFor(purchases.map((p) => p.status));
}
