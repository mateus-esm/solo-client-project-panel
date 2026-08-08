import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, paymentsTable } from "@workspace/db/schema";
import { eq, asc, and, sql } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

// ─── Plano de pagamento do cliente ────────────────────────────────────────────
// Tipos: avista | cartao (N parcelas) | parcelado_solo (N parcelas) |
// entrada_entrega (entrada + saldo na entrega)

export const PAYMENT_PLAN_TYPES = ["avista", "cartao", "parcelado_solo", "entrada_entrega"] as const;

const PLAN_LABELS: Record<(typeof PAYMENT_PLAN_TYPES)[number], string> = {
  avista: "À vista",
  cartao: "Cartão de crédito",
  parcelado_solo: "Parcelado com a Solo",
  entrada_entrega: "Entrada + entrega",
};

// Data válida de calendário no formato AAAA-MM-DD (rejeita 2025-02-31, mês 13 etc.)
const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data no formato AAAA-MM-DD")
  .refine((v) => {
    const [y, m, d] = v.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return (
      date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
    );
  }, "Data inválida");

const planSchema = z
  .object({
    tipo: z.enum(PAYMENT_PLAN_TYPES),
    total: z.number().positive("Informe o valor total do plano"),
    primeiraData: dateStr,
    numParcelas: z.number().int().min(2).max(60).optional(),
    valorEntrada: z.number().positive().optional(),
    dataEntrega: dateStr.optional(),
  })
  .superRefine((v, ctx) => {
    if ((v.tipo === "cartao" || v.tipo === "parcelado_solo") && !v.numParcelas) {
      ctx.addIssue({ code: "custom", message: "Informe o número de parcelas", path: ["numParcelas"] });
    }
    if (v.tipo === "entrada_entrega") {
      if (!v.valorEntrada) {
        ctx.addIssue({ code: "custom", message: "Informe o valor da entrada", path: ["valorEntrada"] });
      } else if (v.valorEntrada >= v.total) {
        ctx.addIssue({ code: "custom", message: "A entrada deve ser menor que o total", path: ["valorEntrada"] });
      }
      if (!v.dataEntrega) {
        ctx.addIssue({ code: "custom", message: "Informe a data prevista da entrega", path: ["dataEntrega"] });
      }
    }
  });

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + months, 1));
  // Clampa o dia ao último dia do mês alvo (ex.: 31 → 28/29 em fevereiro)
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(d, lastDay));
  return date.toISOString().slice(0, 10);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function buildInstallments(plan: z.infer<typeof planSchema>) {
  const rows: { installmentNumber: number; amount: number; dueDate: string; description: string }[] = [];
  if (plan.tipo === "avista") {
    rows.push({ installmentNumber: 1, amount: round2(plan.total), dueDate: plan.primeiraData, description: "Pagamento à vista" });
  } else if (plan.tipo === "cartao" || plan.tipo === "parcelado_solo") {
    const n = plan.numParcelas!;
    const base = Math.floor((plan.total / n) * 100) / 100;
    const label = plan.tipo === "cartao" ? "Cartão" : "Parcela Solo";
    for (let i = 0; i < n; i++) {
      // Última parcela absorve o resíduo de arredondamento
      const amount = i === n - 1 ? round2(plan.total - base * (n - 1)) : base;
      rows.push({
        installmentNumber: i + 1,
        amount,
        dueDate: addMonths(plan.primeiraData, i),
        description: `${label} ${i + 1}/${n}`,
      });
    }
  } else {
    rows.push({ installmentNumber: 1, amount: round2(plan.valorEntrada!), dueDate: plan.primeiraData, description: "Entrada" });
    rows.push({
      installmentNumber: 2,
      amount: round2(plan.total - plan.valorEntrada!),
      dueDate: plan.dataEntrega!,
      description: "Saldo na entrega",
    });
  }
  return rows;
}

router.get("/projects/:id/payments", async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.id), 10);
    const rows = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.projectId, projectId))
      .orderBy(asc(paymentsTable.installmentNumber), asc(paymentsTable.id));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list project payments");
    res.status(500).json({ message: "Internal server error" });
  }
});

// Gera (ou regenera) o plano de parcelas do projeto.
// Segurança: se já houver parcela paga, o plano não pode ser substituído.
router.post("/projects/:id/payment-plan", async (req, res) => {
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
    const parsed = planSchema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      res.status(400).json({ message: first?.message ?? "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    // Transação com lock na linha do projeto: serializa geração/remoção do plano
    // e marcação de pagamento, evitando apagar parcela paga em corrida.
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`);
      const [paid] = await tx
        .select({ id: paymentsTable.id })
        .from(paymentsTable)
        .where(and(eq(paymentsTable.projectId, projectId), eq(paymentsTable.status, "paid")))
        .limit(1);
      if (paid) return { conflict: true as const };

      const installments = buildInstallments(parsed.data);
      await tx.delete(paymentsTable).where(eq(paymentsTable.projectId, projectId));
      const created = await tx
        .insert(paymentsTable)
        .values(installments.map((i) => ({ ...i, projectId, status: "pending" })))
        .returning();
      await tx
        .update(projectsTable)
        .set({
          paymentPlanType: parsed.data.tipo,
          formaDePagamento: PLAN_LABELS[parsed.data.tipo],
          valorProjeto: round2(parsed.data.total),
        })
        .where(eq(projectsTable.id, projectId));
      return { conflict: false as const, created };
    });
    if (result.conflict) {
      res.status(409).json({
        message:
          "Já existem parcelas pagas neste projeto. Desmarque os pagamentos antes de gerar um novo plano.",
      });
      return;
    }
    res.status(201).json(result.created);
  } catch (err) {
    req.log.error({ err }, "Failed to create payment plan");
    res.status(500).json({ message: "Internal server error" });
  }
});

// Remove o plano (apenas se nenhuma parcela estiver paga)
router.delete("/projects/:id/payment-plan", async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.id), 10);
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`);
      const [paid] = await tx
        .select({ id: paymentsTable.id })
        .from(paymentsTable)
        .where(and(eq(paymentsTable.projectId, projectId), eq(paymentsTable.status, "paid")))
        .limit(1);
      if (paid) return { conflict: true as const };
      await tx.delete(paymentsTable).where(eq(paymentsTable.projectId, projectId));
      await tx
        .update(projectsTable)
        .set({ paymentPlanType: null })
        .where(eq(projectsTable.id, projectId));
      return { conflict: false as const };
    });
    if (result.conflict) {
      res.status(409).json({
        message: "Já existem parcelas pagas. Desmarque os pagamentos antes de remover o plano.",
      });
      return;
    }
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete payment plan");
    res.status(500).json({ message: "Internal server error" });
  }
});

// Marca/desmarca parcela como paga (mês a mês)
const paymentPatchSchema = z.object({
  status: z.enum(["pending", "paid", "overdue"]).optional(),
  paidDate: dateStr.nullable().optional(),
  dueDate: dateStr.optional(),
  amount: z.number().positive().optional(),
  description: z.string().nullable().optional(),
});

router.patch("/payments/:id", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const parsed = paymentPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const patch: Record<string, unknown> = { ...parsed.data };
    // Consistência status ↔ data de pagamento
    if (parsed.data.status === "paid" && parsed.data.paidDate === undefined) {
      patch.paidDate = new Date().toISOString().slice(0, 10);
    }
    if (parsed.data.status && parsed.data.status !== "paid") {
      patch.paidDate = null;
    }
    // Serializa com geração/remoção de plano via lock na linha do projeto
    const row = await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ projectId: paymentsTable.projectId })
        .from(paymentsTable)
        .where(eq(paymentsTable.id, id));
      if (!current) return null;
      await tx.execute(sql`SELECT id FROM projects WHERE id = ${current.projectId} FOR UPDATE`);
      const [updated] = await tx
        .update(paymentsTable)
        .set(patch)
        .where(eq(paymentsTable.id, id))
        .returning();
      return updated ?? null;
    });
    if (!row) {
      res.status(404).json({ message: "Parcela não encontrada" });
      return;
    }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "Failed to update payment");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
