import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  installerAccountsTable,
  servicesTable,
  serviceFilesTable,
  type ServiceFile,
} from "@workspace/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import {
  hashPassword,
  verifyPassword,
  createInstallerSession,
  deleteInstallerSession,
  requireInstaller,
  INSTALLER_COOKIE,
  type InstallerRequest,
} from "../lib/installerAuth";

const router: IRouter = Router();

// ─── Auth ─────────────────────────────────────────────────────────────────────

router.post("/installer/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ message: "Email e senha são obrigatórios" });
      return;
    }
    const [account] = await db
      .select()
      .from(installerAccountsTable)
      .where(eq(installerAccountsTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!account || !verifyPassword(password, account.passwordHash)) {
      res.status(401).json({ message: "Credenciais inválidas" });
      return;
    }

    const token = await createInstallerSession(account.id);
    res.cookie(INSTALLER_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: "/",
    });
    res.json({ ok: true, name: account.name, email: account.email, teamName: account.teamName });
  } catch (err) {
    req.log.error({ err }, "Installer login failed");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/installer/auth/logout", async (req, res) => {
  const token = req.cookies?.[INSTALLER_COOKIE];
  if (token) await deleteInstallerSession(token);
  res.clearCookie(INSTALLER_COOKIE, { path: "/" });
  res.json({ ok: true });
});

router.get("/installer/auth/check", requireInstaller, (req: InstallerRequest, res) => {
  res.json({
    ok: true,
    name: req.installer!.name,
    email: req.installer!.email,
    teamName: req.installer!.teamName,
  });
});

// ─── Services ─────────────────────────────────────────────────────────────────

/**
 * List services assigned to the authenticated installer's team.
 * Filters by equipe_execucao = installer.teamName.
 */
router.get("/installer/services", requireInstaller, async (req: InstallerRequest, res) => {
  try {
    const teamName = req.installer!.teamName;
    const services = await db
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.equipeExecucao, teamName))
      .orderBy(desc(servicesTable.dataExecucao), desc(servicesTable.id));

    const ids = services.map((s) => s.id);
    const files = ids.length
      ? await db
          .select()
          .from(serviceFilesTable)
          .where(inArray(serviceFilesTable.serviceId, ids))
      : [];

    const filesByService = new Map<number, ServiceFile[]>();
    for (const f of files) {
      const list = filesByService.get(f.serviceId) ?? [];
      list.push(f);
      filesByService.set(f.serviceId, list);
    }

    res.json(services.map((s) => ({ ...s, files: filesByService.get(s.id) ?? [] })));
  } catch (err) {
    req.log.error({ err }, "Failed to list installer services");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/installer/services/:id", requireInstaller, async (req: InstallerRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const [service] = await db
      .select()
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.id, id),
          eq(servicesTable.equipeExecucao, req.installer!.teamName)
        )
      );
    if (!service) {
      res.status(404).json({ message: "Serviço não encontrado" });
      return;
    }
    const files = await db
      .select()
      .from(serviceFilesTable)
      .where(eq(serviceFilesTable.serviceId, id));
    res.json({ ...service, files });
  } catch (err) {
    req.log.error({ err }, "Failed to get installer service");
    res.status(500).json({ message: "Internal server error" });
  }
});

// Allowed statuses for installer-initiated transitions.
// These must match the canonical SERVICE_STATUS values in lib/db/src/schema/pipeline.ts.
const ALLOWED_INSTALLER_STATUSES = ["Agendado", "Em Execução", "Concluído"] as const;
type AllowedInstallerStatus = (typeof ALLOWED_INSTALLER_STATUSES)[number];

const updateServiceSchema = z.object({
  status: z.enum(ALLOWED_INSTALLER_STATUSES).optional(),
  observacoes: z.string().optional(),
});

router.patch("/installer/services/:id", requireInstaller, async (req: InstallerRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }

    const parsed = updateServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }

    // Verify service belongs to this team before updating
    const [existing] = await db
      .select()
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.id, id),
          eq(servicesTable.equipeExecucao, req.installer!.teamName)
        )
      );
    if (!existing) {
      res.status(404).json({ message: "Serviço não encontrado" });
      return;
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;
    if (parsed.data.observacoes !== undefined) patch.observacoes = parsed.data.observacoes;

    const [updated] = await db
      .update(servicesTable)
      .set(patch)
      .where(eq(servicesTable.id, id))
      .returning();

    const files = await db
      .select()
      .from(serviceFilesTable)
      .where(eq(serviceFilesTable.serviceId, id));

    res.json({ ...updated, files });
  } catch (err) {
    req.log.error({ err }, "Failed to update installer service");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Add completion photo URL ─────────────────────────────────────────────────

const addPhotoSchema = z.object({
  url: z.string().min(1),
  name: z.string().optional(),
});

router.post("/installer/services/:id/photos", requireInstaller, async (req: InstallerRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }

    const parsed = addPhotoSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }

    // Verify the service belongs to this team
    const [service] = await db
      .select()
      .from(servicesTable)
      .where(
        and(
          eq(servicesTable.id, id),
          eq(servicesTable.equipeExecucao, req.installer!.teamName)
        )
      );
    if (!service) {
      res.status(404).json({ message: "Serviço não encontrado" });
      return;
    }

    const [file] = await db
      .insert(serviceFilesTable)
      .values({
        serviceId: id,
        kind: "imagens_documentacao",
        url: parsed.data.url,
        name: parsed.data.name ?? null,
      })
      .returning();

    res.status(201).json(file);
  } catch (err) {
    req.log.error({ err }, "Failed to add installer photo");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
