import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  notificationsTable,
  projectChecklistItemsTable,
  servicesTable,
  insertProjectSchema,
  insertChecklistItemSchema,
  STAGE_TO_CLIENT_STEP,
  STAGE_LABELS,
  PIPELINE_STAGES,
  type PipelineStage,
} from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { z } from "zod/v4";
import { stepCompletionPercent } from "../../lib/jestor";

const router: IRouter = Router();

const stageSchema = z.enum(PIPELINE_STAGES);

const createProjectSchema = insertProjectSchema.extend({
  stage: stageSchema.default("onboarding"),
});

// Derived from insertProjectSchema, not from createProjectSchema: `.partial()` does not
// strip an explicit `.default()`, so reusing the create schema would inject
// stage="onboarding" into every PATCH and silently reset the project's stage.
const updateProjectSchema = insertProjectSchema.partial().extend({
  stage: stageSchema.optional(),
});

function clientStepPatch(stage: PipelineStage): {
  statusStep?: number;
  completionPercent?: number;
} {
  const step = STAGE_TO_CLIENT_STEP[stage];
  if (step === null) return {}; // pendências/pausado keep the client stepper where it is
  // Reuses the portal's existing step->percent curve so the client view stays consistent
  // with projects synced from Jestor.
  const completionPercent = stage === "concluido" ? 100 : stepCompletionPercent(step);
  return { statusStep: step, completionPercent };
}

router.get("/projects", async (req, res) => {
  try {
    const stageFilter = req.query.stage ? stageSchema.parse(req.query.stage) : undefined;
    const projects = stageFilter
      ? await db.select().from(projectsTable).where(eq(projectsTable.stage, stageFilter)).orderBy(asc(projectsTable.id))
      : await db.select().from(projectsTable).orderBy(asc(projectsTable.id));
    res.json(projects);
  } catch (err) {
    req.log.error({ err }, "Failed to list internal projects");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/projects", async (req, res) => {
  try {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const patch = clientStepPatch(parsed.data.stage as PipelineStage);
    const [project] = await db
      .insert(projectsTable)
      .values({ ...parsed.data, ...patch })
      .returning();
    res.status(201).json(project);
  } catch (err) {
    req.log.error({ err }, "Failed to create project");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) {
      res.status(404).json({ message: "Projeto não encontrado" });
      return;
    }
    const checklist = await db
      .select()
      .from(projectChecklistItemsTable)
      .where(eq(projectChecklistItemsTable.projectId, id))
      .orderBy(asc(projectChecklistItemsTable.sortOrder), asc(projectChecklistItemsTable.id));
    const services = await db
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.projectId, id))
      .orderBy(asc(servicesTable.id));
    res.json({ project, checklist, services });
  } catch (err) {
    req.log.error({ err }, "Failed to get project detail");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/projects/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const parsed = updateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }

    const [current] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!current) {
      res.status(404).json({ message: "Projeto não encontrado" });
      return;
    }

    const stageChanged =
      parsed.data.stage !== undefined && parsed.data.stage !== current.stage;
    const patch = stageChanged
      ? clientStepPatch(parsed.data.stage as PipelineStage)
      : {};

    const [updated] = await db
      .update(projectsTable)
      .set({ ...parsed.data, ...patch })
      .where(eq(projectsTable.id, id))
      .returning();

    if (stageChanged) {
      const label = STAGE_LABELS[parsed.data.stage as PipelineStage];
      await db.insert(notificationsTable).values({
        projectId: id,
        title: "Atualização do projeto",
        message: `Seu projeto avançou para a etapa: ${label}`,
      });
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update project");
    res.status(500).json({ message: "Internal server error" });
  }
});

// --- Checklist ---

const createItemSchema = insertChecklistItemSchema.omit({ projectId: true });

router.get("/projects/:id/checklist", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const items = await db
      .select()
      .from(projectChecklistItemsTable)
      .where(eq(projectChecklistItemsTable.projectId, id))
      .orderBy(asc(projectChecklistItemsTable.sortOrder), asc(projectChecklistItemsTable.id));
    res.json(items);
  } catch (err) {
    req.log.error({ err }, "Failed to list checklist");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/projects/:id/checklist", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const parsed = createItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [item] = await db
      .insert(projectChecklistItemsTable)
      .values({ ...parsed.data, projectId: id })
      .returning();
    res.status(201).json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to add checklist item");
    res.status(500).json({ message: "Internal server error" });
  }
});

const updateItemSchema = z.object({
  done: z.boolean().optional(),
  label: z.string().min(1).optional(),
  doneBy: z.string().min(1).optional(),
});

router.patch("/checklist/:itemId", async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId, 10);
    const parsed = updateItemSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const patch: Record<string, unknown> = {};
    if (parsed.data.label !== undefined) patch.label = parsed.data.label;
    if (parsed.data.done !== undefined) {
      patch.done = parsed.data.done;
      // Admin auth is a shared password with no per-user identity, so the operator name
      // must come from the client. Falls back to "admin" rather than inventing one.
      patch.doneBy = parsed.data.done ? (parsed.data.doneBy ?? "admin") : null;
      patch.doneAt = parsed.data.done ? new Date() : null;
    }
    const [item] = await db
      .update(projectChecklistItemsTable)
      .set(patch)
      .where(eq(projectChecklistItemsTable.id, itemId))
      .returning();
    if (!item) {
      res.status(404).json({ message: "Item não encontrado" });
      return;
    }
    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to update checklist item");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/checklist/:itemId", async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId, 10);
    await db.delete(projectChecklistItemsTable).where(eq(projectChecklistItemsTable.id, itemId));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete checklist item");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
