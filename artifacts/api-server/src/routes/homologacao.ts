import { Router, type IRouter, type RequestHandler } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import {
  homologacaoTechniciansTable,
  homologacaoProcessosTable,
  HOMOLOGACAO_KANBAN_STAGES,
  projectsTable,
  documentsTable,
  servicesTable,
  projectChecklistItemsTable,
  notificationsTable,
  STAGE_TO_CLIENT_STEP,
  STAGE_LABELS,
  type PipelineStage,
} from "@workspace/db/schema";
import { eq, asc, inArray, and } from "drizzle-orm";
import { z } from "zod/v4";
import { ObjectStorageService } from "../lib/objectStorage";
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

const objectStorage = new ObjectStorageService();
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const _upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_SIZE } });
const uploadSingle: RequestHandler = (req, res, next) => {
  _upload.single("file")(req, res, (err) => {
    if (err) {
      res.status(400).json({ message: "Arquivo inválido ou muito grande (máx. 10MB)" });
      return;
    }
    next();
  });
};

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
async function requireHomologacaoProject(id: number, technicianId: number) {
  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, id));

  if (!project) return null;

  // Only the assigned technician may access the project.
  if (project.homologacaoTechnicianId !== technicianId) {
    return null; // treat as not found — prevents information leakage
  }

  // Allow access to projects whose current stage is homologacao, or which have
  // been paused/blocked while in the homologação workflow.
  const accessibleStages: string[] = ["homologacao", "pendencias", "pausado"];
  if (!accessibleStages.includes(project.stage)) {
    return null; // treat as not found — prevents information leakage
  }

  return project;
}

// ─── Ficha do processo (helpers) ──────────────────────────────────────────────

const kanbanStageSchema = z.enum(HOMOLOGACAO_KANBAN_STAGES);

const processoPatchSchema = z.object({
  kanbanStage: kanbanStageSchema.optional(),
  ucNumero: z.string().nullable().optional(),
  numeroSolicitacao: z.string().nullable().optional(),
  linksEnel: z.string().nullable().optional(),
  emailAcompanhamento: z.string().nullable().optional(),
  datasPrevistas: z.partialRecord(kanbanStageSchema, z.string()).optional(),
  artPaga: z.boolean().optional(),
});

async function getOrCreateProcesso(projectId: number) {
  const [existing] = await db
    .select()
    .from(homologacaoProcessosTable)
    .where(eq(homologacaoProcessosTable.projectId, projectId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(homologacaoProcessosTable)
    .values({ projectId })
    .onConflictDoNothing({ target: homologacaoProcessosTable.projectId })
    .returning();
  if (created) return created;
  const [row] = await db
    .select()
    .from(homologacaoProcessosTable)
    .where(eq(homologacaoProcessosTable.projectId, projectId))
    .limit(1);
  return row;
}

async function patchProcesso(projectId: number, data: z.infer<typeof processoPatchSchema>) {
  await getOrCreateProcesso(projectId);
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (data.kanbanStage !== undefined) patch.kanbanStage = data.kanbanStage;
  if (data.ucNumero !== undefined) patch.ucNumero = data.ucNumero;
  if (data.numeroSolicitacao !== undefined) patch.numeroSolicitacao = data.numeroSolicitacao;
  if (data.linksEnel !== undefined) patch.linksEnel = data.linksEnel;
  if (data.emailAcompanhamento !== undefined) patch.emailAcompanhamento = data.emailAcompanhamento;
  if (data.datasPrevistas !== undefined) patch.datasPrevistas = data.datasPrevistas;
  if (data.artPaga !== undefined) patch.artPaga = data.artPaga;
  const [updated] = await db
    .update(homologacaoProcessosTable)
    .set(patch)
    .where(eq(homologacaoProcessosTable.projectId, projectId))
    .returning();
  return updated;
}

export { processoPatchSchema, getOrCreateProcesso, patchProcesso };

// Allow-listed project shape for lists/kanban/financeiro — never exposes internal
// costs (capex, receitaBruta, valorProjeto, service values).
const SAFE_PROJECT_FIELDS = {
  id: projectsTable.id,
  clientName: projectsTable.clientName,
  clientEmail: projectsTable.clientEmail,
  systemPower: projectsTable.systemPower,
  stage: projectsTable.stage,
  city: projectsTable.city,
  state: projectsTable.state,
  estimatedActivation: projectsTable.estimatedActivation,
  dataConclusaoPrevista: projectsTable.dataConclusaoPrevista,
  homologacaoValor: projectsTable.homologacaoValor,
  homologacaoPago: projectsTable.homologacaoPago,
  homologacaoFormaPagamento: projectsTable.homologacaoFormaPagamento,
} as const;

// Detail view needs a few more fields, still excluding all internal financials
// (capex, receitaBruta, valorProjeto, service values, forma de pagamento do cliente).
const SAFE_PROJECT_DETAIL_FIELDS = {
  ...SAFE_PROJECT_FIELDS,
  clientPhone: projectsTable.clientPhone,
  statusStep: projectsTable.statusStep,
  completionPercent: projectsTable.completionPercent,
  notes: projectsTable.notes,
  estimatedDate: projectsTable.estimatedDate,
  homologacaoPix: projectsTable.homologacaoPix,
} as const;

function toSafeProject(p: typeof projectsTable.$inferSelect) {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(SAFE_PROJECT_DETAIL_FIELDS)) {
    out[key] = (p as Record<string, unknown>)[key];
  }
  return out;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

router.get("/homologacao/dashboard", requireHomologacao, async (req: AuthenticatedRequest, res) => {
  try {
    const techId = req.technician!.id;
    // All projects ever assigned to this technician (any stage) — needed to count
    // concluded work and keep financial history.
    const assigned = await db
      .select(SAFE_PROJECT_FIELDS)
      .from(projectsTable)
      .where(eq(projectsTable.homologacaoTechnicianId, techId))
      .orderBy(asc(projectsTable.id));

    const active = assigned.filter((p) => p.stage === "homologacao");
    const comPendencias = assigned.filter((p) => ["pendencias", "pausado"].includes(p.stage));
    const concluidos = assigned.filter(
      (p) => !["homologacao", "pendencias", "pausado"].includes(p.stage)
    );

    const inScopeIds = [...active, ...comPendencias].map((p) => p.id);
    const processos = inScopeIds.length
      ? await db
          .select()
          .from(homologacaoProcessosTable)
          .where(inArray(homologacaoProcessosTable.projectId, inScopeIds))
      : [];
    const procByProject = new Map(processos.map((p) => [p.projectId, p]));

    // Upcoming deadlines: nearest expected date across ficha datasPrevistas +
    // project-level deadline fields.
    const deadlines: { projectId: number; clientName: string; label: string; date: string }[] = [];
    for (const p of [...active, ...comPendencias]) {
      const proc = procByProject.get(p.id);
      if (proc?.datasPrevistas) {
        for (const [stage, date] of Object.entries(proc.datasPrevistas as Record<string, string>)) {
          if (date) deadlines.push({ projectId: p.id, clientName: p.clientName, label: stage, date });
        }
      }
      const fallback = p.estimatedActivation ?? p.dataConclusaoPrevista;
      if (fallback) deadlines.push({ projectId: p.id, clientName: p.clientName, label: "conclusao", date: fallback });
    }
    deadlines.sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      totals: {
        total: assigned.length,
        emAndamento: active.length,
        comPendencias: comPendencias.length,
        concluidos: concluidos.length,
        artPendentes: processos.filter((p) => !p.artPaga).length,
      },
      upcomingDeadlines: deadlines.slice(0, 8),
      recentProjects: [...active, ...comPendencias].slice(0, 6),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to build homologacao dashboard");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Financeiro ───────────────────────────────────────────────────────────────

router.get("/homologacao/financeiro", requireHomologacao, async (req: AuthenticatedRequest, res) => {
  try {
    const techId = req.technician!.id;
    const assigned = await db
      .select(SAFE_PROJECT_FIELDS)
      .from(projectsTable)
      .where(eq(projectsTable.homologacaoTechnicianId, techId))
      .orderBy(asc(projectsTable.id));

    const rows = assigned.map((p) => ({
      id: p.id,
      clientName: p.clientName,
      stage: p.stage,
      valor: p.homologacaoValor,
      pago: p.homologacaoPago,
      formaPagamento: p.homologacaoFormaPagamento,
    }));
    const recebido = rows.filter((r) => r.pago).reduce((s, r) => s + (r.valor ?? 0), 0);
    const aReceber = rows.filter((r) => !r.pago).reduce((s, r) => s + (r.valor ?? 0), 0);

    res.json({ totals: { recebido, aReceber, total: recebido + aReceber }, projects: rows });
  } catch (err) {
    req.log.error({ err }, "Failed to build homologacao financeiro");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Kanban ───────────────────────────────────────────────────────────────────

router.get("/homologacao/kanban", requireHomologacao, async (req: AuthenticatedRequest, res) => {
  try {
    const techId = req.technician!.id;
    const IN_SCOPE_STAGES = ["homologacao", "pendencias", "pausado"];
    const projects = await db
      .select(SAFE_PROJECT_FIELDS)
      .from(projectsTable)
      .where(
        and(
          inArray(projectsTable.stage, IN_SCOPE_STAGES),
          eq(projectsTable.homologacaoTechnicianId, techId)
        )
      )
      .orderBy(asc(projectsTable.id));
    const ids = projects.map((p) => p.id);
    const processos = ids.length
      ? await db
          .select()
          .from(homologacaoProcessosTable)
          .where(inArray(homologacaoProcessosTable.projectId, ids))
      : [];
    const procByProject = new Map(processos.map((p) => [p.projectId, p]));
    res.json(
      projects.map((p) => ({
        ...p,
        kanbanStage: procByProject.get(p.id)?.kanbanStage ?? "projeto_eletrico",
        artPaga: procByProject.get(p.id)?.artPaga ?? false,
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to build homologacao kanban");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Ficha do processo (technician) ───────────────────────────────────────────

router.get("/homologacao/projects/:id/processo", requireHomologacao, async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const project = await requireHomologacaoProject(id, req.technician!.id);
    if (!project) {
      res.status(404).json({ message: "Projeto não encontrado" });
      return;
    }
    res.json(await getOrCreateProcesso(id));
  } catch (err) {
    req.log.error({ err }, "Failed to get processo");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/homologacao/projects/:id/processo", requireHomologacao, async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id as string, 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const parsed = processoPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const project = await requireHomologacaoProject(id, req.technician!.id);
    if (!project) {
      res.status(404).json({ message: "Projeto não encontrado" });
      return;
    }
    res.json(await patchProcesso(id, parsed.data));
  } catch (err) {
    req.log.error({ err }, "Failed to patch processo");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post(
  "/homologacao/projects/:id/processo/art-nf",
  requireHomologacao,
  uploadSingle,
  async (req: AuthenticatedRequest, res) => {
    try {
      const id = parseInt(req.params.id as string, 10);
      if (isNaN(id)) {
        res.status(400).json({ message: "ID inválido" });
        return;
      }
      const project = await requireHomologacaoProject(id, req.technician!.id);
      if (!project) {
        res.status(404).json({ message: "Projeto não encontrado" });
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
      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
      const gcsRes = await fetch(uploadURL, {
        method: "PUT",
        body: buffer,
        headers: { "Content-Type": mimetype },
      });
      if (!gcsRes.ok) {
        req.log.error({ status: gcsRes.status }, "GCS upload failed (ART NF)");
        res.status(502).json({ message: "Falha ao enviar para o armazenamento" });
        return;
      }
      await getOrCreateProcesso(id);
      const fileUrl = `/api/storage${objectPath}`;
      const [updated] = await db
        .update(homologacaoProcessosTable)
        .set({ artNfUrl: fileUrl, artNfObjectPath: objectPath, updatedAt: new Date() })
        .where(eq(homologacaoProcessosTable.projectId, id))
        .returning();
      res.json(updated);
    } catch (err) {
      req.log.error({ err }, "Failed to upload ART NF");
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// ─── Projects ─────────────────────────────────────────────────────────────────

router.get("/homologacao/projects", requireHomologacao, async (req: AuthenticatedRequest, res) => {
  try {
    // Technicians only see projects explicitly assigned to them.
    const IN_SCOPE_STAGES = ["homologacao", "pendencias", "pausado"] as const;
    const projects = await db
      .select(SAFE_PROJECT_DETAIL_FIELDS)
      .from(projectsTable)
      .where(
        and(
          inArray(projectsTable.stage, [...IN_SCOPE_STAGES]),
          eq(projectsTable.homologacaoTechnicianId, req.technician!.id)
        )
      )
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

    const project = await requireHomologacaoProject(id, (req as AuthenticatedRequest).technician!.id);
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
      // Technicians must not see any service financials (values, costs, PIX
      // accounts) — only what the service is and its execution/payment status.
      db
        .select({
          id: servicesTable.id,
          name: servicesTable.name,
          tipoServico: servicesTable.tipoServico,
          status: servicesTable.status,
          statusPagamento: servicesTable.statusPagamento,
          pagamentoRealizado: servicesTable.pagamentoRealizado,
          dataExecucao: servicesTable.dataExecucao,
          dataInicio: servicesTable.dataInicio,
          dataTermino: servicesTable.dataTermino,
        })
        .from(servicesTable)
        .where(eq(servicesTable.projectId, id))
        .orderBy(asc(servicesTable.id)),
    ]);

    res.json({ project: toSafeProject(project), checklist, documents, services });
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
    const current = await requireHomologacaoProject(id, req.technician!.id);
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

    res.json(toSafeProject(updated));
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
    const owningProject = await requireHomologacaoProject(existingItem.projectId, req.technician!.id);
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
