import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, documentsTable, notificationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/projects", async (req, res) => {
  try {
    const projects = await db.select().from(projectsTable).orderBy(projectsTable.id);
    const result = projects.map((p) => ({
      id: p.id,
      clientName: p.clientName,
      clientEmail: p.clientEmail,
      systemPower: p.systemPower,
      statusStep: p.statusStep,
      trackingCode: p.trackingCode,
      trackingCarrier: p.trackingCarrier,
      city: p.city,
      state: p.state,
      completionPercent: p.completionPercent,
      estimatedActivation: p.estimatedActivation,
      notes: p.notes,
      estimatedDate: p.estimatedDate,
      createdAt: p.createdAt.toISOString(),
    }));
    res.json(result);
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
    res.json({
      id: project.id,
      clientName: project.clientName,
      clientEmail: project.clientEmail,
      systemPower: project.systemPower,
      statusStep: project.statusStep,
      trackingCode: project.trackingCode,
      trackingCarrier: project.trackingCarrier,
      city: project.city,
      state: project.state,
      completionPercent: project.completionPercent,
      estimatedActivation: project.estimatedActivation,
      notes: project.notes,
      estimatedDate: project.estimatedDate,
      createdAt: project.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get project");
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
      ? await db.select().from(notificationsTable).where(eq(notificationsTable.projectId, projectId))
      : await db.select().from(notificationsTable);
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

export default router;
