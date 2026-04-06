import { Router, type IRouter, type Request, type Response } from "express";
import { resolveSession } from "../lib/auth";
import { db } from "@workspace/db";
import { schedulingRequestsTable, projectsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { sendWhatsApp } from "../lib/notifications";

const router: IRouter = Router();

const SOLO_TEAM_PHONE = process.env.SOLO_TEAM_PHONE ?? "5511999999999";

async function requireAuth(req: Request, res: Response): Promise<{ projectId: number } | null> {
  const token = req.cookies?.solo_session;
  if (!token) {
    res.status(401).json({ message: "Não autenticado" });
    return null;
  }
  const session = await resolveSession(token);
  if (!session) {
    res.status(401).json({ message: "Sessão expirada" });
    return null;
  }
  return session;
}

router.get("/scheduling", async (req: Request, res: Response) => {
  const session = await requireAuth(req, res);
  if (!session) return;

  const requests = await db
    .select()
    .from(schedulingRequestsTable)
    .where(eq(schedulingRequestsTable.projectId, session.projectId))
    .orderBy(desc(schedulingRequestsTable.createdAt));

  res.json(
    requests.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      requestedDate: r.requestedDate,
      notes: r.notes,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

router.post("/scheduling", async (req: Request, res: Response) => {
  const session = await requireAuth(req, res);
  if (!session) return;

  const { requestedDate, notes } = req.body as { requestedDate?: string; notes?: string };
  if (!requestedDate) {
    res.status(400).json({ message: "requestedDate é obrigatório" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, session.projectId));

  const [created] = await db
    .insert(schedulingRequestsTable)
    .values({ projectId: session.projectId, requestedDate, notes: notes ?? null })
    .returning();

  const clientName = project?.clientName ?? "Cliente";
  const message = `☀️ *Solo Energia* — Nova solicitação de agendamento\n\nCliente: *${clientName}*\nData preferida: *${requestedDate}*${notes ? `\nObservações: ${notes}` : ""}\n\nAcesse o painel para confirmar.`;

  sendWhatsApp(SOLO_TEAM_PHONE, message).catch(() => {});

  res.status(201).json({
    id: created.id,
    projectId: created.projectId,
    requestedDate: created.requestedDate,
    notes: created.notes,
    status: created.status,
    createdAt: created.createdAt.toISOString(),
  });
});

export default router;
