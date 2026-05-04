import { Router, type IRouter } from "express";
import multer from "multer";
import type { RequestHandler } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  documentsTable,
  notificationsTable,
  paymentsTable,
  schedulingRequestsTable,
  DEFAULT_SECTION_VISIBILITY,
  type SectionVisibility,
} from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin, verifyAdminPassword, createAdminSession, deleteAdminSession } from "../lib/adminAuth";
import { ObjectStorageService } from "../lib/objectStorage";
import { stepCompletionPercent } from "../lib/jestor";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

const ALLOWED_CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const _upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });
const uploadSingle: RequestHandler = (req, res, next) => {
  _upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ message: "Arquivo muito grande. Máximo de 10 MB." });
      return;
    }
    next(err as Error);
  });
};

// ─── In-memory stores (persisted to DB when migration runs) ──────────────────
// These store extra per-project/document data not yet in the DB schema
const projectSectionVisibility = new Map<number, SectionVisibility>();
const projectSchedulingLink = new Map<number, string>();
const documentDisplayCategory = new Map<number, string>();

export function getProjectMeta(projectId: number) {
  return {
    sectionVisibility: projectSectionVisibility.get(projectId) ?? { ...DEFAULT_SECTION_VISIBILITY },
    schedulingLink: projectSchedulingLink.get(projectId) ?? null,
  };
}

export function getDocumentDisplayCategory(documentId: number, fallbackCategory: string): string {
  return documentDisplayCategory.get(documentId) ?? (fallbackCategory === "entrada" ? "cliente" : "engenharia");
}

// ─── Admin Auth ───────────────────────────────────────────────────────────────

router.post("/admin/auth/login", async (req, res) => {
  const { password } = req.body as { password?: string };
  if (!password) {
    res.status(400).json({ message: "Senha obrigatória" });
    return;
  }
  const valid = await verifyAdminPassword(password);
  if (!valid) {
    res.status(401).json({ message: "Senha incorreta" });
    return;
  }
  const token = await createAdminSession();
  res.cookie("solo_admin_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
  res.json({ ok: true });
});

router.post("/admin/auth/logout", async (req, res) => {
  const token = req.cookies?.solo_admin_session;
  if (token) await deleteAdminSession(token);
  res.clearCookie("solo_admin_session", { path: "/" });
  res.json({ ok: true });
});

router.get("/admin/auth/check", requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

// ─── Projects ─────────────────────────────────────────────────────────────────

function formatProject(p: typeof projectsTable.$inferSelect) {
  const meta = getProjectMeta(p.id);
  return {
    id: p.id,
    jestorId: p.jestorId,
    clientName: p.clientName,
    clientEmail: p.clientEmail,
    clientPhone: p.clientPhone,
    systemPower: p.systemPower,
    statusStep: p.statusStep,
    statusProjeto: p.statusProjeto,
    trackingCode: p.trackingCode,
    trackingCarrier: p.trackingCarrier,
    city: p.city,
    state: p.state,
    completionPercent: p.completionPercent,
    estimatedActivation: p.estimatedActivation,
    notes: p.notes,
    estimatedDate: p.estimatedDate,
    valorProjeto: p.valorProjeto,
    formaDePagamento: p.formaDePagamento,
    observacoesGerais: p.observacoesGerais,
    dataInicioPrevista: p.dataInicioPrevista,
    dataConclusaoPrevista: p.dataConclusaoPrevista,
    dataDeFechamento: p.dataDeFechamento,
    dataDePagamento: p.dataDePagamento,
    dataDeCompras: p.dataDeCompras,
    dataDeEntregaDoEquipamento: p.dataDeEntregaDoEquipamento,
    schedulingLink: meta.schedulingLink,
    sectionVisibility: meta.sectionVisibility,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/admin/projects", requireAdmin, async (req, res) => {
  try {
    const projects = await db.select().from(projectsTable).orderBy(desc(projectsTable.createdAt));
    res.json(projects.map(formatProject));
  } catch (err) {
    req.log.error({ err }, "Admin: failed to list projects");
    res.status(500).json({ message: "Erro interno" });
  }
});

router.post("/admin/projects", requireAdmin, async (req, res) => {
  try {
    const {
      clientName, clientEmail, clientPhone, systemPower, statusStep,
      city, state, valorProjeto, formaDePagamento, observacoesGerais,
      notes, estimatedActivation, trackingCode, trackingCarrier,
      dataInicioPrevista, dataConclusaoPrevista, dataDeFechamento,
      dataDePagamento, dataDeCompras, dataDeEntregaDoEquipamento,
      schedulingLink, sectionVisibility,
    } = req.body;

    if (!clientName || !clientEmail) {
      res.status(400).json({ message: "Nome e email do cliente são obrigatórios" });
      return;
    }

    const step = Number(statusStep ?? 1);
    const [project] = await db
      .insert(projectsTable)
      .values({
        clientName,
        clientEmail: String(clientEmail).toLowerCase(),
        clientPhone: clientPhone || null,
        systemPower: Number(systemPower ?? 0),
        statusStep: step,
        completionPercent: stepCompletionPercent(step),
        city: city ?? "",
        state: state ?? "",
        valorProjeto: valorProjeto ? Number(valorProjeto) : null,
        formaDePagamento: formaDePagamento || null,
        observacoesGerais: observacoesGerais || null,
        notes: notes || null,
        estimatedActivation: estimatedActivation || null,
        trackingCode: trackingCode || null,
        trackingCarrier: trackingCarrier || null,
        dataInicioPrevista: dataInicioPrevista || null,
        dataConclusaoPrevista: dataConclusaoPrevista || null,
        dataDeFechamento: dataDeFechamento || null,
        dataDePagamento: dataDePagamento || null,
        dataDeCompras: dataDeCompras || null,
        dataDeEntregaDoEquipamento: dataDeEntregaDoEquipamento || null,
      })
      .returning();

    if (schedulingLink) projectSchedulingLink.set(project.id, schedulingLink);
    if (sectionVisibility) projectSectionVisibility.set(project.id, sectionVisibility);

    req.log.info({ project_id: project.id }, "Admin: project created");
    res.status(201).json(formatProject(project));
  } catch (err) {
    req.log.error({ err }, "Admin: failed to create project");
    res.status(500).json({ message: "Erro interno" });
  }
});

router.get("/admin/projects/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) { res.status(404).json({ message: "Projeto não encontrado" }); return; }
    res.json(formatProject(project));
  } catch (err) {
    req.log.error({ err }, "Admin: failed to get project");
    res.status(500).json({ message: "Erro interno" });
  }
});

router.patch("/admin/projects/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const {
      clientName, clientEmail, clientPhone, systemPower, statusStep,
      city, state, valorProjeto, formaDePagamento, observacoesGerais,
      notes, estimatedActivation, trackingCode, trackingCarrier,
      dataInicioPrevista, dataConclusaoPrevista, dataDeFechamento,
      dataDePagamento, dataDeCompras, dataDeEntregaDoEquipamento,
      schedulingLink, sectionVisibility,
    } = req.body;

    const updateData: Partial<typeof projectsTable.$inferInsert> = {};
    if (clientName !== undefined) updateData.clientName = clientName;
    if (clientEmail !== undefined) updateData.clientEmail = String(clientEmail).toLowerCase();
    if (clientPhone !== undefined) updateData.clientPhone = clientPhone || null;
    if (systemPower !== undefined) updateData.systemPower = Number(systemPower);
    if (statusStep !== undefined) {
      const step = Number(statusStep);
      updateData.statusStep = step;
      updateData.completionPercent = stepCompletionPercent(step);
    }
    if (city !== undefined) updateData.city = city;
    if (state !== undefined) updateData.state = state;
    if (valorProjeto !== undefined) updateData.valorProjeto = valorProjeto ? Number(valorProjeto) : null;
    if (formaDePagamento !== undefined) updateData.formaDePagamento = formaDePagamento || null;
    if (observacoesGerais !== undefined) updateData.observacoesGerais = observacoesGerais || null;
    if (notes !== undefined) updateData.notes = notes || null;
    if (estimatedActivation !== undefined) updateData.estimatedActivation = estimatedActivation || null;
    if (trackingCode !== undefined) updateData.trackingCode = trackingCode || null;
    if (trackingCarrier !== undefined) updateData.trackingCarrier = trackingCarrier || null;
    if (dataInicioPrevista !== undefined) updateData.dataInicioPrevista = dataInicioPrevista || null;
    if (dataConclusaoPrevista !== undefined) updateData.dataConclusaoPrevista = dataConclusaoPrevista || null;
    if (dataDeFechamento !== undefined) updateData.dataDeFechamento = dataDeFechamento || null;
    if (dataDePagamento !== undefined) updateData.dataDePagamento = dataDePagamento || null;
    if (dataDeCompras !== undefined) updateData.dataDeCompras = dataDeCompras || null;
    if (dataDeEntregaDoEquipamento !== undefined) updateData.dataDeEntregaDoEquipamento = dataDeEntregaDoEquipamento || null;

    if (schedulingLink !== undefined) {
      if (schedulingLink) projectSchedulingLink.set(id, schedulingLink);
      else projectSchedulingLink.delete(id);
    }
    if (sectionVisibility !== undefined) {
      projectSectionVisibility.set(id, sectionVisibility);
    }

    const [updated] = Object.keys(updateData).length > 0
      ? await db.update(projectsTable).set(updateData).where(eq(projectsTable.id, id)).returning()
      : await db.select().from(projectsTable).where(eq(projectsTable.id, id));

    if (!updated) { res.status(404).json({ message: "Projeto não encontrado" }); return; }
    res.json(formatProject(updated));
  } catch (err) {
    req.log.error({ err }, "Admin: failed to update project");
    res.status(500).json({ message: "Erro interno" });
  }
});

router.delete("/admin/projects/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(projectsTable).where(eq(projectsTable.id, id));
    projectSectionVisibility.delete(id);
    projectSchedulingLink.delete(id);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin: failed to delete project");
    res.status(500).json({ message: "Erro interno" });
  }
});

// ─── Documents ────────────────────────────────────────────────────────────────

function formatDocument(d: typeof documentsTable.$inferSelect) {
  return {
    id: d.id,
    projectId: d.projectId,
    name: d.name,
    type: d.type,
    category: d.category,
    displayCategory: getDocumentDisplayCategory(d.id, d.category),
    required: d.required,
    description: d.description ?? null,
    fileUrl: d.fileUrl ?? null,
    objectPath: d.objectPath ?? null,
    uploadedAt: d.uploadedAt ? d.uploadedAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
  };
}

router.get("/admin/projects/:id/documents", requireAdmin, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const docs = await db.select().from(documentsTable).where(eq(documentsTable.projectId, projectId)).orderBy(documentsTable.createdAt);
    res.json(docs.map(formatDocument));
  } catch (err) {
    req.log.error({ err }, "Admin: failed to list documents");
    res.status(500).json({ message: "Erro interno" });
  }
});

router.post("/admin/projects/:id/documents", requireAdmin, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const { name, category, displayCategory, required, description } = req.body;
    if (!name || !category) { res.status(400).json({ message: "name e category são obrigatórios" }); return; }

    const [doc] = await db.insert(documentsTable).values({
      projectId, name, type: "pending_upload",
      category, required: Boolean(required), description: description || null,
    }).returning();

    if (displayCategory) documentDisplayCategory.set(doc.id, displayCategory);
    res.status(201).json(formatDocument(doc));
  } catch (err) {
    req.log.error({ err }, "Admin: failed to create document");
    res.status(500).json({ message: "Erro interno" });
  }
});

router.patch("/admin/documents/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { name, category, displayCategory, required, description } = req.body;

    const update: Partial<typeof documentsTable.$inferInsert> = {};
    if (name !== undefined) update.name = name;
    if (category !== undefined) update.category = category;
    if (required !== undefined) update.required = Boolean(required);
    if (description !== undefined) update.description = description || null;

    if (displayCategory !== undefined) {
      if (displayCategory) documentDisplayCategory.set(id, displayCategory);
      else documentDisplayCategory.delete(id);
    }

    const [updated] = Object.keys(update).length > 0
      ? await db.update(documentsTable).set(update).where(eq(documentsTable.id, id)).returning()
      : await db.select().from(documentsTable).where(eq(documentsTable.id, id));

    if (!updated) { res.status(404).json({ message: "Documento não encontrado" }); return; }
    res.json(formatDocument(updated));
  } catch (err) {
    req.log.error({ err }, "Admin: failed to update document");
    res.status(500).json({ message: "Erro interno" });
  }
});

router.post("/admin/documents/:id/upload", requireAdmin, uploadSingle, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!req.file) { res.status(400).json({ message: "Arquivo não enviado" }); return; }
  const { mimetype, buffer } = req.file;
  if (!ALLOWED_CONTENT_TYPES.includes(mimetype)) {
    res.status(400).json({ message: "Tipo de arquivo não permitido. Use PDF, JPG ou PNG." }); return;
  }
  try {
    const [doc] = await db.select().from(documentsTable).where(eq(documentsTable.id, id));
    if (!doc) { res.status(404).json({ message: "Documento não encontrado" }); return; }

    const uploadURL = await objectStorage.getObjectEntityUploadURL();
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
    const gcsRes = await fetch(uploadURL, { method: "PUT", body: buffer, headers: { "Content-Type": mimetype } });
    if (!gcsRes.ok) { res.status(502).json({ message: "Falha ao enviar para o armazenamento" }); return; }

    const fileUrl = `/api/storage${objectPath}`;
    const [updated] = await db.update(documentsTable)
      .set({ fileUrl, objectPath, uploadedAt: new Date(), type: "available_download" })
      .where(eq(documentsTable.id, id)).returning();

    res.json(formatDocument(updated));
  } catch (err) {
    req.log.error({ err }, "Admin: failed to upload document");
    res.status(500).json({ message: "Erro interno" });
  }
});

router.delete("/admin/documents/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(documentsTable).where(eq(documentsTable.id, id));
    documentDisplayCategory.delete(id);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin: failed to delete document");
    res.status(500).json({ message: "Erro interno" });
  }
});

// ─── Payments ─────────────────────────────────────────────────────────────────

function formatPayment(p: typeof paymentsTable.$inferSelect) {
  return {
    id: p.id, projectId: p.projectId,
    installmentNumber: p.installmentNumber, amount: p.amount,
    dueDate: p.dueDate, paidDate: p.paidDate ?? null,
    status: p.status, description: p.description ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/admin/projects/:id/payments", requireAdmin, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const payments = await db.select().from(paymentsTable).where(eq(paymentsTable.projectId, projectId)).orderBy(paymentsTable.installmentNumber);
    res.json(payments.map(formatPayment));
  } catch (err) {
    req.log.error({ err }, "Admin: failed to list payments"); res.status(500).json({ message: "Erro interno" });
  }
});

router.post("/admin/projects/:id/payments", requireAdmin, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const { installmentNumber, amount, dueDate, paidDate, status, description } = req.body;
    if (!installmentNumber || amount === undefined || !dueDate) {
      res.status(400).json({ message: "installmentNumber, amount e dueDate são obrigatórios" }); return;
    }
    const [payment] = await db.insert(paymentsTable).values({
      projectId, installmentNumber: Number(installmentNumber), amount: Number(amount),
      dueDate, paidDate: paidDate || null, status: status ?? "pending", description: description || null,
    }).returning();
    res.status(201).json(formatPayment(payment));
  } catch (err) {
    req.log.error({ err }, "Admin: failed to create payment"); res.status(500).json({ message: "Erro interno" });
  }
});

router.patch("/admin/payments/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { installmentNumber, amount, dueDate, paidDate, status, description } = req.body;
    const update: Partial<typeof paymentsTable.$inferInsert> = {};
    if (installmentNumber !== undefined) update.installmentNumber = Number(installmentNumber);
    if (amount !== undefined) update.amount = Number(amount);
    if (dueDate !== undefined) update.dueDate = dueDate;
    if (paidDate !== undefined) update.paidDate = paidDate || null;
    if (status !== undefined) update.status = status;
    if (description !== undefined) update.description = description || null;
    const [updated] = await db.update(paymentsTable).set(update).where(eq(paymentsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ message: "Pagamento não encontrado" }); return; }
    res.json(formatPayment(updated));
  } catch (err) {
    req.log.error({ err }, "Admin: failed to update payment"); res.status(500).json({ message: "Erro interno" });
  }
});

router.delete("/admin/payments/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(paymentsTable).where(eq(paymentsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin: failed to delete payment"); res.status(500).json({ message: "Erro interno" });
  }
});

// ─── Notifications ────────────────────────────────────────────────────────────

router.get("/admin/projects/:id/notifications", requireAdmin, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const notifs = await db.select().from(notificationsTable).where(eq(notificationsTable.projectId, projectId)).orderBy(desc(notificationsTable.createdAt));
    res.json(notifs.map((n) => ({ id: n.id, projectId: n.projectId, title: n.title, message: n.message, read: n.read, createdAt: n.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Admin: failed to list notifications"); res.status(500).json({ message: "Erro interno" });
  }
});

router.post("/admin/projects/:id/notifications", requireAdmin, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const { title, message } = req.body;
    if (!title || !message) { res.status(400).json({ message: "title e message são obrigatórios" }); return; }
    const [notif] = await db.insert(notificationsTable).values({ projectId, title, message, read: false }).returning();
    res.status(201).json({ id: notif.id, projectId: notif.projectId, title: notif.title, message: notif.message, read: notif.read, createdAt: notif.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Admin: failed to create notification"); res.status(500).json({ message: "Erro interno" });
  }
});

router.delete("/admin/notifications/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(notificationsTable).where(eq(notificationsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Admin: failed to delete notification"); res.status(500).json({ message: "Erro interno" });
  }
});

// ─── Scheduling ───────────────────────────────────────────────────────────────

router.get("/admin/projects/:id/scheduling", requireAdmin, async (req, res) => {
  try {
    const projectId = parseInt(req.params.id, 10);
    const requests = await db.select().from(schedulingRequestsTable).where(eq(schedulingRequestsTable.projectId, projectId)).orderBy(desc(schedulingRequestsTable.createdAt));
    res.json(requests.map((r) => ({ id: r.id, projectId: r.projectId, requestedDate: r.requestedDate, notes: r.notes, status: r.status, createdAt: r.createdAt.toISOString() })));
  } catch (err) {
    req.log.error({ err }, "Admin: failed to list scheduling"); res.status(500).json({ message: "Erro interno" });
  }
});

router.patch("/admin/scheduling/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, requestedDate, notes } = req.body;
    const update: Partial<typeof schedulingRequestsTable.$inferInsert> = {};
    if (status !== undefined) update.status = status;
    if (requestedDate !== undefined) update.requestedDate = requestedDate;
    if (notes !== undefined) update.notes = notes || null;
    const [updated] = await db.update(schedulingRequestsTable).set(update).where(eq(schedulingRequestsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ message: "Agendamento não encontrado" }); return; }
    res.json({ id: updated.id, projectId: updated.projectId, requestedDate: updated.requestedDate, notes: updated.notes, status: updated.status, createdAt: updated.createdAt.toISOString() });
  } catch (err) {
    req.log.error({ err }, "Admin: failed to update scheduling"); res.status(500).json({ message: "Erro interno" });
  }
});

export { projectSchedulingLink, projectSectionVisibility };
export default router;
