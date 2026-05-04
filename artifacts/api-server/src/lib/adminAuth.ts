import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { logger } from "./logger";
import type { Request, Response, NextFunction } from "express";
import { db, adminSessionsTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";

const ADMIN_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function purgeExpiredSessions(): Promise<void> {
  try {
    await db.delete(adminSessionsTable).where(lt(adminSessionsTable.expiresAt, new Date()));
  } catch (err) {
    logger.warn({ err }, "Failed to purge expired admin sessions");
  }
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    logger.warn("ADMIN_PASSWORD env not set — admin login disabled");
    return false;
  }
  try {
    const a = Buffer.from(adminPassword);
    const b = Buffer.from(password);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function createAdminSession(): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_DURATION_MS);
  await db.insert(adminSessionsTable).values({ tokenHash, expiresAt });
  purgeExpiredSessions();
  return token;
}

export async function resolveAdminSession(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const rows = await db
    .select()
    .from(adminSessionsTable)
    .where(eq(adminSessionsTable.tokenHash, tokenHash))
    .limit(1);
  if (rows.length === 0) return false;
  const session = rows[0];
  if (new Date() > session.expiresAt) {
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.tokenHash, tokenHash));
    return false;
  }
  return true;
}

export async function deleteAdminSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db.delete(adminSessionsTable).where(eq(adminSessionsTable.tokenHash, tokenHash));
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.solo_admin_session;
  if (!token) {
    res.status(401).json({ message: "Admin não autenticado" });
    return;
  }
  const valid = await resolveAdminSession(token);
  if (!valid) {
    res.clearCookie("solo_admin_session", { path: "/" });
    res.status(401).json({ message: "Sessão admin expirada" });
    return;
  }
  next();
}
