/**
 * Rotas internas de estoque.
 * GET    /internal/stock      — lista
 * POST   /internal/stock      — cria item
 * PATCH  /internal/stock/:id  — atualiza
 * DELETE /internal/stock/:id  — remove
 *
 * Movimentação (consumo pela lista de materiais do serviço) fica para a Sprint 3.
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { stockItemsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

const stockSchema = z.object({
  sku: z.string().nullish(),
  name: z.string().min(1, "Nome é obrigatório"),
  categoria: z.string().default("outro"),
  unidade: z.string().default("un"),
  quantidade: z.coerce.number().default(0),
  custoUnitario: z.coerce.number().nullish(),
  estoqueMinimo: z.coerce.number().nullish(),
  supplierId: z.coerce.number().int().nullish(),
  localizacao: z.string().nullish(),
  observacoes: z.string().nullish(),
});

router.get("/stock", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(stockItemsTable)
      .orderBy(asc(stockItemsTable.categoria), asc(stockItemsTable.name));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list stock");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/stock", async (req, res) => {
  try {
    const parsed = stockSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [item] = await db.insert(stockItemsTable).values(parsed.data).returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to create stock item");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/stock/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const parsed = stockSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [item] = await db
      .update(stockItemsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(stockItemsTable.id, id))
      .returning();
    if (!item) {
      res.status(404).json({ message: "Item não encontrado" });
      return;
    }
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to update stock item");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/stock/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(stockItemsTable).where(eq(stockItemsTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete stock item");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
