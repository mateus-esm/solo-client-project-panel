import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { projectsTable, notificationsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const STEP_NAMES: Record<number, string> = {
  1: "Engenharia",
  2: "Homologação",
  3: "Logística",
  4: "Instalação",
  5: "Ativação",
};

const STEP_COMPLETION: Record<number, number> = {
  1: 10,
  2: 35,
  3: 60,
  4: 80,
  5: 100,
};

function validateWebhookSecret(req: any, res: any): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true; // If no secret configured, allow all (dev mode)

  const provided =
    req.headers["x-webhook-secret"] || req.headers["authorization"]?.replace("Bearer ", "");

  if (provided !== secret) {
    res.status(401).json({ message: "Unauthorized: invalid webhook secret" });
    return false;
  }
  return true;
}

/**
 * POST /api/webhooks/jestor/new-project
 *
 * Called by Jestor (via n8n) when a new contract is signed.
 * Creates the project in the portal and sends a welcome notification.
 *
 * Expected body:
 * {
 *   jestor_id: string,         // Jestor record ID (for deduplication)
 *   client_name: string,
 *   client_email: string,
 *   client_phone?: string,
 *   system_power: number,      // in kWp
 *   city: string,
 *   state: string,
 *   estimated_activation?: string  // e.g. "2026-06-01"
 * }
 */
router.post("/webhooks/jestor/new-project", async (req, res) => {
  if (!validateWebhookSecret(req, res)) return;

  const {
    jestor_id,
    client_name,
    client_email,
    client_phone,
    system_power,
    city,
    state,
    estimated_activation,
  } = req.body;

  if (!client_name || !client_email || !system_power || !city || !state) {
    res.status(400).json({
      message: "Missing required fields: client_name, client_email, system_power, city, state",
    });
    return;
  }

  try {
    // Check if project already exists (idempotency via jestor_id)
    if (jestor_id) {
      const [existing] = await db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.jestorId, jestor_id));

      if (existing) {
        res.json({ message: "Project already exists", project_id: existing.id, created: false });
        return;
      }
    }

    // Create the project
    const [project] = await db
      .insert(projectsTable)
      .values({
        jestorId: jestor_id ?? null,
        clientName: client_name,
        clientEmail: client_email,
        clientPhone: client_phone ?? null,
        systemPower: system_power,
        statusStep: 1,
        completionPercent: STEP_COMPLETION[1],
        city,
        state,
        estimatedActivation: estimated_activation ?? null,
      })
      .returning();

    // Create welcome notification
    await db.insert(notificationsTable).values({
      projectId: project.id,
      title: "Bem-vindo ao Portal Solo! 🎉",
      message: `Olá, ${client_name}! Seu contrato foi assinado e sua usina solar está começando a ganhar vida. Acompanhe cada etapa da sua jornada aqui no portal.`,
      read: false,
    });

    req.log.info({ project_id: project.id, jestor_id }, "New project created via Jestor webhook");

    res.status(201).json({
      message: "Project created successfully",
      project_id: project.id,
      created: true,
      portal_url: `${req.headers.origin ?? ""}/`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create project from Jestor webhook");
    res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/webhooks/jestor/update-phase
 *
 * Called by Jestor (via n8n) when the project phase changes in the CRM.
 * Updates the step in the portal and creates a notification for the client.
 *
 * Expected body:
 * {
 *   jestor_id?: string,   // Jestor record ID (preferred)
 *   project_id?: number,  // Portal project ID (fallback)
 *   phase: number,        // 1=Engenharia, 2=Homologação, 3=Logística, 4=Instalação, 5=Ativação
 *   tracking_code?: string,
 *   tracking_carrier?: string,
 *   notes?: string
 * }
 */
router.post("/webhooks/jestor/update-phase", async (req, res) => {
  if (!validateWebhookSecret(req, res)) return;

  const { jestor_id, project_id, phase, tracking_code, tracking_carrier, notes } = req.body;

  if (!phase || phase < 1 || phase > 5) {
    res.status(400).json({ message: "Invalid phase. Must be a number between 1 and 5." });
    return;
  }

  if (!jestor_id && !project_id) {
    res.status(400).json({ message: "Must provide jestor_id or project_id" });
    return;
  }

  try {
    // Find project
    let project;
    if (jestor_id) {
      [project] = await db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.jestorId, jestor_id));
    } else {
      [project] = await db
        .select()
        .from(projectsTable)
        .where(eq(projectsTable.id, project_id));
    }

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    // Update the project phase
    await db
      .update(projectsTable)
      .set({
        statusStep: phase,
        completionPercent: STEP_COMPLETION[phase],
        ...(tracking_code ? { trackingCode: tracking_code } : {}),
        ...(tracking_carrier ? { trackingCarrier: tracking_carrier } : {}),
        ...(notes ? { notes } : {}),
      })
      .where(eq(projectsTable.id, project.id));

    // Create notification for the client
    const stepName = STEP_NAMES[phase];
    const notificationMessages: Record<number, { title: string; message: string }> = {
      1: {
        title: "Projeto em Engenharia 📐",
        message: "Nossa equipe de engenharia está elaborando o projeto técnico da sua usina solar.",
      },
      2: {
        title: "Homologação Iniciada 🏛️",
        message:
          "O projeto foi submetido à concessionária de energia (ENEL/Cemig/etc.) para aprovação. Esta etapa pode levar alguns dias.",
      },
      3: {
        title: "Homologação Aprovada — Equipamentos em Logística 🚚",
        message: `Sua usina foi aprovada pela concessionária! Os equipamentos já estão sendo separados e despachados.${tracking_code ? ` Código de rastreio: ${tracking_code}` : ""}`,
      },
      4: {
        title: "Instalação em Andamento 🔧",
        message:
          "Nossa equipe técnica está na sua residência realizando a instalação dos painéis e do inversor solar.",
      },
      5: {
        title: "Usina Ativada! ☀️",
        message:
          "Parabéns! Sua usina solar está ativa e gerando energia. Acesse o monitoramento para acompanhar a geração em tempo real.",
      },
    };

    const notification = notificationMessages[phase] ?? {
      title: `Fase Atualizada: ${stepName}`,
      message: `Seu projeto avançou para a fase de ${stepName}.`,
    };

    await db.insert(notificationsTable).values({
      projectId: project.id,
      title: notification.title,
      message: notification.message,
      read: false,
    });

    req.log.info(
      { project_id: project.id, phase, step_name: stepName },
      "Project phase updated via Jestor webhook"
    );

    res.json({
      message: "Phase updated successfully",
      project_id: project.id,
      phase,
      phase_name: stepName,
      completion_percent: STEP_COMPLETION[phase],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to update project phase from Jestor webhook");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
