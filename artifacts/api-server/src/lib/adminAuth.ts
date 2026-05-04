import { randomBytes, createHash, timingSafeEqual } from "crypto";
import { logger } from "./logger";
import type { Request, Response, NextFunction } from "express";

const ADMIN_SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

type AdminSession = { expiresAt: number };

// In-memory admin sessions (single owner; resets on server restart)
const adminSessions = new Map<string, AdminSession>();

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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
  adminSessions.set(tokenHash, { expiresAt: Date.now() + ADMIN_SESSION_DURATION_MS });
  return token;
}

export async function resolveAdminSession(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);
  const session = adminSessions.get(tokenHash);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    adminSessions.delete(tokenHash);
    return false;
  }
  return true;
}

export async function deleteAdminSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  adminSessions.delete(tokenHash);
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
