import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

export const CLIENT_INTAKE_DOCUMENTS = [
  {
    name: "RG ou CNH",
    description: "Documento de identificação do titular, frente e verso quando aplicável.",
  },
  {
    name: "Conta de energia — unidade titular",
    description: "Conta de energia recente da unidade onde o sistema será instalado.",
  },
  {
    name: "Conta de energia — unidade de rateio",
    description: "Envie apenas se o projeto distribuir créditos para outra unidade consumidora.",
  },
] as const;

export async function ensureClientIntakeDocuments(projectId: number) {
  const existing = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.projectId, projectId));
  const existingNames = new Set(existing.map((document) => document.name));
  const missing = CLIENT_INTAKE_DOCUMENTS.filter((document) => !existingNames.has(document.name));

  if (!missing.length) return existing;

  const created = await db
    .insert(documentsTable)
    .values(
      missing.map((document) => ({
        projectId,
        name: document.name,
        type: "pending_upload",
        category: "entrada",
        displayCategory: "cliente",
        required: document.name !== "Conta de energia — unidade de rateio",
        description: document.description,
      })),
    )
    .returning();

  return [...existing, ...created];
}