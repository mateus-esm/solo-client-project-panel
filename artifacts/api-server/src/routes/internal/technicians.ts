/**
 * Internal (admin-protected) routes for managing homologacao technicians.
 * POST   /internal/technicians        — create a technician
 * GET    /internal/technicians        — list all technicians
 * DELETE /internal/technicians/:id   — remove a technician
 */
import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { homologacaoTechniciansTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { z } from "zod/v4";
import { hashPassword } from "../../lib/homologacaoAuth";

const router: IRouter = Router();

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

router.get("/technicians", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: homologacaoTechniciansTable.id,
        name: homologacaoTechniciansTable.name,
        email: homologacaoTechniciansTable.email,
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
    const { name, email, password } = parsed.data;
    const passwordHash = hashPassword(password);
    const [tech] = await db
      .insert(homologacaoTechniciansTable)
      .values({ name, email: email.toLowerCase().trim(), passwordHash })
      .returning({
        id: homologacaoTechniciansTable.id,
        name: homologacaoTechniciansTable.name,
        email: homologacaoTechniciansTable.email,
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
