/**
 * Internal (admin-protected) routes for managing homologacao technicians.
 * POST   /internal/technicians        — create a technician
 * GET    /internal/technicians        — list all technicians
 * PATCH  /internal/technicians/:id    — update name/phone
 * DELETE /internal/technicians/:id   — remove a technician
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { homologacaoTechniciansTable, homologacaoSessionsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { z } from "zod/v4";
import { hashPassword, verifyPassword } from "../../lib/homologacaoAuth";

const router: IRouter = Router();

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  // Sem telefone o técnico não entra no grupo de WhatsApp do processo.
  phone: z.string().nullish(),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().nullish(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
});

router.get("/technicians", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: homologacaoTechniciansTable.id,
        name: homologacaoTechniciansTable.name,
        email: homologacaoTechniciansTable.email,
        phone: homologacaoTechniciansTable.phone,
        createdAt: homologacaoTechniciansTable.createdAt,
      })
      .from(homologacaoTechniciansTable)
      .orderBy(asc(homologacaoTechniciansTable.id));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list technicians");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/technicians", async (req, res) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const { name, email, password, phone } = parsed.data;
    const passwordHash = hashPassword(password);
    const [tech] = await db
      .insert(homologacaoTechniciansTable)
      .values({ name, email: email.toLowerCase().trim(), passwordHash, phone: phone ?? null })
      .returning({
        id: homologacaoTechniciansTable.id,
        name: homologacaoTechniciansTable.name,
        email: homologacaoTechniciansTable.email,
        phone: homologacaoTechniciansTable.phone,
        createdAt: homologacaoTechniciansTable.createdAt,
      });
    res.status(201).json(tech);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ message: "E-mail já cadastrado" });
      return;
    }
    req.log.error({ err }, "Failed to create technician");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/technicians/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const { email, password, ...rest } = parsed.data;
    const patch: Record<string, unknown> = { ...rest };
    if (email !== undefined) patch.email = email.toLowerCase().trim();
    if (password !== undefined) patch.passwordHash = hashPassword(password);
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ message: "Nada para atualizar" });
      return;
    }
    // Credencial trocada → derruba sessões antigas na mesma transação.
    const [tech] = await db.transaction(async (tx) => {
      const rows = await tx
        .update(homologacaoTechniciansTable)
        .set(patch)
        .where(eq(homologacaoTechniciansTable.id, id))
        .returning({
          id: homologacaoTechniciansTable.id,
          name: homologacaoTechniciansTable.name,
          email: homologacaoTechniciansTable.email,
          phone: homologacaoTechniciansTable.phone,
          createdAt: homologacaoTechniciansTable.createdAt,
        });
      if (rows.length > 0 && (password !== undefined || email !== undefined)) {
        await tx
          .delete(homologacaoSessionsTable)
          .where(eq(homologacaoSessionsTable.technicianId, id));
      }
      return rows;
    });
    if (!tech) {
      res.status(404).json({ message: "Técnico não encontrado" });
      return;
    }
    res.json(tech);
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ message: "E-mail já cadastrado" });
      return;
    }
    req.log.error({ err }, "Failed to update technician");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Validate technician credentials (admin sanity check, no session created) ─

const validateAuthSchema = z.object({ password: z.string().min(1) });

router.post("/technicians/:id/validate-auth", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id) || id <= 0) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const parsed = validateAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [tech] = await db
      .select({ email: homologacaoTechniciansTable.email, passwordHash: homologacaoTechniciansTable.passwordHash })
      .from(homologacaoTechniciansTable)
      .where(eq(homologacaoTechniciansTable.id, id));
    if (!tech) {
      res.status(404).json({ message: "Técnico não encontrado" });
      return;
    }
    res.json({ ok: verifyPassword(parsed.data.password, tech.passwordHash), email: tech.email });
  } catch (err) {
    req.log.error({ err }, "Failed to validate technician credentials");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/technicians/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db
      .delete(homologacaoTechniciansTable)
      .where(eq(homologacaoTechniciansTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete technician");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
