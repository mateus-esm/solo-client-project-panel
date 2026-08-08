import { Router, type IRouter, type RequestHandler } from "express";
import { db } from "@workspace/db";
import {
  servicesTable,
  serviceFilesTable,
  serviceTeamMembersTable,
  installerTeamMembersTable,
  installerAccountsTable,
  insertServiceSchema,
  insertServiceFileSchema,
  type ServiceFile,
} from "@workspace/db/schema";
import { eq, and, desc, inArray, type SQL } from "drizzle-orm";
import { z } from "zod/v4";
import multer from "multer";
import { ObjectStorageService } from "../../lib/objectStorage";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

const ALLOWED_UPLOAD_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/jpg"];
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

const updateServiceSchema = insertServiceSchema.partial();

// Load the installer team members assigned to a service (joined with member details).
async function loadServiceMembers(serviceId: number) {
  const rows = await db
    .select({ member: installerTeamMembersTable, linkId: serviceTeamMembersTable.id })
    .from(serviceTeamMembersTable)
    .innerJoin(
      installerTeamMembersTable,
      eq(serviceTeamMembersTable.memberId, installerTeamMembersTable.id)
    )
    .where(eq(serviceTeamMembersTable.serviceId, serviceId));
  return rows.map((r) => r.member);
}

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

    const memberLinks = ids.length
      ? await db
          .select({ member: installerTeamMembersTable, serviceId: serviceTeamMembersTable.serviceId })
          .from(serviceTeamMembersTable)
          .innerJoin(
            installerTeamMembersTable,
            eq(serviceTeamMembersTable.memberId, installerTeamMembersTable.id)
          )
          .where(inArray(serviceTeamMembersTable.serviceId, ids))
      : [];
    const membersByService = new Map<number, any[]>();
    for (const l of memberLinks) {
      const list = membersByService.get(l.serviceId) ?? [];
      list.push(l.member);
      membersByService.set(l.serviceId, list);
    }

    res.json(
      services.map((s) => ({
        ...s,
        files: filesByService.get(s.id) ?? [],
        members: membersByService.get(s.id) ?? [],
      }))
    );
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
    const id = parseInt(String(req.params.id), 10);
    const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, id));
    if (!service) {
      res.status(404).json({ message: "Serviço não encontrado" });
      return;
    }
    const [files, members] = await Promise.all([
      db.select().from(serviceFilesTable).where(eq(serviceFilesTable.serviceId, id)),
      loadServiceMembers(id),
    ]);
    res.json({ ...service, files, members });
  } catch (err) {
    req.log.error({ err }, "Failed to get service");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/services/:id", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
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
    const id = parseInt(String(req.params.id), 10);
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

// ─── Assign team members to a service ─────────────────────────────────────────

const setMembersSchema = z.object({ memberIds: z.array(z.number().int()) });

router.put("/services/:id/members", async (req, res) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) {
      res.status(400).json({ message: "ID inválido" });
      return;
    }
    const parsed = setMembersSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Dados inválidos", errors: parsed.error.issues });
      return;
    }

    const [service] = await db
      .select()
      .from(servicesTable)
      .where(eq(servicesTable.id, id))
      .limit(1);
    if (!service) {
      res.status(404).json({ message: "Serviço não encontrado" });
      return;
    }

    // Every assigned member must belong to the installer account whose team is
    // assigned to this service (services.equipeExecucao).
    if (parsed.data.memberIds.length) {
      if (!service.equipeExecucao) {
        res.status(400).json({ message: "Defina a equipe de execução do serviço antes de atribuir membros" });
        return;
      }
      const [account] = await db
        .select({ id: installerAccountsTable.id })
        .from(installerAccountsTable)
        .where(eq(installerAccountsTable.teamName, service.equipeExecucao))
        .limit(1);
      if (!account) {
        res.status(400).json({ message: "Equipe de execução não corresponde a nenhuma equipe cadastrada" });
        return;
      }
      const validMembers = await db
        .select({ id: installerTeamMembersTable.id })
        .from(installerTeamMembersTable)
        .where(
          and(
            eq(installerTeamMembersTable.accountId, account.id),
            inArray(installerTeamMembersTable.id, parsed.data.memberIds)
          )
        );
      if (validMembers.length !== new Set(parsed.data.memberIds).size) {
        res.status(400).json({ message: "Um ou mais membros não pertencem à equipe deste serviço" });
        return;
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(serviceTeamMembersTable).where(eq(serviceTeamMembersTable.serviceId, id));
      if (parsed.data.memberIds.length) {
        await tx
          .insert(serviceTeamMembersTable)
          .values(parsed.data.memberIds.map((memberId) => ({ serviceId: id, memberId })));
      }
    });
    res.json({ members: await loadServiceMembers(id) });
  } catch (err) {
    req.log.error({ err }, "Failed to set service members");
    res.status(500).json({ message: "Internal server error" });
  }
});

// ─── Upload contract or comprovante (kind via path) ───────────────────────────

async function handleServiceUpload(
  serviceId: number,
  field: "contratoUrl" | "comprovanteUrl",
  file: Express.Multer.File
) {
  const uploadURL = await objectStorage.getObjectEntityUploadURL();
  const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
  const gcsRes = await fetch(uploadURL, {
    method: "PUT",
    body: file.buffer,
    headers: { "Content-Type": file.mimetype },
  });
  if (!gcsRes.ok) throw new Error("storage upload failed");
  const fileUrl = `/api/storage${objectPath}`;
  const patch: Record<string, unknown> = { [field]: fileUrl, updatedAt: new Date() };
  // Uploading a contract moves it into "enviado" (ready for signature).
  if (field === "contratoUrl") patch.contratoStatus = "enviado";
  const [updated] = await db
    .update(servicesTable)
    .set(patch)
    .where(eq(servicesTable.id, serviceId))
    .returning();
  return updated;
}

router.post("/services/:id/contract/upload", uploadSingle, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || !req.file) {
    res.status(400).json({ message: "Requisição inválida" });
    return;
  }
  if (!ALLOWED_UPLOAD_TYPES.includes(req.file.mimetype)) {
    res.status(400).json({ message: "Tipo não permitido. Use PDF, JPG ou PNG." });
    return;
  }
  try {
    const updated = await handleServiceUpload(id, "contratoUrl", req.file);
    if (!updated) {
      res.status(404).json({ message: "Serviço não encontrado" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to upload contract");
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/services/:id/comprovante/upload", uploadSingle, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id) || !req.file) {
    res.status(400).json({ message: "Requisição inválida" });
    return;
  }
  if (!ALLOWED_UPLOAD_TYPES.includes(req.file.mimetype)) {
    res.status(400).json({ message: "Tipo não permitido. Use PDF, JPG ou PNG." });
    return;
  }
  try {
    const updated = await handleServiceUpload(id, "comprovanteUrl", req.file);
    if (!updated) {
      res.status(404).json({ message: "Serviço não encontrado" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to upload comprovante");
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
