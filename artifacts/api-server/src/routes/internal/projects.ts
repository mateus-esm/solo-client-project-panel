import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  projectsTable,
  notificationsTable,
  projectChecklistItemsTable,
  servicesTable,
  insertProjectSchema,
  insertChecklistItemSchema,
  STAGE_LABELS,
  PIPELINE_STAGES,
  CHECKLIST_STAGES,
  stageToClientStep,
  isValidSubStage,
  SUB_STAGES,
  CHECKLIST_TEMPLATE,
  CHECKLIST_ITEM_TEMPLATE,
  homologacaoTechniciansTable,
  projectPurchasesTable,
  type PipelineStage,
} from "@workspace/db/schema";
import { eq, and, asc, sql, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import { stepCompletionPercent } from "../../lib/jestor";
import { getOrCreateProcesso, patchProcesso, processoPatchSchema } from "../homologacao";
import { sendWhatsApp } from "../../lib/notifications";
import {
  homologacaoAprovada,
  STAGES_REQUIRING_HOMOLOGACAO,
  HOMOLOGACAO_GATE_MESSAGE,
} from "../../lib/homologacao-gate";

const router: IRouter = Router();

const stageSchema = z.enum(PIPELINE_STAGES);
// Checklists também existem para a trilha paralela de suprimentos.
const checklistStageSchema = z.enum(CHECKLIST_STAGES);

const createProjectSchema = insertProjectSchema.extend({
  stage: stageSchema.default("onboarding"),
});

// Derived from insertProjectSchema, not from createProjectSchema: `.partial()` does not
// strip an explicit `.default()`, so reusing the create schema would inject
// stage="onboarding" into every PATCH and silently reset the project's stage.
const updateProjectSchema = insertProjectSchema.partial().extend({
  stage: stageSchema.optional(),
});

function clientStepPatch(stage: PipelineStage, subStage?: string | null): {
  statusStep?: number;
  completionPercent?: number;
} {
  const step = stageToClientStep(stage, subStage);
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

    // Trilha paralela de suprimentos: resumo das compras por projeto para o
    // selo no kanban (roda em paralelo a qualquer macro-etapa).
    const counts = await db
      .select({
        projectId: projectPurchasesTable.projectId,
        status: projectPurchasesTable.status,
        count: sql<number>`count(*)::int`,
      })
      .from(projectPurchasesTable)
      .groupBy(projectPurchasesTable.projectId, projectPurchasesTable.status);
    const supplyByProject = new Map<number, Record<string, number>>();
    for (const row of counts) {
      const entry = supplyByProject.get(row.projectId) ?? {};
      entry[row.status] = row.count;
      supplyByProject.set(row.projectId, entry);
    }
    res.json(
      projects.map((p) => {
        const s = supplyByProject.get(p.id) ?? {};
        const total = Object.values(s).reduce((a, b) => a + b, 0);
        return {
          ...p,
          supply: {
            total,
            cotacao: s.cotacao ?? 0,
            comprada: s.comprada ?? 0,
            logisticaProgramada: s.logistica_programada ?? 0,
            recebida: s.recebida ?? 0,
          },
        };
      }),
    );
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
    const createStage = parsed.data.stage as PipelineStage;
    if (parsed.data.subStage != null && !isValidSubStage(createStage, parsed.data.subStage)) {
      res.status(400).json({
        message: `Sub-etapa inválida para a etapa ${STAGE_LABELS[createStage]}.`,
      });
      return;
    }
    const patch = clientStepPatch(createStage, parsed.data.subStage ?? null);
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

    // Assigned homologation technician must exist — otherwise the project
    // becomes unreachable in the technician portal.
    if (parsed.data.homologacaoTechnicianId != null) {
      const [tech] = await db
        .select({ id: homologacaoTechniciansTable.id })
        .from(homologacaoTechniciansTable)
        .where(eq(homologacaoTechniciansTable.id, parsed.data.homologacaoTechnicianId))
        .limit(1);
      if (!tech) {
        res.status(400).json({ message: "Técnico de homologação não encontrado" });
        return;
      }
    }

    const stageChanged =
      parsed.data.stage !== undefined && parsed.data.stage !== current.stage;

    // Sub-etapa deve pertencer à macro-etapa alvo. Ao trocar de macro-etapa sem
    // informar sub-etapa, ela é resetada (início da nova macro-etapa).
    const targetStage = (parsed.data.stage ?? current.stage) as PipelineStage;
    if (parsed.data.subStage != null && !isValidSubStage(targetStage, parsed.data.subStage)) {
      res.status(400).json({
        message: `Sub-etapa inválida para a etapa ${STAGE_LABELS[targetStage]}.`,
      });
      return;
    }
    if (stageChanged && parsed.data.subStage === undefined) {
      parsed.data.subStage = null;
    }
    const subStageChanged =
      parsed.data.subStage !== undefined && parsed.data.subStage !== current.subStage;

    // Etapas pós-homologação (compras/logística/pré-execução) só são liberadas
    // após a homologação aprovada — política centralizada em homologacao-gate.
    if (
      stageChanged &&
      (STAGES_REQUIRING_HOMOLOGACAO as readonly string[]).includes(parsed.data.stage as string) &&
      !(await homologacaoAprovada(id))
    ) {
      res.status(409).json({ message: HOMOLOGACAO_GATE_MESSAGE });
      return;
    }

    // Pré-execução também exige compras e logística registradas: pelo menos uma
    // compra efetivada e nenhuma compra efetivada sem logística programada/recebida.
    if (stageChanged && parsed.data.stage === "planejamento_execucao") {
      const purchases = await db
        .select({ status: projectPurchasesTable.status })
        .from(projectPurchasesTable)
        .where(eq(projectPurchasesTable.projectId, id));
      const efetivadas = purchases.filter((p) => p.status !== "cotacao");
      if (efetivadas.length === 0) {
        res.status(409).json({
          message:
            "Registre as compras do projeto (equipamentos/materiais) antes de liberar a Pré-execução.",
        });
        return;
      }
      if (efetivadas.some((p) => p.status === "comprada")) {
        res.status(409).json({
          message:
            "Programe a logística de todas as compras registradas antes de liberar a Pré-execução.",
        });
        return;
      }
    }
    const patch =
      stageChanged || subStageChanged
        ? clientStepPatch(targetStage, parsed.data.subStage ?? current.subStage)
        : {};

    const [updated] = await db
      .update(projectsTable)
      .set({ ...parsed.data, ...patch })
      .where(eq(projectsTable.id, id))
      .returning();

    // Notifica o cliente quando a macro-etapa muda ou quando a sub-etapa faz o
    // stepper do portal avançar (ex.: projeto técnico → homologação).
    const stepAdvanced =
      patch.statusStep !== undefined && patch.statusStep !== current.statusStep;
    if (stageChanged || stepAdvanced) {
      const subLabel = updated.subStage
        ? SUB_STAGES[targetStage].find((g) => g.slug === updated.subStage)?.title
        : undefined;
      const label = subLabel
        ? `${STAGE_LABELS[targetStage]} — ${subLabel}`
        : STAGE_LABELS[targetStage];
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

// --- Ficha do processo Enel (homologação) ---

router.get("/projects/:id/processo", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) {
      res.status(404).json({ message: "Projeto não encontrado" });
      return;
    }
    res.json(await getOrCreateProcesso(id));
  } catch (err) {
    req.log.error({ err }, "Failed to get processo (internal)");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/projects/:id/processo", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const parsed = processoPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) {
      res.status(404).json({ message: "Projeto não encontrado" });
      return;
    }
    res.json(await patchProcesso(id, parsed.data));
  } catch (err) {
    req.log.error({ err }, "Failed to patch processo (internal)");
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

// Seeds the default typed items for a stage (idempotent: skips groups that already
// have items). Called by the UI when opening a stage tab with an empty checklist.
router.post("/projects/:id/checklist/seed", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const stage = checklistStageSchema.parse(req.body?.stage);
    const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, id));
    if (!project) {
      res.status(404).json({ message: "Projeto não encontrado" });
      return;
    }
    // Transaction + per-project advisory lock so concurrent seed calls (e.g. two
    // open tabs) cannot both pass the existence check and insert duplicates.
    const inserted = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(874312, ${id})`);
      const existing = await tx
        .select()
        .from(projectChecklistItemsTable)
        .where(
          and(
            eq(projectChecklistItemsTable.projectId, id),
            eq(projectChecklistItemsTable.stage, stage),
          ),
        );
      const existingSlugs = new Set(existing.map((i) => i.checklistSlug));

      const toInsert: (typeof projectChecklistItemsTable.$inferInsert)[] = [];
      for (const group of CHECKLIST_TEMPLATE[stage] ?? []) {
        if (existingSlugs.has(group.slug)) continue; // group already has items — don't duplicate
        const templates = CHECKLIST_ITEM_TEMPLATE[group.slug] ?? [];
        templates.forEach((tpl, idx) => {
          toInsert.push({
            projectId: id,
            stage,
            checklistSlug: group.slug,
            label: tpl.label,
            kind: tpl.kind,
            sortOrder: idx,
          });
        });
      }
      return toInsert.length
        ? await tx.insert(projectChecklistItemsTable).values(toInsert).returning()
        : [];
    });
    res.status(201).json(inserted);
  } catch (err) {
    req.log.error({ err }, "Failed to seed checklist");
    res.status(500).json({ message: "Internal server error" });
  }
});

const updateItemSchema = z.object({
  done: z.boolean().optional(),
  label: z.string().min(1).optional(),
  doneBy: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
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
    if (parsed.data.metadata !== undefined) patch.metadata = parsed.data.metadata;
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

    // Relational sync: logistics form fields flow into the project so the client's
    // tracking view updates without re-typing anywhere else. Restricted to the
    // logistics checklist item so arbitrary metadata can't overwrite project tracking.
    const meta = parsed.data.metadata;
    if (item.checklistSlug === "compras_logistica" && meta && (meta.trackingCode || meta.trackingCarrier)) {
      await db
        .update(projectsTable)
        .set({
          ...(meta.trackingCode ? { trackingCode: String(meta.trackingCode) } : {}),
          ...(meta.trackingCarrier ? { trackingCarrier: String(meta.trackingCarrier) } : {}),
        })
        .where(eq(projectsTable.id, item.projectId));
    }

    res.json(item);
  } catch (err) {
    req.log.error({ err }, "Failed to update checklist item");
    res.status(500).json({ message: "Internal server error" });
  }
});

// "service" items: creates a service linked to the project, marks the item done,
// and notifies the assigned team via WhatsApp when a phone is provided.
const assignServiceSchema = z.object({
  equipeExecucao: z.string().min(1),
  telefoneEquipe: z.string().optional(),
  tipoServico: z.string().default("Instalação"),
  valorServico: z.number().nullable().optional(),
  dataInicio: z.coerce.date().nullish(),
  dataTermino: z.coerce.date().nullish(),
  endereco: z.string().optional(),
  observacoes: z.string().optional(),
  notify: z.boolean().default(true),
  doneBy: z.string().optional(),
});

router.post("/checklist/:itemId/assign-service", async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId, 10);
    const parsed = assignServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [item] = await db
      .select()
      .from(projectChecklistItemsTable)
      .where(eq(projectChecklistItemsTable.id, itemId));
    if (!item) {
      res.status(404).json({ message: "Item não encontrado" });
      return;
    }
    if (item.kind !== "service") {
      res.status(400).json({ message: "Este item não é de designação de equipe" });
      return;
    }
    if (item.done && (item.metadata as Record<string, unknown> | null)?.serviceId) {
      res.status(409).json({ message: "Este item já possui um serviço designado" });
      return;
    }
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, item.projectId));
    if (!project) {
      res.status(404).json({ message: "Projeto não encontrado" });
      return;
    }

    const d = parsed.data;
    // Atomic: service creation and item completion succeed or fail together.
    const { service, updatedItem } = await db.transaction(async (tx) => {
      const [svc] = await tx
        .insert(servicesTable)
        .values({
          projectId: project.id,
          name: `${d.tipoServico} | ${project.clientName}`,
          tipoServico: d.tipoServico,
          valorServico: d.valorServico ?? null,
          status: "Agendado",
          dataInicio: d.dataInicio ?? null,
          dataTermino: d.dataTermino ?? null,
          equipeExecucao: d.equipeExecucao,
          endereco: d.endereco || `${project.city}/${project.state}`,
          observacoes: d.observacoes || null,
        })
        .returning();

      const [it] = await tx
        .update(projectChecklistItemsTable)
        .set({
          done: true,
          doneBy: d.doneBy ?? "admin",
          doneAt: new Date(),
          metadata: {
            serviceId: svc.id,
            equipeExecucao: d.equipeExecucao,
            telefoneEquipe: d.telefoneEquipe ?? null,
          },
        })
        .where(eq(projectChecklistItemsTable.id, itemId))
        .returning();
      return { service: svc, updatedItem: it };
    });

    if (d.notify && d.telefoneEquipe) {
      const dataStr = d.dataInicio
        ? new Date(d.dataInicio).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
        : "a definir";
      const msg =
        `🔧 *Solo Energia* | Novo serviço designado\n\n` +
        `Equipe: *${d.equipeExecucao}*\n` +
        `Serviço: ${d.tipoServico}\n` +
        `Cliente: ${project.clientName}\n` +
        `Local: ${d.endereco || `${project.city}/${project.state}`}\n` +
        `Data: ${dataStr}\n` +
        (d.valorServico ? `Valor: R$ ${d.valorServico.toLocaleString("pt-BR")}\n` : "") +
        (d.observacoes ? `\nObs: ${d.observacoes}\n` : "") +
        `\n— Equipe Solo Energia`;
      // Fire and forget — notification failure must not fail the assignment
      sendWhatsApp(d.telefoneEquipe, msg).catch(() => {});
    }

    res.status(201).json({ item: updatedItem, service });
  } catch (err) {
    req.log.error({ err }, "Failed to assign service from checklist");
    res.status(500).json({ message: "Internal server error" });
  }
});

// "client_notify" items: records the scheduled date and notifies the client in the
// portal (notification row) and via WhatsApp when the project has a phone.
const scheduleClientSchema = z.object({
  data: z.string().min(1),
  hora: z.string().optional(),
  observacao: z.string().optional(),
  notify: z.boolean().default(true),
  doneBy: z.string().optional(),
});

router.post("/checklist/:itemId/schedule-client", async (req, res) => {
  try {
    const itemId = parseInt(req.params.itemId, 10);
    const parsed = scheduleClientSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [item] = await db
      .select()
      .from(projectChecklistItemsTable)
      .where(eq(projectChecklistItemsTable.id, itemId));
    if (!item) {
      res.status(404).json({ message: "Item não encontrado" });
      return;
    }
    if (item.kind !== "client_notify") {
      res.status(400).json({ message: "Este item não é de agendamento com cliente" });
      return;
    }
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, item.projectId));
    if (!project) {
      res.status(404).json({ message: "Projeto não encontrado" });
      return;
    }

    const d = parsed.data;
    const dataBR = new Date(`${d.data}T00:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const quando = d.hora ? `${dataBR} às ${d.hora}` : dataBR;

    const [updatedItem] = await db
      .update(projectChecklistItemsTable)
      .set({
        done: true,
        doneBy: d.doneBy ?? "admin",
        doneAt: new Date(),
        metadata: { data: d.data, hora: d.hora ?? null, observacao: d.observacao ?? null },
      })
      .where(eq(projectChecklistItemsTable.id, itemId))
      .returning();

    if (d.notify) {
      await db.insert(notificationsTable).values({
        projectId: project.id,
        title: "Agendamento confirmado 📅",
        message: `${item.label}: ${quando}.${d.observacao ? ` ${d.observacao}` : ""}`,
      });
      if (project.clientPhone) {
        const firstName = project.clientName.split(" ")[0];
        const msg =
          `📅 *Solo Energia* | Agendamento confirmado\n\n` +
          `Olá, ${firstName}!\n\n` +
          `${item.label}\n*${quando}*\n` +
          (d.observacao ? `\n${d.observacao}\n` : "") +
          `\n👉 Acompanhe no seu portal do cliente.\n\n— Equipe Solo Energia`;
        sendWhatsApp(project.clientPhone, msg).catch(() => {});
      }
    }

    res.status(201).json({ item: updatedItem });
  } catch (err) {
    req.log.error({ err }, "Failed to schedule client from checklist");
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
