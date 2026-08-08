import { db } from "@workspace/db";
import { projectChecklistItemsTable } from "@workspace/db/schema";
import { eq, and, inArray } from "drizzle-orm";

// Stages that only become available after the homologation is approved.
// "compras"/"logistica" are the parallel phase right after approval; "planejamento_execucao"
// (pré-execução) also requires it when reached directly.
export const STAGES_REQUIRING_HOMOLOGACAO = [
  "compras",
  "logistica",
  "planejamento_execucao",
] as const;

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
