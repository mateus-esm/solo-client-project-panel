import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  suppliersTable,
  projectPurchasesTable,
  projectsTable,
  insertSupplierSchema,
  insertPurchaseSchema,
} from "@workspace/db/schema";
import { eq, and, asc, ne } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

// ─── Agregação: compras → capex / custo de materiais do projeto ──────────────
// Semântica: um valor manual do projeto (capex/custo de materiais digitado pelo
// admin) é preservado até existir compra efetivada (status != cotacao) na
// categoria. A partir daí a categoria passa a ser dirigida pelas compras: soma
// das efetivadas; se a última efetivada for removida/revertida, volta a null
// (o valor manual anterior já foi sobrescrito e não é recuperável).

async function getEffectivePurchases(projectId: number) {
  return db
    .select({
      categoria: projectPurchasesTable.categoria,
      valor: projectPurchasesTable.valor,
    })
    .from(projectPurchasesTable)
    .where(
      and(
        eq(projectPurchasesTable.projectId, projectId),
        ne(projectPurchasesTable.status, "cotacao"),
      ),
    );
}

/** Tira um snapshot (antes da mutação) de quais categorias têm compras efetivadas. */
export async function snapshotEffectiveCategories(projectId: number): Promise<Set<string>> {
  const rows = await getEffectivePurchases(projectId);
  return new Set(rows.map((r) => r.categoria));
}

export async function recomputeProjectCosts(
  projectId: number,
  affected: string[],
  effectiveBefore: Set<string>,
): Promise<void> {
  if (affected.length === 0) return;
  const purchases = await getEffectivePurchases(projectId);

  const patch: Record<string, number | null> = {};
  for (const cat of affected) {
    const rows = purchases.filter((p) => p.categoria === cat);
    const key = cat === "equipamentos" ? "capex" : cat === "materiais" ? "custoMateriais" : null;
    if (!key) continue;
    if (rows.length > 0) {
      patch[key] = rows.reduce((acc, p) => acc + (p.valor ?? 0), 0);
    } else if (effectiveBefore.has(cat)) {
      // A categoria era dirigida por compras e deixou de ter compras efetivadas.
      patch[key] = null;
    }
    // Sem compras efetivadas antes e depois → valor manual do projeto preservado.
  }
  if (Object.keys(patch).length > 0) {
    await db.update(projectsTable).set(patch).where(eq(projectsTable.id, projectId));
  }
}

// ─── Máquina de estados da compra ─────────────────────────────────────────────
const STATUS_ORDER = ["cotacao", "comprada", "logistica_programada", "recebida"] as const;

/**
 * Valida a transição de status e os campos obrigatórios do novo status.
 * Retorna uma mensagem de erro ou null se ok. `merged` é o registro já com o
 * patch aplicado (campos podem vir do body ou já existirem no registro).
 */
function validateStatusTransition(
  from: string,
  to: string,
  merged: { valor: number | null; transportadora: string | null; dataRecebimento: string | null },
): string | null {
  if (from === to) return null;
  const fromIdx = STATUS_ORDER.indexOf(from as (typeof STATUS_ORDER)[number]);
  const toIdx = STATUS_ORDER.indexOf(to as (typeof STATUS_ORDER)[number]);
  if (toIdx === -1) return "Status inválido.";
  // Avanço apenas um passo por vez; retrocesso livre para correções.
  if (toIdx > fromIdx + 1) {
    return `Transição inválida: registre primeiro "${STATUS_ORDER[fromIdx + 1]}".`;
  }
  if (toIdx >= 1 && merged.valor == null) {
    return "Informe o valor da compra para registrá-la.";
  }
  if (toIdx >= 2 && !merged.transportadora) {
    return "Informe a transportadora para programar a logística.";
  }
  if (toIdx >= 3 && !merged.dataRecebimento) {
    return "Informe a data de recebimento para confirmar.";
  }
  return null;
}

// ─── Fornecedores ─────────────────────────────────────────────────────────────

router.get("/suppliers", async (req, res) => {
  try {
    const rows = await db.select().from(suppliersTable).orderBy(asc(suppliersTable.name));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list suppliers");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/suppliers", async (req, res) => {
  try {
    const parsed = insertSupplierSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [row] = await db.insert(suppliersTable).values(parsed.data).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to create supplier");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/suppliers/:id", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const parsed = insertSupplierSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [row] = await db
      .update(suppliersTable)
      .set(parsed.data)
      .where(eq(suppliersTable.id, id))
      .returning();
    if (!row) {
      res.status(404).json({ message: "Fornecedor não encontrado" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update supplier");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/suppliers/:id", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [used] = await db
      .select({ id: projectPurchasesTable.id })
      .from(projectPurchasesTable)
      .where(eq(projectPurchasesTable.supplierId, id))
      .limit(1);
    if (used) {
      res.status(409).json({
        message: "Este fornecedor tem compras registradas e não pode ser removido.",
      });
      return;
    }
    await db.delete(suppliersTable).where(eq(suppliersTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete supplier");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Compras por projeto ──────────────────────────────────────────────────────

router.get("/projects/:id/purchases", async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.id), 10);
    const rows = await db
      .select({
        purchase: projectPurchasesTable,
        supplierName: suppliersTable.name,
      })
      .from(projectPurchasesTable)
      .leftJoin(suppliersTable, eq(projectPurchasesTable.supplierId, suppliersTable.id))
      .where(eq(projectPurchasesTable.projectId, projectId))
      .orderBy(asc(projectPurchasesTable.id));
    res.json(rows.map((r) => ({ ...r.purchase, supplierName: r.supplierName ?? "(removido)" })));
  } catch (err) {
    req.log.error({ err }, "Failed to list purchases");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/projects/:id/purchases", async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.id), 10);
    const [project] = await db
      .select({ id: projectsTable.id })
      .from(projectsTable)
      .where(eq(projectsTable.id, projectId));
    if (!project) {
      res.status(404).json({ message: "Projeto não encontrado" });
      return;
    }
    const parsed = insertPurchaseSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [supplier] = await db
      .select()
      .from(suppliersTable)
      .where(eq(suppliersTable.id, parsed.data.supplierId));
    if (!supplier) {
      res.status(400).json({ message: "Fornecedor não encontrado" });
      return;
    }
    const effectiveBefore = await snapshotEffectiveCategories(projectId);
    // Toda compra nasce como cotação; avanços passam pela máquina de estados no PATCH.
    const [row] = await db
      .insert(projectPurchasesTable)
      .values({ ...parsed.data, status: "cotacao", projectId, categoria: supplier.tipo })
      .returning();
    await recomputeProjectCosts(projectId, [supplier.tipo], effectiveBefore);
    res.status(201).json({ ...row, supplierName: supplier.name });
  } catch (err) {
    req.log.error({ err }, "Failed to create purchase");
    res.status(500).json({ message: "Internal server error" });
  }
});

const purchasePatchSchema = insertPurchaseSchema.partial().extend({
  supplierId: z.number().optional(),
});

router.patch("/purchases/:id", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const parsed = purchasePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [current] = await db
      .select()
      .from(projectPurchasesTable)
      .where(eq(projectPurchasesTable.id, id));
    if (!current) {
      res.status(404).json({ message: "Compra não encontrada" });
      return;
    }
    const patch: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.supplierId !== undefined && parsed.data.supplierId !== current.supplierId) {
      const [supplier] = await db
        .select()
        .from(suppliersTable)
        .where(eq(suppliersTable.id, parsed.data.supplierId));
      if (!supplier) {
        res.status(400).json({ message: "Fornecedor não encontrado" });
        return;
      }
      patch.categoria = supplier.tipo;
    }
    if (parsed.data.status !== undefined) {
      const merged = {
        valor: parsed.data.valor !== undefined ? parsed.data.valor : current.valor,
        transportadora:
          parsed.data.transportadora !== undefined
            ? parsed.data.transportadora
            : current.transportadora,
        dataRecebimento:
          parsed.data.dataRecebimento !== undefined
            ? parsed.data.dataRecebimento
            : current.dataRecebimento,
      };
      const transitionError = validateStatusTransition(current.status, parsed.data.status, merged);
      if (transitionError) {
        res.status(409).json({ message: transitionError });
        return;
      }
    }
    const effectiveBefore = await snapshotEffectiveCategories(current.projectId);
    const [row] = await db
      .update(projectPurchasesTable)
      .set(patch)
      .where(eq(projectPurchasesTable.id, id))
      .returning();
    const affected = [current.categoria];
    if (patch.categoria && patch.categoria !== current.categoria) {
      affected.push(patch.categoria as string);
    }
    await recomputeProjectCosts(current.projectId, affected, effectiveBefore);
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update purchase");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/purchases/:id", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [current] = await db
      .select()
      .from(projectPurchasesTable)
      .where(eq(projectPurchasesTable.id, id));
    if (!current) {
      res.status(404).json({ message: "Compra não encontrada" });
      return;
    }
    const effectiveBefore = await snapshotEffectiveCategories(current.projectId);
    await db.delete(projectPurchasesTable).where(eq(projectPurchasesTable.id, id));
    await recomputeProjectCosts(current.projectId, [current.categoria], effectiveBefore);
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete purchase");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
