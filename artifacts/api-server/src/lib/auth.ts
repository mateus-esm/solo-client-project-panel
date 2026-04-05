import { randomBytes, createHash } from "crypto";
import { db } from "@workspace/db";
import { sessionsTable, otpCodesTable, projectsTable } from "@workspace/db/schema";
import { eq, and, gt } from "drizzle-orm";

const SESSION_DURATION_DAYS = 30;
const OTP_EXPIRY_MINUTES = 10;

export function generateOtpCode(): string {
  const num = parseInt(randomBytes(3).toString("hex"), 16) % 1000000;
  return String(num).padStart(6, "0");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createOtp(email: string): Promise<string> {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await db.insert(otpCodesTable).values({ email, code, expiresAt });
  return code;
}

export async function verifyOtp(
  email: string,
  code: string
): Promise<number | null> {
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

  if (!otp) return null;

  await db
    .update(otpCodesTable)
    .set({ used: true })
    .where(eq(otpCodesTable.id, otp.id));

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.clientEmail, email.toLowerCase()))
    .limit(1);

  return project?.id ?? null;
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
