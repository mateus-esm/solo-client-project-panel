import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { installerAccountsTable, installerSessionsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { hashPassword } from "../../lib/installerAuth";

const router: IRouter = Router();

// ─── List installer accounts ──────────────────────────────────────────────────

router.get("/installers", async (req, res) => {
  try {
    const accounts = await db
      .select({
        id: installerAccountsTable.id,
        name: installerAccountsTable.name,
        email: installerAccountsTable.email,
        teamName: installerAccountsTable.teamName,
        createdAt: installerAccountsTable.createdAt,
      })
      .from(installerAccountsTable);
    res.json(accounts);
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
});

router.post("/installers", async (req, res) => {
  try {
    const parsed = createInstallerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const { name, email, teamName, password } = parsed.data;
    const passwordHash = hashPassword(password);
    const [account] = await db
      .insert(installerAccountsTable)
      .values({ name, email: email.toLowerCase().trim(), teamName, passwordHash })
      .returning({
        id: installerAccountsTable.id,
        name: installerAccountsTable.name,
        email: installerAccountsTable.email,
        teamName: installerAccountsTable.teamName,
        createdAt: installerAccountsTable.createdAt,
      });
    res.status(201).json(account);
  } catch (err: any) {
    if (err?.constraint === "installer_accounts_email_unique") {
      res.status(409).json({ message: "E-mail já cadastrado" });
      return;
    }
    req.log.error({ err }, "Failed to create installer account");
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
