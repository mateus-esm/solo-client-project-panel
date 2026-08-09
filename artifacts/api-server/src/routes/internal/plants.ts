/**
 * Rotas internas de usinas (plants).
 * GET   /internal/plants                      — lista
 * GET   /internal/plants/by-project/:projectId — usina do projeto (null se não houver)
 * POST  /internal/plants                      — cria
 * PATCH /internal/plants/:id                  — atualiza
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { plantsTable, projectsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

const nullableNum = z.coerce.number().nullish();
const nullableInt = z.coerce.number().int().nullish();

const plantSchema = z.object({
  projectId: z.coerce.number().int().nullish(),
  clientId: z.coerce.number().int().nullish(),
  name: z.string().nullish(),
  tipoUsina: z.string().nullish(),
  status: z.string().nullish(),
  concessionaria: z.string().nullish(),
  enderecoInstalacao: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  potenciaInstaladaKwp: nullableNum,
  areaConstruidaM2: nullableNum,
  geracaoEstimadaKwh: nullableNum,
  receitaEstimada: nullableNum,
  consumoMedioMensal: nullableNum,
  dataInicio: z.string().nullish(),
  dataAtivacao: z.string().nullish(),
  moduloFabricante: z.string().nullish(),
  moduloPotenciaW: nullableNum,
  moduloQuantidade: nullableInt,
  inversorFabricante: z.string().nullish(),
  inversorPotenciaKw: nullableNum,
  inversorQuantidade: nullableInt,
  tipoEstrutura: z.string().nullish(),
  tipoMonitoramento: z.string().nullish(),
  monitoramentoUrl: z.string().nullish(),
  driveUrl: z.string().nullish(),
  observacoes: z.string().nullish(),
});

router.get("/plants", async (req, res) => {
  try {
    const rows = await db.select().from(plantsTable).orderBy(asc(plantsTable.id));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list plants");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/plants/by-project/:projectId", async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const [plant] = await db.select().from(plantsTable).where(eq(plantsTable.projectId, projectId));
    res.json(plant ?? null);
  } catch (err) {
    req.log.error({ err }, "Failed to get plant by project");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/plants", async (req, res) => {
  try {
    const parsed = plantSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    // Uma usina por projeto — o índice único garante, mas a mensagem aqui é útil.
    if (parsed.data.projectId) {
      const [exists] = await db
        .select({ id: plantsTable.id })
        .from(plantsTable)
        .where(eq(plantsTable.projectId, parsed.data.projectId))
        .limit(1);
      if (exists) {
        res.status(409).json({ message: "Este projeto já tem uma usina cadastrada", plantId: exists.id });
        return;
      }
      // Herda o cliente do projeto quando não vier explícito.
      if (!parsed.data.clientId) {
        const [proj] = await db
          .select({ clientId: projectsTable.clientId })
          .from(projectsTable)
          .where(eq(projectsTable.id, parsed.data.projectId))
          .limit(1);
        if (proj?.clientId) parsed.data.clientId = proj.clientId;
      }
    }
    const [plant] = await db.insert(plantsTable).values(parsed.data).returning();
    res.status(201).json(plant);
  } catch (err) {
    req.log.error({ err }, "Failed to create plant");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/plants/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const parsed = plantSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [plant] = await db
      .update(plantsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(plantsTable.id, id))
      .returning();
    if (!plant) {
      res.status(404).json({ message: "Usina não encontrada" });
      return;
    }
    res.json(plant);
  } catch (err) {
    req.log.error({ err }, "Failed to update plant");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
