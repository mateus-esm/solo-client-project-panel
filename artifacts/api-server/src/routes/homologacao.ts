import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  homologacaoTechniciansTable,
  projectsTable,
  documentsTable,
  servicesTable,
  projectChecklistItemsTable,
  notificationsTable,
  STAGE_TO_CLIENT_STEP,
  STAGE_LABELS,
  type PipelineStage,
} from "@workspace/db/schema";
import { eq, asc, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import {
  hashPassword,
  verifyPassword,
  createHomologacaoSession,
  deleteHomologacaoSession,
  requireHomologacao,
  HOMOLOGACAO_COOKIE,
  type AuthenticatedRequest,
} from "../lib/homologacaoAuth";
import { stepCompletionPercent } from "../lib/jestor";

const router: IRouter = Router();

/**
 * Stages a homologação technician may transition a project to.
 * They cannot jump a project to an unrelated pipeline stage.
 */
const ALLOWED_TECHNICIAN_STAGES = [
  "homologacao",  // stay / re-open
  "pendencias",   // blocked — waiting on something
  "pausado",      // on hold
  "compras",      // approved — hand off to next stage
] as const;

type AllowedStage = (typeof ALLOWED_TECHNICIAN_STAGES)[number];

const allowedStageSchema = z.enum(ALLOWED_TECHNICIAN_STAGES);

// ─── Auth ─────────────────────────────────────────────────────────────────────

router.post("/homologacao/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ message: "Email e senha são obrigatórios" });
      return;
    }
    const [tech] = await db
      .select()
      .from(homologacaoTechniciansTable)
      .where(eq(homologacaoTechniciansTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!tech || !verifyPassword(password, tech.passwordHash)) {
      res.status(401).json({ message: "Credenciais inválidas" });
      return;
    }

    const token = await createHomologacaoSession(tech.id);
    res.cookie(HOMOLOGACAO_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    res.json({ ok: true, name: tech.name, email: tech.email });
  } catch (err) {
    req.log.error({ err }, "Homologacao login failed");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/homologacao/auth/logout", async (req, res) => {
  const token = req.cookies?.[HOMOLOGACAO_COOKIE];
  if (token) await deleteHomologacaoSession(token);
  res.clearCookie(HOMOLOGACAO_COOKIE, { path: "/" });
  res.json({ ok: true });
});

router.get("/homologacao/auth/check", requireHomologacao, (req: AuthenticatedRequest, res) => {
  res.json({ ok: true, name: req.technician!.name, email: req.technician!.email });
});

// ─── Helper: assert project is in homologacao scope ───────────────────────────

/**
 * Returns the project row only when it belongs to the homologação scope
 * (stage = homologacao, pendencias, or pausado — i.e. currently held or
 * blocked in homologação). Returns null otherwise.
 */
async function requireHomologacaoProject(id: number) {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));

  if (!project) return null;

  // Allow access to projects whose current stage is homologacao, or which have
  // been paused/blocked while in the homologação workflow.
  const accessibleStages: string[] = ["homologacao", "pendencias", "pausado"];
  if (!accessibleStages.includes(project.stage)) {
    return null; // treat as not found — prevents information leakage
  }

  return project;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

router.get("/homologacao/projects", requireHomologacao, async (req, res) => {
  try {
    // Return all projects in scope: active homologação plus paused/blocked ones
    // so technicians can track and update anything they're responsible for.
    const IN_SCOPE_STAGES = ["homologacao", "pendencias", "pausado"] as const;
    const projects = await db
      .select()
      .from(projectsTable)
      .where(inArray(projectsTable.stage, [...IN_SCOPE_STAGES]))
      .orderBy(asc(projectsTable.id));
    res.json(projects);
  } catch (err) {
    req.log.error({ err }, "Failed to list homologacao projects");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/homologacao/projects/:id", requireHomologacao, async (req, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }

    const project = await requireHomologacaoProject(id);
    if (!project) {
      res.status(404).json({ message: "Projeto não encontrado" });
      return;
    }

    const [checklist, documents, services] = await Promise.all([
      db
        .select()
        .from(projectChecklistItemsTable)
        .where(eq(projectChecklistItemsTable.projectId, id))
        .orderBy(
          asc(projectChecklistItemsTable.sortOrder),
          asc(projectChecklistItemsTable.id)
        ),
      db
        .select()
        .from(documentsTable)
        .where(eq(documentsTable.projectId, id))
        .orderBy(asc(documentsTable.id)),
      db
        .select()
        .from(servicesTable)
        .where(eq(servicesTable.projectId, id))
        .orderBy(asc(servicesTable.id)),
    ]);

    res.json({ project, checklist, documents, services });
  } catch (err) {
    req.log.error({ err }, "Failed to get homologacao project detail");
    res.status(500).json({ message: "Internal server error" });
  }
});

const updateSchema = z.object({
  stage: allowedStageSchema.optional(),
  notes: z.string().optional(),
  estimatedActivation: z.string().optional(),
});

router.patch("/homologacao/projects/:id", requireHomologacao, async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }

    // Verify project is in homologacao scope before applying any update.
    const current = await requireHomologacaoProject(id);
    if (!current) {
      res.status(404).json({ message: "Projeto não encontrado" });
      return;
    }

    const patch: Record<string, unknown> = {};
    if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
    if (parsed.data.estimatedActivation !== undefined)
      patch.estimatedActivation = parsed.data.estimatedActivation;

    const stageChanged =
      parsed.data.stage !== undefined && parsed.data.stage !== current.stage;

    if (stageChanged) {
      const newStage = parsed.data.stage as AllowedStage;
      patch.stage = newStage;
      const step = STAGE_TO_CLIENT_STEP[newStage as PipelineStage];
      if (step !== null && step !== undefined) {
        patch.statusStep = step;
        patch.completionPercent = stepCompletionPercent(step);
      }
    }

    const [updated] = await db
      .update(projectsTable)
      .set(patch)
      .where(eq(projectsTable.id, id))
      .returning();

    if (stageChanged) {
      const label = STAGE_LABELS[(parsed.data.stage as PipelineStage)] ?? parsed.data.stage;
      await db.insert(notificationsTable).values({
        projectId: id,
        title: "Atualização do projeto",
        message: `Seu projeto avançou para a etapa: ${label}`,
      });
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update homologacao project");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Checklist ────────────────────────────────────────────────────────────────

const checklistUpdateSchema = z.object({
  done: z.boolean().optional(),
});

router.patch("/homologacao/checklist/:itemId", requireHomologacao, async (req: AuthenticatedRequest, res) => {
  try {
    const itemId = parseInt(req.params.itemId as string, 10);
    if (isNaN(itemId)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }

    const parsed = checklistUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }

    // Fetch the checklist item first to verify it belongs to a homologacao-scope project.
    const [existingItem] = await db
      .select()
      .from(projectChecklistItemsTable)
      .where(eq(projectChecklistItemsTable.id, itemId));

    if (!existingItem) {
      res.status(404).json({ message: "Item não encontrado" });
      return;
    }

    // Verify the owning project is in homologação scope.
    const owningProject = await requireHomologacaoProject(existingItem.projectId);
    if (!owningProject) {
      res.status(404).json({ message: "Item não encontrado" });
      return;
    }

    // Attribution always comes from the authenticated technician identity,
    // never from a client-supplied value.
    const patch: Record<string, unknown> = {};
    if (parsed.data.done !== undefined) {
      patch.done = parsed.data.done;
      patch.doneBy = parsed.data.done ? req.technician!.name : null;
      patch.doneAt = parsed.data.done ? new Date() : null;
    }

    const [item] = await db
      .update(projectChecklistItemsTable)
      .set(patch)
      .where(eq(projectChecklistItemsTable.id, itemId))
      .returning();

    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to update checklist item");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
