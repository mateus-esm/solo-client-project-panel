import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { resolveSession } from "../lib/auth";
import { resolveAdminSession } from "../lib/adminAuth";
import { resolveInstallerSession, INSTALLER_COOKIE } from "../lib/installerAuth";
import { db } from "@workspace/db";
import {
  documentsTable,
  servicesTable,
  installerTeamMembersTable,
} from "@workspace/db/schema";
import { eq, or, and } from "drizzle-orm";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// Checks whether the authenticated installer's team owns a file stored at the
// given URL: a service contract/comprovante for their team, or a member
// photo/ID document of their own account.
async function installerOwnsFile(
  accountId: number,
  teamName: string,
  fileUrl: string
): Promise<boolean> {
  const [svc] = await db
    .select({ id: servicesTable.id })
    .from(servicesTable)
    .where(
      and(
        eq(servicesTable.equipeExecucao, teamName),
        or(eq(servicesTable.contratoUrl, fileUrl), eq(servicesTable.comprovanteUrl, fileUrl))
      )
    )
    .limit(1);
  if (svc) return true;
  const [member] = await db
    .select({ id: installerTeamMembersTable.id })
    .from(installerTeamMembersTable)
    .where(
      and(
        eq(installerTeamMembersTable.accountId, accountId),
        or(
          eq(installerTeamMembersTable.photoUrl, fileUrl),
          eq(installerTeamMembersTable.docUrl, fileUrl)
        )
      )
    )
    .limit(1);
  return Boolean(member);
}

router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;
    const fileUrl = `/api/storage${objectPath}`;

    let authorized = false;

    // 1. Admin session: full access.
    const adminToken = req.cookies?.solo_admin_session;
    if (adminToken && (await resolveAdminSession(adminToken))) {
      authorized = true;
    }

    // 2. Client session: only documents belonging to their own project.
    if (!authorized) {
      const sessionToken = req.cookies?.solo_session;
      if (sessionToken) {
        const session = await resolveSession(sessionToken);
        if (session) {
          const [docRecord] = await db
            .select({ projectId: documentsTable.projectId })
            .from(documentsTable)
            .where(eq(documentsTable.objectPath, objectPath))
            .limit(1);
          if (docRecord && docRecord.projectId === session.projectId) authorized = true;
        }
      }
    }

    // 3. Installer session: contracts/comprovantes of their team's services and
    //    their own team-member photos/documents.
    if (!authorized) {
      const installerToken = req.cookies?.[INSTALLER_COOKIE];
      if (installerToken) {
        const account = await resolveInstallerSession(installerToken);
        if (account && (await installerOwnsFile(account.accountId, account.teamName, fileUrl))) {
          authorized = true;
        }
      }
    }

    if (!authorized) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;
