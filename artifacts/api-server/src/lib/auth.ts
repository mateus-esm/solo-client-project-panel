import { randomBytes, createHash } from "crypto";
import { db } from "@workspace/db";
import { sessionsTable, otpCodesTable, projectsTable } from "@workspace/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { logger } from "./logger";

const SESSION_DURATION_DAYS = 30;
const OTP_EXPIRY_MINUTES = 10;

// ─── In-memory rate limits (reset on restart; acceptable for this low-traffic portal) ─────────────────
// request-otp: max 3 requests per email per 15 min
const requestCooldowns = new Map<string, { count: number; resetAt: number }>();
const MAX_OTP_REQUESTS = 3;
const OTP_REQUEST_WINDOW_MS = 15 * 60 * 1000;

// verify-otp: max 5 attempts per email before OTPs are invalidated
const verifyAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_VERIFY_ATTEMPTS = 5;
const VERIFY_WINDOW_MS = OTP_EXPIRY_MINUTES * 60 * 1000;

export type VerifyOtpResult =
  | { ok: true; projectId: number }
  | { ok: false; reason: "invalid_otp" | "rate_limited" | "no_project" };

export type RequestOtpResult =
  | { ok: true; code: string }
  | { ok: false; reason: "rate_limited" };

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function generateOtpCode(): string {
  const num = parseInt(randomBytes(3).toString("hex"), 16) % 1000000;
  return String(num).padStart(6, "0");
}

// ─── Request-OTP rate limit ───────────────────────────────────────────────────
function checkRequestRateLimit(email: string): boolean {
  const now = Date.now();
  const entry = requestCooldowns.get(email);

  if (!entry || now > entry.resetAt) {
    requestCooldowns.set(email, { count: 1, resetAt: now + OTP_REQUEST_WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_OTP_REQUESTS) {
    return false;
  }

  entry.count++;
  return true;
}

// ─── Verify-OTP attempt tracking ─────────────────────────────────────────────
function recordFailedVerify(email: string): boolean {
  const now = Date.now();
  const entry = verifyAttempts.get(email);

  if (!entry || now > entry.resetAt) {
    verifyAttempts.set(email, { count: 1, resetAt: now + VERIFY_WINDOW_MS });
    return false;
  }

  entry.count++;

  if (entry.count >= MAX_VERIFY_ATTEMPTS) {
    return true;
  }

  return false;
}

function resetVerifyAttempts(email: string): void {
  verifyAttempts.delete(email);
}

// ─── Public functions ─────────────────────────────────────────────────────────
export async function createOtp(email: string): Promise<RequestOtpResult> {
  if (!checkRequestRateLimit(email)) {
    return { ok: false, reason: "rate_limited" };
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await db.insert(otpCodesTable).values({ email, code, expiresAt });
  return { ok: true, code };
}

export async function verifyOtp(email: string, code: string): Promise<VerifyOtpResult> {
  const now = new Date();

  const [otp] = await db
    .select()
    .from(otpCodesTable)
    .where(
      and(
        eq(otpCodesTable.email, email.toLowerCase()),
        eq(otpCodesTable.code, code),
        eq(otpCodesTable.used, false),
        gt(otpCodesTable.expiresAt, now)
      )
    )
    .limit(1);

  if (!otp) {
    const locked = recordFailedVerify(email);
    if (locked) {
      logger.warn({ email }, "OTP verify attempts exceeded — invalidating all active OTPs");
      await db
        .update(otpCodesTable)
        .set({ used: true })
        .where(and(eq(otpCodesTable.email, email), eq(otpCodesTable.used, false)));
      return { ok: false, reason: "rate_limited" };
    }
    return { ok: false, reason: "invalid_otp" };
  }

  await db
    .update(otpCodesTable)
    .set({ used: true })
    .where(eq(otpCodesTable.id, otp.id));

  resetVerifyAttempts(email);

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.clientEmail, email.toLowerCase()))
    .limit(1);

  if (!project) {
    return { ok: false, reason: "no_project" };
  }

  return { ok: true, projectId: project.id };
}

export async function createSession(projectId: number): Promise<string> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000
  );

  await db.insert(sessionsTable).values({ projectId, tokenHash, expiresAt });
  return token;
}

export async function resolveSession(
  token: string
): Promise<{ projectId: number; clientName: string; clientEmail: string } | null> {
  const tokenHash = hashToken(token);
  const now = new Date();

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(
      and(
        eq(sessionsTable.tokenHash, tokenHash),
        gt(sessionsTable.expiresAt, now)
      )
    )
    .limit(1);

  if (!session) return null;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.id, session.projectId))
    .limit(1);

  if (!project) return null;

  return {
    projectId: project.id,
    clientName: project.clientName,
    clientEmail: project.clientEmail,
  };
}

export async function deleteSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db.delete(sessionsTable).where(eq(sessionsTable.tokenHash, tokenHash));
}
