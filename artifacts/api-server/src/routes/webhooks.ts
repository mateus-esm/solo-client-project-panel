import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, notificationsTable, paymentsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { mapJestorStatusToStep, stepCompletionPercent } from "../lib/jestor";
import { sendWhatsApp, sendEmail, buildPhaseNotification } from "../lib/notifications";

const router: IRouter = Router();

function validateWebhookSecret(req: any, res: any): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  const isDev = process.env.NODE_ENV !== "production";

  if (!secret) {
    if (isDev) {
      return true;
    }
    res.status(500).json({ message: "Webhook secret not configured" });
    return false;
  }

  const provided =
    req.headers["x-webhook-secret"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (provided !== secret) {
    res.status(401).json({ message: "Unauthorized: invalid webhook secret" });
    return false;
  }
  return true;
}

/**
 * POST /api/webhooks/jestor/project
 *
 * Unified Jestor webhook — handles both project creation and phase updates.
 * Dispatches from Jestor Lowcode automation.
 *
 * Expected body (all Jestor field names):
 * {
 *   jestor_id: string,            // required — Jestor record ID
 *   name?: string,                // client name
 *   client_email?: string,
 *   client_phone?: string,
 *   system_power?: number,        // kWp
 *   city?: string,
 *   state?: string,
 *   status_projeto?: string,      // e.g. "Onboarding", "Engenharia", "Homologação"...
 *   data_inicio_prevista?: string,
 *   data_conclusao_prevista?: string,
 *   data_de_fechamento?: string,
 *   data_de_pagamento?: string,
 *   data_de_compras?: string,
 *   data_de_entrega_do_equipamento?: string,
 *   valor_projeto?: number,
 *   forma_de_pagamento?: string,
 *   observacoes_gerais?: string,
 *   tracking_code?: string,
 *   tracking_carrier?: string,
 *   notes?: string,
 * }
 */
router.post("/webhooks/jestor/project", async (req, res) => {
  if (!validateWebhookSecret(req, res)) return;

  const {
    jestor_id,
    name,
    client_email,
    client_phone,
    system_power,
    city,
    state,
    status_projeto,
    data_inicio_prevista,
    data_conclusao_prevista,
    data_de_fechamento,
    data_de_pagamento,
    data_de_compras,
    data_de_entrega_do_equipamento,
    valor_projeto,
    forma_de_pagamento,
    observacoes_gerais,
    tracking_code,
    tracking_carrier,
    notes,
  } = req.body;

  if (!jestor_id) {
    res.status(400).json({ message: "jestor_id is required" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.jestorId, jestor_id));

    // Determine the effective phase:
    // - For creation: use incoming status_projeto (defaults to step 1 if missing)
    // - For update: only change phase if status_projeto is explicitly provided;
    //   otherwise preserve the existing phase to avoid false regressions
    const hasExplicitStatus = status_projeto != null;
    const newStep = hasExplicitStatus
      ? mapJestorStatusToStep(status_projeto)
      : (existing?.statusStep ?? 1);
    const newPercent = stepCompletionPercent(newStep);

    if (!existing) {
      // --- CREATE ---
      if (!name || !client_email) {
        res.status(400).json({ message: "New project requires: name, client_email" });
        return;
      }

      const [project] = await db
        .insert(projectsTable)
        .values({
          jestorId: jestor_id,
          clientName: name,
          clientEmail: client_email,
          clientPhone: client_phone ?? null,
          systemPower: system_power ?? 0,
          statusStep: newStep,
          statusProjeto: status_projeto ?? null,
          completionPercent: newPercent,
          city: city ?? "",
          state: state ?? "",
          trackingCode: tracking_code ?? null,
          trackingCarrier: tracking_carrier ?? null,
          notes: notes ?? null,
          observacoesGerais: observacoes_gerais ?? null,
          valorProjeto: valor_projeto ?? null,
          formaDePagamento: forma_de_pagamento ?? null,
          dataInicioPrevista: data_inicio_prevista ?? null,
          dataConclusaoPrevista: data_conclusao_prevista ?? null,
          dataDeFechamento: data_de_fechamento ?? null,
          dataDePagamento: data_de_pagamento ?? null,
          dataDeCompras: data_de_compras ?? null,
          dataDeEntregaDoEquipamento: data_de_entrega_do_equipamento ?? null,
        })
        .returning();

      const notification = buildPhaseNotification(newStep, name, tracking_code);

      await db.insert(notificationsTable).values({
        projectId: project.id,
        title: notification.title,
        message: notification.whatsapp.split("\n\n").slice(2).join("\n\n"),
        read: false,
      });

      if (client_phone) {
        await sendWhatsApp(client_phone, notification.whatsapp);
      }
      await sendEmail(client_email, notification.emailSubject, notification.emailHtml);

      req.log.info({ project_id: project.id, jestor_id }, "New project created via Jestor webhook");

      res.status(201).json({
        message: "Project created successfully",
        project_id: project.id,
        created: true,
        phase: newStep,
        phase_name: status_projeto ?? "Onboarding",
      });
      return;
    }

    // --- UPDATE ---
    // Only trigger phase-change notifications when the phase actually changed
    // AND the incoming payload explicitly included status_projeto
    const phaseChanged = hasExplicitStatus && existing.statusStep !== newStep;

    await db
      .update(projectsTable)
      .set({
        ...(name ? { clientName: name } : {}),
        ...(client_email ? { clientEmail: client_email } : {}),
        ...(client_phone !== undefined ? { clientPhone: client_phone } : {}),
        ...(system_power !== undefined ? { systemPower: system_power } : {}),
        ...(city ? { city } : {}),
        ...(state ? { state } : {}),
        statusStep: newStep,
        ...(hasExplicitStatus ? { statusProjeto: status_projeto } : {}),
        completionPercent: newPercent,
        ...(tracking_code !== undefined ? { trackingCode: tracking_code } : {}),
        ...(tracking_carrier !== undefined ? { trackingCarrier: tracking_carrier } : {}),
        ...(notes !== undefined ? { notes } : {}),
        ...(observacoes_gerais !== undefined ? { observacoesGerais: observacoes_gerais } : {}),
        ...(valor_projeto !== undefined ? { valorProjeto: valor_projeto } : {}),
        ...(forma_de_pagamento !== undefined ? { formaDePagamento: forma_de_pagamento } : {}),
        ...(data_inicio_prevista !== undefined ? { dataInicioPrevista: data_inicio_prevista } : {}),
        ...(data_conclusao_prevista !== undefined ? { dataConclusaoPrevista: data_conclusao_prevista } : {}),
        ...(data_de_fechamento !== undefined ? { dataDeFechamento: data_de_fechamento } : {}),
        ...(data_de_pagamento !== undefined ? { dataDePagamento: data_de_pagamento } : {}),
        ...(data_de_compras !== undefined ? { dataDeCompras: data_de_compras } : {}),
        ...(data_de_entrega_do_equipamento !== undefined ? { dataDeEntregaDoEquipamento: data_de_entrega_do_equipamento } : {}),
      })
      .where(eq(projectsTable.id, existing.id));

    if (phaseChanged) {
      const clientName = name ?? existing.clientName;
      const clientEmail = client_email ?? existing.clientEmail;
      const clientPhone = client_phone ?? existing.clientPhone;
      const notification = buildPhaseNotification(newStep, clientName, tracking_code ?? existing.trackingCode);

      await db.insert(notificationsTable).values({
        projectId: existing.id,
        title: notification.title,
        message: notification.whatsapp.split("\n\n").slice(2).join("\n\n"),
        read: false,
      });

      if (clientPhone) {
        await sendWhatsApp(clientPhone, notification.whatsapp);
      }
      await sendEmail(clientEmail, notification.emailSubject, notification.emailHtml);
    }

    // Handle optional payments array
    const paymentsPayload = req.body.payments as Array<{
      installment_number: number;
      amount: number;
      due_date: string;
      paid_date?: string | null;
      status?: string;
      description?: string | null;
    }> | undefined;

    if (paymentsPayload && Array.isArray(paymentsPayload)) {
      await upsertPayments(existing.id, paymentsPayload);
    }

    req.log.info(
      { project_id: existing.id, jestor_id, step: newStep, phase_changed: phaseChanged },
      "Project updated via Jestor webhook"
    );

    res.json({
      message: "Project updated successfully",
      project_id: existing.id,
      created: false,
      phase: newStep,
      phase_name: status_projeto ?? existing.statusProjeto,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to process Jestor webhook");
    res.status(500).json({ message: "Internal server error" });
  }
});

type PaymentUpsertItem = {
  installment_number: number;
  amount: number;
  due_date: string;
  paid_date?: string | null;
  status?: string;
  description?: string | null;
};

async function upsertPayments(projectId: number, items: PaymentUpsertItem[]) {
  for (const item of items) {
    const [existing] = await db
      .select()
      .from(paymentsTable)
      .where(
        and(
          eq(paymentsTable.projectId, projectId),
          eq(paymentsTable.installmentNumber, item.installment_number)
        )
      );

    if (existing) {
      await db
        .update(paymentsTable)
        .set({
          amount: item.amount,
          dueDate: item.due_date,
          ...(item.paid_date !== undefined ? { paidDate: item.paid_date } : {}),
          status: item.status ?? existing.status,
          ...(item.description !== undefined ? { description: item.description } : {}),
        })
        .where(eq(paymentsTable.id, existing.id));
    } else {
      await db.insert(paymentsTable).values({
        projectId,
        installmentNumber: item.installment_number,
        amount: item.amount,
        dueDate: item.due_date,
        paidDate: item.paid_date ?? null,
        status: item.status ?? "pending",
        description: item.description ?? null,
      });
    }
  }
}

function formatPayment(p: typeof paymentsTable.$inferSelect) {
  return {
    id: p.id,
    projectId: p.projectId,
    installmentNumber: p.installmentNumber,
    amount: p.amount,
    dueDate: p.dueDate,
    paidDate: p.paidDate ?? null,
    status: p.status,
    description: p.description ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

router.post("/payments", async (req, res) => {
  if (!validateWebhookSecret(req, res)) return;

  const { projectId, installmentNumber, amount, dueDate, paidDate, status, description } = req.body;

  if (!projectId || !installmentNumber || amount === undefined || !dueDate) {
    res.status(400).json({ message: "projectId, installmentNumber, amount, and dueDate are required" });
    return;
  }

  try {
    const [payment] = await db
      .insert(paymentsTable)
      .values({
        projectId,
        installmentNumber,
        amount,
        dueDate,
        paidDate: paidDate ?? null,
        status: status ?? "pending",
        description: description ?? null,
      })
      .returning();

    res.status(201).json(formatPayment(payment));
  } catch (err) {
    req.log.error({ err }, "Failed to create payment");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/payments/:id", async (req, res) => {
  if (!validateWebhookSecret(req, res)) return;

  const id = parseInt(req.params.id, 10);
  const { status, paidDate } = req.body;

  if (!status) {
    res.status(400).json({ message: "status is required" });
    return;
  }

  try {
    const [existing] = await db.select().from(paymentsTable).where(eq(paymentsTable.id, id));
    if (!existing) {
      res.status(404).json({ message: "Payment not found" });
      return;
    }

    const [updated] = await db
      .update(paymentsTable)
      .set({
        status,
        ...(paidDate !== undefined ? { paidDate } : {}),
      })
      .where(eq(paymentsTable.id, id))
      .returning();

    res.json(formatPayment(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to update payment status");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
