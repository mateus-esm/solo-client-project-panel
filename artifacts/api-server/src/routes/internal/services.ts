import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  servicesTable,
  serviceFilesTable,
  insertServiceSchema,
  insertServiceFileSchema,
  type ServiceFile,
} from "@workspace/db/schema";
import { eq, and, desc, inArray, type SQL } from "drizzle-orm";

const router: IRouter = Router();

const updateServiceSchema = insertServiceSchema.partial();

router.get("/services", async (req, res) => {
  try {
    const conditions: SQL[] = [];
    if (req.query.status) conditions.push(eq(servicesTable.status, String(req.query.status)));
    if (req.query.projectId)
      conditions.push(eq(servicesTable.projectId, parseInt(String(req.query.projectId), 10)));

    const services = conditions.length
      ? await db.select().from(servicesTable).where(and(...conditions)).orderBy(desc(servicesTable.id))
      : await db.select().from(servicesTable).orderBy(desc(servicesTable.id));

    const ids = services.map((s) => s.id);
    const files = ids.length
      ? await db.select().from(serviceFilesTable).where(inArray(serviceFilesTable.serviceId, ids))
      : [];
    const filesByService = new Map<number, ServiceFile[]>();
    for (const f of files) {
      const list = filesByService.get(f.serviceId) ?? [];
      list.push(f);
      filesByService.set(f.serviceId, list);
    }

    res.json(services.map((s) => ({ ...s, files: filesByService.get(s.id) ?? [] })));
  } catch (err) {
    req.log.error({ err }, "Failed to list services");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/services", async (req, res) => {
  try {
    const parsed = insertServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [service] = await db.insert(servicesTable).values(parsed.data).returning();
    res.status(201).json({ ...service, files: [] });
  } catch (err) {
    req.log.error({ err }, "Failed to create service");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/services/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, id));
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
    req.log.error({ err }, "Failed to get service");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/services/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const parsed = updateServiceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [service] = await db
      .update(servicesTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(servicesTable.id, id))
      .returning();
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
    req.log.error({ err }, "Failed to update service");
    res.status(500).json({ message: "Internal server error" });
  }
});

const addFileSchema = insertServiceFileSchema.omit({ serviceId: true });

router.post("/services/:id/files", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const parsed = addFileSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }
    const [file] = await db
      .insert(serviceFilesTable)
      .values({ ...parsed.data, serviceId: id })
      .returning();
    res.status(201).json(file);
  } catch (err) {
    req.log.error({ err }, "Failed to add service file");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/files/:fileId", async (req, res) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    await db.delete(serviceFilesTable).where(eq(serviceFilesTable.id, fileId));
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to delete service file");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
