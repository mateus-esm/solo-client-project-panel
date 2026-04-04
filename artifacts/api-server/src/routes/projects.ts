import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, documentsTable, notificationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { getJestorProject, mapJestorStatusToStep, stepCompletionPercent } from "../lib/jestor";

const router: IRouter = Router();

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

router.get("/projects", async (req, res) => {
  try {
    const projects = await db.select().from(projectsTable).orderBy(projectsTable.id);
    res.json(projects.map(formatProject));
  } catch (err) {
    req.log.error({ err }, "Failed to list projects");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
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

/**
 * GET /api/jestor/sync/:jestorId
 * Manually syncs a project from the Jestor API and updates the portal DB.
 */
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
          statusProjeto: (jestorData.status_projeto as string) ?? existing.statusProjeto,
          completionPercent: newPercent,
          dataInicioPrevista: (jestorData.data_inicio_prevista as string) ?? existing.dataInicioPrevista,
          dataConclusaoPrevista: (jestorData.data_conclusao_prevista as string) ?? existing.dataConclusaoPrevista,
          dataDeFechamento: (jestorData.data_de_fechamento as string) ?? existing.dataDeFechamento,
          dataDePagamento: (jestorData.data_de_pagamento as string) ?? existing.dataDePagamento,
          dataDeCompras: (jestorData.data_de_compras as string) ?? existing.dataDeCompras,
          dataDeEntregaDoEquipamento: (jestorData.data_de_entrega_do_equipamento as string) ?? existing.dataDeEntregaDoEquipamento,
          valorProjeto: (jestorData.valor_projeto as number) ?? existing.valorProjeto,
          formaDePagamento: (jestorData.forma_de_pagamento as string) ?? existing.formaDePagamento,
          observacoesGerais: (jestorData.observacoes_gerais as string) ?? existing.observacoesGerais,
        })
        .where(eq(projectsTable.id, existing.id))
        .returning();
    } else {
      res.status(404).json({ message: "Project not found in portal. Create it via webhook first." });
      return;
    }

    req.log.info({ jestorId, project_id: project.id }, "Project synced from Jestor API");
    res.json(formatProject(project));
  } catch (err) {
    req.log.error({ err }, "Failed to sync project from Jestor");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/documents", async (req, res) => {
  try {
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string, 10) : undefined;
    const docs = projectId
      ? await db.select().from(documentsTable).where(eq(documentsTable.projectId, projectId))
      : await db.select().from(documentsTable);
    res.json(
      docs.map((d) => ({
        id: d.id,
        projectId: d.projectId,
        name: d.name,
        type: d.type,
        category: d.category,
        required: d.required,
        description: d.description,
        fileUrl: d.fileUrl,
        createdAt: d.createdAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to list documents");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/notifications", async (req, res) => {
  try {
    const projectId = req.query.projectId ? parseInt(req.query.projectId as string, 10) : undefined;
    const notifs = projectId
      ? await db
          .select()
          .from(notificationsTable)
          .where(eq(notificationsTable.projectId, projectId))
          .orderBy(notificationsTable.createdAt)
      : await db.select().from(notificationsTable).orderBy(notificationsTable.createdAt);
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

router.patch("/notifications/:id/read", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [updated] = await db
      .update(notificationsTable)
      .set({ read: true })
      .where(eq(notificationsTable.id, id))
      .returning();
    if (!updated) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }
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

export default router;
