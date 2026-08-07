import { randomBytes, createHash, scryptSync, timingSafeEqual } from "crypto";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import {
  homologacaoTechniciansTable,
  homologacaoSessionsTable,
} from "@workspace/db/schema";
import { eq, lt } from "drizzle-orm";
import { logger } from "./logger";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = "solo_homologacao_session";

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
      .delete(homologacaoSessionsTable)
      .where(lt(homologacaoSessionsTable.expiresAt, new Date()));
  } catch (err) {
    logger.warn({ err }, "Failed to purge expired homologacao sessions");
  }
}

export async function createHomologacaoSession(technicianId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await db
    .insert(homologacaoSessionsTable)
    .values({ technicianId, tokenHash, expiresAt });
  purgeExpiredSessions();
  return token;
}

export async function resolveHomologacaoSession(
  token: string
): Promise<{ technicianId: number; technicianName: string; email: string } | null> {
  const tokenHash = hashToken(token);
  const rows = await db
    .select({
      technicianId: homologacaoSessionsTable.technicianId,
      expiresAt: homologacaoSessionsTable.expiresAt,
      name: homologacaoTechniciansTable.name,
      email: homologacaoTechniciansTable.email,
    })
    .from(homologacaoSessionsTable)
    .innerJoin(
      homologacaoTechniciansTable,
      eq(homologacaoSessionsTable.technicianId, homologacaoTechniciansTable.id)
    )
    .where(eq(homologacaoSessionsTable.tokenHash, tokenHash))
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];
  if (new Date() > row.expiresAt) {
    await db
      .delete(homologacaoSessionsTable)
      .where(eq(homologacaoSessionsTable.tokenHash, tokenHash));
    return null;
  }
  return {
    technicianId: row.technicianId,
    technicianName: row.name,
    email: row.email,
  };
}

export async function deleteHomologacaoSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db
    .delete(homologacaoSessionsTable)
    .where(eq(homologacaoSessionsTable.tokenHash, tokenHash));
}

export interface AuthenticatedRequest extends Request {
  technician?: { id: number; name: string; email: string };
}

export async function requireHomologacao(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ message: "Não autenticado" });
    return;
  }
  const tech = await resolveHomologacaoSession(token);
  if (!tech) {
    res.clearCookie(COOKIE_NAME, { path: "/" });
    res.status(401).json({ message: "Sessão expirada" });
    return;
  }
  req.technician = { id: tech.technicianId, name: tech.technicianName, email: tech.email };
  next();
}

export const HOMOLOGACAO_COOKIE = COOKIE_NAME;
