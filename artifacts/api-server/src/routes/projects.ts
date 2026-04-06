import { Router, type IRouter, type Request, type Response, type NextFunction, type RequestHandler } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { projectsTable, documentsTable, notificationsTable, paymentsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { getJestorProject, mapJestorStatusToStep, stepCompletionPercent } from "../lib/jestor";
import { resolveSession } from "../lib/auth";
import { ObjectStorageService } from "../lib/objectStorage";

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

const router: IRouter = Router();

declare global {
  namespace Express {
    interface Request {
      sessionProjectId?: number;
    }
  }
}

async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.solo_session;
  if (!token) {
    res.status(401).json({ message: "Não autenticado" });
    return;
  }
  const session = await resolveSession(token);
  if (!session) {
    res.clearCookie("solo_session", { path: "/" });
    res.status(401).json({ message: "Sessão expirada — faça login novamente" });
    return;
  }
  req.sessionProjectId = session.projectId;
  next();
}

function formatProject(p: typeof projectsTable.$inferSelect) {
  return {
    id: p.id,
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
    createdAt: p.createdAt.toISOString(),
  };
}

router.get("/projects", requireAuth, async (req, res) => {
  try {
    const project = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, req.sessionProjectId!))
      .limit(1);
    res.json(project.map(formatProject));
  } catch (err) {
    req.log.error({ err }, "Failed to list projects");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/projects/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (id !== req.sessionProjectId) {
      res.status(403).json({ message: "Acesso negado" });
      return;
    }
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }
    res.json(formatProject(project));
  } catch (err) {
    req.log.error({ err }, "Failed to get project");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/jestor/sync/:jestorId", async (req, res) => {
  const { jestorId } = req.params;

  try {
    const jestorData = await getJestorProject(jestorId);
    if (!jestorData) {
      res.status(404).json({ message: "Project not found in Jestor or Jestor API not configured" });
      return;
    }

    const newStep = mapJestorStatusToStep(jestorData.status_projeto as string | undefined);
    const newPercent = stepCompletionPercent(newStep);

    const [existing] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.jestorId, jestorId));

    let project;

    if (existing) {
      [project] = await db
        .update(projectsTable)
        .set({
          statusStep: newStep,
          statusProjeto: (jestorData.status_projeto as string | undefined) ?? existing.statusProjeto,
          completionPercent: newPercent,
          dataInicioPrevista: (jestorData.data_inicio_prevista as string | undefined) ?? existing.dataInicioPrevista,
          dataConclusaoPrevista: (jestorData.data_conclusao_prevista as string | undefined) ?? existing.dataConclusaoPrevista,
          dataDeFechamento: (jestorData.data_de_fechamento as string | undefined) ?? existing.dataDeFechamento,
          dataDePagamento: (jestorData.data_de_pagamento as string | undefined) ?? existing.dataDePagamento,
          dataDeCompras: (jestorData.data_de_compras as string | undefined) ?? existing.dataDeCompras,
          dataDeEntregaDoEquipamento: (jestorData.data_de_entrega_do_equipamento as string | undefined) ?? existing.dataDeEntregaDoEquipamento,
          valorProjeto: (jestorData.valor_projeto as number | undefined) ?? existing.valorProjeto,
          formaDePagamento: (jestorData.forma_de_pagamento as string | undefined) ?? existing.formaDePagamento,
          observacoesGerais: ((jestorData.observacoes_gerais ?? jestorData.observacoes) as string | undefined) ?? existing.observacoesGerais,
        })
        .where(eq(projectsTable.id, existing.id))
        .returning();
    } else {
      [project] = await db
        .insert(projectsTable)
        .values({
          jestorId,
          clientName: (jestorData.name as string) ?? "Cliente Jestor",
          clientEmail: (jestorData.client_email as string) ?? "",
          clientPhone: (jestorData.client_phone as string | undefined) ?? null,
          systemPower: (jestorData.system_power as number | undefined) ?? 0,
          statusStep: newStep,
          statusProjeto: (jestorData.status_projeto as string | undefined) ?? null,
          completionPercent: newPercent,
          city: (jestorData.city as string | undefined) ?? "",
          state: (jestorData.state as string | undefined) ?? "",
          dataInicioPrevista: (jestorData.data_inicio_prevista as string | undefined) ?? null,
          dataConclusaoPrevista: (jestorData.data_conclusao_prevista as string | undefined) ?? null,
          dataDeFechamento: (jestorData.data_de_fechamento as string | undefined) ?? null,
          dataDePagamento: (jestorData.data_de_pagamento as string | undefined) ?? null,
          dataDeCompras: (jestorData.data_de_compras as string | undefined) ?? null,
          dataDeEntregaDoEquipamento: (jestorData.data_de_entrega_do_equipamento as string | undefined) ?? null,
          valorProjeto: (jestorData.valor_projeto as number | undefined) ?? null,
          formaDePagamento: (jestorData.forma_de_pagamento as string | undefined) ?? null,
          observacoesGerais: ((jestorData.observacoes_gerais ?? jestorData.observacoes) as string | undefined) ?? null,
        })
        .returning();
    }

    req.log.info({ jestorId, project_id: project.id }, "Project synced from Jestor API");
    res.json(formatProject(project));
  } catch (err) {
    req.log.error({ err }, "Failed to sync project from Jestor");
    res.status(500).json({ message: "Internal server error" });
  }
});

function formatDocument(d: typeof documentsTable.$inferSelect) {
  return {
    id: d.id,
    projectId: d.projectId,
    name: d.name,
    type: d.type,
    category: d.category,
    required: d.required,
    description: d.description ?? null,
    fileUrl: d.fileUrl ?? null,
    uploadedAt: d.uploadedAt ? d.uploadedAt.toISOString() : null,
    createdAt: d.createdAt.toISOString(),
  };
}

router.get("/documents", requireAuth, async (req, res) => {
  try {
    const docs = await db
      .select()
      .from(documentsTable)
      .where(eq(documentsTable.projectId, req.sessionProjectId!));
    res.json(docs.map(formatDocument));
  } catch (err) {
    req.log.error({ err }, "Failed to list documents");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/documents/:id/upload", requireAuth, uploadSingle, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) {
    res.status(400).json({ message: "ID inválido" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ message: "Arquivo não enviado" });
    return;
  }

  const { mimetype, buffer } = req.file;

  if (!ALLOWED_CONTENT_TYPES.includes(mimetype)) {
    res.status(400).json({ message: "Tipo de arquivo não permitido. Use PDF, JPG ou PNG." });
    return;
  }

  try {
    const [doc] = await db
      .select()
      .from(documentsTable)
      .where(and(eq(documentsTable.id, id), eq(documentsTable.projectId, req.sessionProjectId!)));

    if (!doc) {
      res.status(404).json({ message: "Documento não encontrado" });
      return;
    }

    if (doc.category !== "entrada") {
      res.status(403).json({ message: "Upload não permitido para este tipo de documento" });
      return;
    }

    const uploadURL = await objectStorage.getObjectEntityUploadURL();
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);

    const gcsRes = await fetch(uploadURL, {
      method: "PUT",
      body: buffer,
      headers: { "Content-Type": mimetype },
    });

    if (!gcsRes.ok) {
      req.log.error({ status: gcsRes.status }, "GCS upload failed");
      res.status(502).json({ message: "Falha ao enviar para o armazenamento" });
      return;
    }

    const fileUrl = `/api/storage${objectPath}`;
    const uploadedAt = new Date();

    const [updated] = await db
      .update(documentsTable)
      .set({ fileUrl, objectPath, uploadedAt, type: "available_download" })
      .where(eq(documentsTable.id, id))
      .returning();

    res.json(formatDocument(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to upload document");
    res.status(500).json({ message: "Erro interno" });
  }
});

router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const notifs = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.projectId, req.sessionProjectId!))
      .orderBy(notificationsTable.createdAt);
    res.json(
      notifs.map((n) => ({
        id: n.id,
        projectId: n.projectId,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list notifications");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const [notification] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, id));
    if (!notification || notification.projectId !== req.sessionProjectId) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }
    const [updated] = await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.id, id))
      .returning();
    res.json({
      id: updated.id,
      projectId: updated.projectId,
      title: updated.title,
      message: updated.message,
      read: updated.read,
      createdAt: updated.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to mark notification as read");
    res.status(500).json({ message: "Internal server error" });
  }
});

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

router.get("/payments", requireAuth, async (req, res) => {
  try {
    const payments = await db
      .select()
      .from(paymentsTable)
      .where(eq(paymentsTable.projectId, req.sessionProjectId!))
      .orderBy(paymentsTable.installmentNumber);
    res.json(payments.map(formatPayment));
  } catch (err) {
    req.log.error({ err }, "Failed to list payments");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
