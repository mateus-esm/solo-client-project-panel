import { Router, type IRouter, type RequestHandler } from "express";
import { db } from "@workspace/db";
import {
  installerAccountsTable,
  installerSessionsTable,
  installerTeamMembersTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import multer from "multer";
import { hashPassword } from "../../lib/installerAuth";
import { ObjectStorageService } from "../../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
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

const accountColumns = {
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
};

// ─── List installer accounts (with members) ───────────────────────────────────

router.get("/installers", async (req, res) => {
  try {
    const accounts = await db.select(accountColumns).from(installerAccountsTable);
    const members = await db.select().from(installerTeamMembersTable);
    const byAccount = new Map<number, typeof members>();
    for (const m of members) {
      const list = byAccount.get(m.accountId) ?? [];
      list.push(m);
      byAccount.set(m.accountId, list);
    }
    res.json(accounts.map((a) => ({ ...a, members: byAccount.get(a.id) ?? [] })));
  } catch (err) {
    req.log.error({ err }, "Failed to list installer accounts");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Create installer account ─────────────────────────────────────────────────

const createInstallerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  teamName: z.string().min(1),
  password: z.string().min(8),
  razaoSocial: z.string().optional(),
  cnpj: z.string().optional(),
  responsavelNome: z.string().optional(),
  responsavelTelefone: z.string().optional(),
  pixKey: z.string().optional(),
  formaPagamento: z.string().optional(),
});

router.post("/installers", async (req, res) => {
  try {
    const parsed = createInstallerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const { name, email, teamName, password, ...company } = parsed.data;
    const passwordHash = hashPassword(password);
    const [account] = await db
      .insert(installerAccountsTable)
      .values({ name, email: email.toLowerCase().trim(), teamName, passwordHash, ...company })
      .returning(accountColumns);
    res.status(201).json({ ...account, members: [] });
  } catch (err: any) {
    if (err?.constraint === "installer_accounts_email_unique") {
      res.status(409).json({ message: "E-mail já cadastrado" });
      return;
    }
    req.log.error({ err }, "Failed to create installer account");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Update installer company details ─────────────────────────────────────────

const updateInstallerSchema = z.object({
  name: z.string().min(1).optional(),
  teamName: z.string().min(1).optional(),
  razaoSocial: z.string().nullish(),
  cnpj: z.string().nullish(),
  responsavelNome: z.string().nullish(),
  responsavelTelefone: z.string().nullish(),
  pixKey: z.string().nullish(),
  formaPagamento: z.string().nullish(),
});

router.patch("/installers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const parsed = updateInstallerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [account] = await db
      .update(installerAccountsTable)
      .set(parsed.data)
      .where(eq(installerAccountsTable.id, id))
      .returning(accountColumns);
    if (!account) {
      res.status(404).json({ message: "Conta não encontrada" });
      return;
    }
    res.json(account);
  } catch (err) {
    req.log.error({ err }, "Failed to update installer account");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Team members ─────────────────────────────────────────────────────────────

const createMemberSchema = z.object({
  name: z.string().min(1),
  documento: z.string().optional(),
});

router.post("/installers/:id/members", async (req, res) => {
  try {
    const accountId = parseInt(req.params.id, 10);
    if (isNaN(accountId)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const parsed = createMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [member] = await db
      .insert(installerTeamMembersTable)
      .values({ accountId, name: parsed.data.name, documento: parsed.data.documento ?? null })
      .returning();
    res.status(201).json(member);
  } catch (err) {
    req.log.error({ err }, "Failed to create team member");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/installers/members/:memberId", async (req, res) => {
  try {
    const memberId = parseInt(String(req.params.memberId), 10);
    if (isNaN(memberId)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    await db.delete(installerTeamMembersTable).where(eq(installerTeamMembersTable.id, memberId));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete team member");
    res.status(500).json({ message: "Internal server error" });
  }
});

// Upload member photo or ID document. ?kind=photo|doc
router.post("/installers/members/:memberId/upload", uploadSingle, async (req, res) => {
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
  const { mimetype, buffer } = req.file;
  if (!ALLOWED_IMAGE_TYPES.includes(mimetype)) {
    res.status(400).json({ message: "Tipo não permitido. Use JPG, PNG ou PDF." });
    return;
  }
  try {
    const [member] = await db
      .select()
      .from(installerTeamMembersTable)
      .where(eq(installerTeamMembersTable.id, memberId));
    if (!member) {
      res.status(404).json({ message: "Membro não encontrado" });
      return;
    }
    const uploadURL = await objectStorage.getObjectEntityUploadURL();
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
    const gcsRes = await fetch(uploadURL, { method: "PUT", body: buffer, headers: { "Content-Type": mimetype } });
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
});

// ─── Reset installer password ─────────────────────────────────────────────────

const resetPasswordSchema = z.object({
  password: z.string().min(8),
});

router.patch("/installers/:id/password", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const passwordHash = hashPassword(parsed.data.password);
    const [account] = await db
      .update(installerAccountsTable)
      .set({ passwordHash })
      .where(eq(installerAccountsTable.id, id))
      .returning({
        id: installerAccountsTable.id,
        name: installerAccountsTable.name,
        email: installerAccountsTable.email,
        teamName: installerAccountsTable.teamName,
      });
    if (!account) {
      res.status(404).json({ message: "Conta não encontrada" });
      return;
    }
    res.json({ ok: true, ...account });
  } catch (err) {
    req.log.error({ err }, "Failed to reset installer password");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Delete installer account ─────────────────────────────────────────────────

router.delete("/installers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    // Delete sessions first
    await db
      .delete(installerSessionsTable)
      .where(eq(installerSessionsTable.accountId, id));
    await db
      .delete(installerAccountsTable)
      .where(eq(installerAccountsTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete installer account");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
