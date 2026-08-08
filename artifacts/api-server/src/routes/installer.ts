import { Router, type IRouter, type RequestHandler } from "express";
import { db } from "@workspace/db";
import {
  installerAccountsTable,
  installerTeamMembersTable,
  serviceTeamMembersTable,
  servicesTable,
  serviceFilesTable,
  type ServiceFile,
} from "@workspace/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { z } from "zod/v4";
import multer from "multer";
import { ObjectStorageService } from "../lib/objectStorage";
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
const objectStorage = new ObjectStorageService();

const ALLOWED_UPLOAD_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
const _upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const uploadSingle: RequestHandler = (req, res, next) => {
  _upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ message: "Arquivo muito grande. Máximo de 10 MB." });
      return;
    }
    next(err as Error);
  });
};

// Installers must never see internal financials (proposed value, logistics and
// other internal costs, or the value charged to the client). They only see the
// agreed value (valorFechado) and payment/contract status.
type ServiceRow = typeof servicesTable.$inferSelect;
function toInstallerService(row: ServiceRow) {
  const {
    valorServico: _vs,
    valorProposto: _vp,
    custoLogistica: _cl,
    outrosCustos: _oc,
    ...safe
  } = row;
  return safe;
}

// Installer team members assigned to a service (joined with member details).
async function loadServiceMembers(serviceId: number) {
  const rows = await db
    .select({ member: installerTeamMembersTable })
    .from(serviceTeamMembersTable)
    .innerJoin(
      installerTeamMembersTable,
      eq(serviceTeamMembersTable.memberId, installerTeamMembersTable.id)
    )
    .where(eq(serviceTeamMembersTable.serviceId, serviceId));
  return rows.map((r) => r.member);
}

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

    res.json(
      services.map((s) => ({ ...toInstallerService(s), files: filesByService.get(s.id) ?? [] }))
    );
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
    const [files, members] = await Promise.all([
      db.select().from(serviceFilesTable).where(eq(serviceFilesTable.serviceId, id)),
      loadServiceMembers(id),
    ]);
    res.json({ ...toInstallerService(service), files, members });
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

    res.json({ ...toInstallerService(updated), files });
  } catch (err) {
    req.log.error({ err }, "Failed to update installer service");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Accept the service contract ──────────────────────────────────────────────

router.post("/installer/services/:id/contract/accept", requireInstaller, async (req: InstallerRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
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
    if (!existing.contratoUrl) {
      res.status(400).json({ message: "Nenhum contrato disponível para aceite" });
      return;
    }
    if (existing.contratoStatus === "aceito") {
      res.status(409).json({ message: "Contrato já foi aceito" });
      return;
    }
    const [updated] = await db
      .update(servicesTable)
      .set({
        contratoStatus: "aceito",
        contratoAceitoEm: new Date(),
        contratoAceitoPor: req.installer!.name,
        updatedAt: new Date(),
      })
      .where(eq(servicesTable.id, id))
      .returning();
    res.json(toInstallerService(updated));
  } catch (err) {
    req.log.error({ err }, "Failed to accept contract");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Company data (own account) ───────────────────────────────────────────────

router.get("/installer/me", requireInstaller, async (req: InstallerRequest, res) => {
  try {
    const [account] = await db
      .select({
        id: installerAccountsTable.id,
        name: installerAccountsTable.name,
        email: installerAccountsTable.email,
        teamName: installerAccountsTable.teamName,
        razaoSocial: installerAccountsTable.razaoSocial,
        cnpj: installerAccountsTable.cnpj,
        responsavelNome: installerAccountsTable.responsavelNome,
        responsavelTelefone: installerAccountsTable.responsavelTelefone,
        pixKey: installerAccountsTable.pixKey,
        formaPagamento: installerAccountsTable.formaPagamento,
        createdAt: installerAccountsTable.createdAt,
      })
      .from(installerAccountsTable)
      .where(eq(installerAccountsTable.id, req.installer!.id));
    if (!account) {
      res.status(404).json({ message: "Conta não encontrada" });
      return;
    }
    res.json(account);
  } catch (err) {
    req.log.error({ err }, "Failed to get installer account");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Financeiro (only valorFechado + payment status — never internal costs) ────

router.get("/installer/financeiro", requireInstaller, async (req: InstallerRequest, res) => {
  try {
    const services = await db
      .select({
        id: servicesTable.id,
        name: servicesTable.name,
        tipoServico: servicesTable.tipoServico,
        status: servicesTable.status,
        statusPagamento: servicesTable.statusPagamento,
        pagamentoRealizado: servicesTable.pagamentoRealizado,
        dataExecucao: servicesTable.dataExecucao,
        valorFechado: servicesTable.valorFechado,
        formaPagamento: servicesTable.formaPagamento,
        comprovanteUrl: servicesTable.comprovanteUrl,
      })
      .from(servicesTable)
      .where(eq(servicesTable.equipeExecucao, req.installer!.teamName))
      .orderBy(desc(servicesTable.dataExecucao), desc(servicesTable.id));

    let recebido = 0;
    let aReceber = 0;
    for (const s of services) {
      const valor = s.valorFechado ?? 0;
      if (s.status === "Cancelado") continue;
      if (s.pagamentoRealizado || s.statusPagamento === "Pago") recebido += valor;
      else aReceber += valor;
    }
    res.json({ services, totals: { recebido, aReceber } });
  } catch (err) {
    req.log.error({ err }, "Failed to get installer financeiro");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Own team members CRUD ────────────────────────────────────────────────────

router.get("/installer/team/members", requireInstaller, async (req: InstallerRequest, res) => {
  try {
    const members = await db
      .select()
      .from(installerTeamMembersTable)
      .where(eq(installerTeamMembersTable.accountId, req.installer!.id))
      .orderBy(installerTeamMembersTable.name);
    res.json(members);
  } catch (err) {
    req.log.error({ err }, "Failed to list team members");
    res.status(500).json({ message: "Internal server error" });
  }
});

const memberSchema = z.object({
  name: z.string().min(1),
  documento: z.string().nullish(),
});

router.post("/installer/team/members", requireInstaller, async (req: InstallerRequest, res) => {
  try {
    const parsed = memberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [member] = await db
      .insert(installerTeamMembersTable)
      .values({
        accountId: req.installer!.id,
        name: parsed.data.name,
        documento: parsed.data.documento ?? null,
      })
      .returning();
    res.status(201).json(member);
  } catch (err) {
    req.log.error({ err }, "Failed to create team member");
    res.status(500).json({ message: "Internal server error" });
  }
});

// Loads a member only if it belongs to the authenticated installer's account.
async function findOwnMember(accountId: number, memberId: number) {
  const [member] = await db
    .select()
    .from(installerTeamMembersTable)
    .where(
      and(
        eq(installerTeamMembersTable.id, memberId),
        eq(installerTeamMembersTable.accountId, accountId)
      )
    )
    .limit(1);
  return member;
}

router.patch("/installer/team/members/:memberId", requireInstaller, async (req: InstallerRequest, res) => {
  try {
    const memberId = parseInt(String(req.params.memberId), 10);
    if (isNaN(memberId)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const parsed = memberSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const member = await findOwnMember(req.installer!.id, memberId);
    if (!member) {
      res.status(404).json({ message: "Membro não encontrado" });
      return;
    }
    const patch: Record<string, unknown> = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.documento !== undefined) patch.documento = parsed.data.documento ?? null;
    const [updated] = await db
      .update(installerTeamMembersTable)
      .set(patch)
      .where(eq(installerTeamMembersTable.id, memberId))
      .returning();
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update team member");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/installer/team/members/:memberId", requireInstaller, async (req: InstallerRequest, res) => {
  try {
    const memberId = parseInt(String(req.params.memberId), 10);
    if (isNaN(memberId)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const member = await findOwnMember(req.installer!.id, memberId);
    if (!member) {
      res.status(404).json({ message: "Membro não encontrado" });
      return;
    }
    await db.transaction(async (tx) => {
      await tx
        .delete(serviceTeamMembersTable)
        .where(eq(serviceTeamMembersTable.memberId, memberId));
      await tx
        .delete(installerTeamMembersTable)
        .where(eq(installerTeamMembersTable.id, memberId));
    });
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete team member");
    res.status(500).json({ message: "Internal server error" });
  }
});

// Upload member photo or ID document. ?kind=photo|doc
router.post(
  "/installer/team/members/:memberId/upload",
  requireInstaller,
  uploadSingle,
  async (req: InstallerRequest, res) => {
    const memberId = parseInt(String(req.params.memberId), 10);
    const kind = String(req.query.kind ?? "photo");
    if (isNaN(memberId)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    if (kind !== "photo" && kind !== "doc") {
      res.status(400).json({ message: "kind inválido (use photo ou doc)" });
      return;
    }
    if (!req.file) {
      res.status(400).json({ message: "Arquivo não enviado" });
      return;
    }
    if (!ALLOWED_UPLOAD_TYPES.includes(req.file.mimetype)) {
      res.status(400).json({ message: "Tipo não permitido. Use JPG, PNG ou PDF." });
      return;
    }
    try {
      const member = await findOwnMember(req.installer!.id, memberId);
      if (!member) {
        res.status(404).json({ message: "Membro não encontrado" });
        return;
      }
      const uploadURL = await objectStorage.getObjectEntityUploadURL();
      const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
      const gcsRes = await fetch(uploadURL, {
        method: "PUT",
        body: req.file.buffer,
        headers: { "Content-Type": req.file.mimetype },
      });
      if (!gcsRes.ok) {
        res.status(502).json({ message: "Falha ao enviar para o armazenamento" });
        return;
      }
      const fileUrl = `/api/storage${objectPath}`;
      const [updated] = await db
        .update(installerTeamMembersTable)
        .set(kind === "photo" ? { photoUrl: fileUrl } : { docUrl: fileUrl })
        .where(eq(installerTeamMembersTable.id, memberId))
        .returning();
      res.json(updated);
    } catch (err) {
      req.log.error({ err }, "Failed to upload member file");
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

// ─── Propose service team (escalação) ─────────────────────────────────────────

const proposeMembersSchema = z.object({ memberIds: z.array(z.number().int()).min(1) });

router.put("/installer/services/:id/members", requireInstaller, async (req: InstallerRequest, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const parsed = proposeMembersSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Selecione ao menos um membro", errors: parsed.error.issues });
      return;
    }
    const [service] = await db
      .select()
      .from(servicesTable)
      .where(
        and(eq(servicesTable.id, id), eq(servicesTable.equipeExecucao, req.installer!.teamName))
      );
    if (!service) {
      res.status(404).json({ message: "Serviço não encontrado" });
      return;
    }
    // Every proposed member must belong to the installer's own account.
    const uniqueIds = [...new Set(parsed.data.memberIds)];
    const validMembers = await db
      .select({ id: installerTeamMembersTable.id })
      .from(installerTeamMembersTable)
      .where(
        and(
          eq(installerTeamMembersTable.accountId, req.installer!.id),
          inArray(installerTeamMembersTable.id, uniqueIds)
        )
      );
    if (validMembers.length !== uniqueIds.length) {
      res.status(400).json({ message: "Um ou mais membros não pertencem à sua equipe" });
      return;
    }
    await db.transaction(async (tx) => {
      await tx.delete(serviceTeamMembersTable).where(eq(serviceTeamMembersTable.serviceId, id));
      await tx
        .insert(serviceTeamMembersTable)
        .values(uniqueIds.map((memberId) => ({ serviceId: id, memberId })));
      await tx
        .update(servicesTable)
        .set({
          escalacaoStatus: "pendente",
          escalacaoEnviadaPor: req.installer!.name,
          escalacaoEnviadaEm: new Date(),
          escalacaoDecididaPor: null,
          escalacaoDecididaEm: null,
          updatedAt: new Date(),
        })
        .where(eq(servicesTable.id, id));
    });
    const members = await loadServiceMembers(id);
    const [updated] = await db.select().from(servicesTable).where(eq(servicesTable.id, id));
    res.json({ ...toInstallerService(updated), members });
  } catch (err) {
    req.log.error({ err }, "Failed to propose service team");
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
