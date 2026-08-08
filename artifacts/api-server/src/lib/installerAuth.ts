import { randomBytes, createHash, scryptSync, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import {
  installerAccountsTable,
  installerSessionsTable,
} from "@workspace/db/schema";
import { eq, lt } from "drizzle-orm";
import { logger } from "./logger";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
export const INSTALLER_COOKIE = "solo_installer_session";

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  try {
    const [salt, stored] = hash.split(":");
    const derived = scryptSync(password, salt, 64);
    const storedBuf = Buffer.from(stored, "hex");
    return timingSafeEqual(derived, storedBuf);
  } catch {
    return false;
  }
}

async function purgeExpiredSessions(): Promise<void> {
  try {
    await db
      .delete(installerSessionsTable)
      .where(lt(installerSessionsTable.expiresAt, new Date()));
  } catch (err) {
    logger.warn({ err }, "Failed to purge expired installer sessions");
  }
}

export async function createInstallerSession(accountId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db
    .insert(installerSessionsTable)
    .values({ accountId, tokenHash, expiresAt });
  purgeExpiredSessions();
  return token;
}

export async function resolveInstallerSession(
  token: string
): Promise<{ accountId: number; name: string; email: string; teamName: string } | null> {
  const tokenHash = hashToken(token);
  const rows = await db
    .select({
      accountId: installerSessionsTable.accountId,
      expiresAt: installerSessionsTable.expiresAt,
      name: installerAccountsTable.name,
      email: installerAccountsTable.email,
      teamName: installerAccountsTable.teamName,
    })
    .from(installerSessionsTable)
    .innerJoin(
      installerAccountsTable,
      eq(installerSessionsTable.accountId, installerAccountsTable.id)
    )
    .where(eq(installerSessionsTable.tokenHash, tokenHash))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];
  if (new Date() > row.expiresAt) {
    await db
      .delete(installerSessionsTable)
      .where(eq(installerSessionsTable.tokenHash, tokenHash));
    return null;
  }
  return {
    accountId: row.accountId,
    name: row.name,
    email: row.email,
    teamName: row.teamName,
  };
}

export async function deleteInstallerSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db
    .delete(installerSessionsTable)
    .where(eq(installerSessionsTable.tokenHash, tokenHash));
}

export interface InstallerRequest extends Request {
  installer?: { id: number; name: string; email: string; teamName: string };
}

export async function requireInstaller(
  req: InstallerRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.[INSTALLER_COOKIE];
  if (!token) {
    res.status(401).json({ message: "Não autenticado" });
    return;
  }
  const account = await resolveInstallerSession(token);
  if (!account) {
    res.clearCookie(INSTALLER_COOKIE, { path: "/" });
    res.status(401).json({ message: "Sessão expirada" });
    return;
  }
  req.installer = {
    id: account.accountId,
    name: account.name,
    email: account.email,
    teamName: account.teamName,
  };
  next();
}
