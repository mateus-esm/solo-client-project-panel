import { Router, type IRouter } from "express";
import { createOtp, verifyOtp, createSession, resolveSession, deleteSession } from "../lib/auth";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { projectsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

const COOKIE_NAME = "solo_session";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

function getCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: COOKIE_MAX_AGE,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

async function sendOtpEmail(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.warn({ email }, "RESEND_API_KEY not configured — OTP email not sent");
    return;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "Solo Energia <onboarding@resend.dev>",
        to: [email],
        subject: "Seu código de acesso ao Portal Solo Energia",
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #141414; color: #E3E2DD; padding: 40px; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <span style="font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">
                SOLO <span style="color: #FF481E;">ENERGIA</span>
              </span>
            </div>
            <h2 style="font-size: 22px; margin-bottom: 8px; color: #E3E2DD;">Seu código de acesso</h2>
            <p style="color: #999; margin-bottom: 32px;">Use o código abaixo para entrar no seu portal. Ele expira em 10 minutos.</p>
            <div style="background: #1f1f1f; border: 1px solid #2a2a2a; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
              <span style="font-size: 48px; font-weight: 900; letter-spacing: 12px; color: #FF481E;">${code}</span>
            </div>
            <p style="font-size: 13px; color: #666;">Se você não solicitou este código, ignore este e-mail.</p>
          </div>
        `,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      logger.error({ status: response.status, body }, "Resend OTP email error");
    }
  } catch (err) {
    logger.error({ err }, "Failed to send OTP email");
  }
}

router.post("/auth/request-otp", async (req, res) => {
  const { email } = req.body;

  if (!email || typeof email !== "string") {
    res.status(400).json({ message: "Email é obrigatório" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const result = await createOtp(normalizedEmail);

    if (!result.ok) {
      res.status(429).json({
        message: "Muitas tentativas. Aguarde alguns minutos antes de solicitar um novo código.",
      });
      return;
    }

    await sendOtpEmail(normalizedEmail, result.code);
    logger.info({ email: normalizedEmail }, "OTP requested");
    res.json({ message: "Código enviado para o seu e-mail" });
  } catch (err) {
    logger.error({ err }, "Failed to create OTP");
    res.status(500).json({ message: "Erro interno — tente novamente" });
  }
});

router.post("/auth/verify-otp", async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    res.status(400).json({ message: "Email e código são obrigatórios" });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    const result = await verifyOtp(normalizedEmail, String(code));

    if (!result.ok) {
      if (result.reason === "rate_limited") {
        res.status(429).json({
          message: "Muitas tentativas incorretas. Solicite um novo código.",
          reason: "rate_limited",
        });
        return;
      }

      if (result.reason === "no_project") {
        res.status(200).json({
          status: "no_project",
          message: "E-mail verificado, mas não há projeto vinculado à sua conta. Entre em contato com a Solo Energia.",
        });
        return;
      }

      res.status(401).json({ message: "Código inválido ou expirado" });
      return;
    }

    const token = await createSession(result.projectId);
    res.cookie(COOKIE_NAME, token, getCookieOptions());
    logger.info({ email: normalizedEmail, projectId: result.projectId }, "Session created");
    res.json({ status: "ok", message: "Login realizado com sucesso", projectId: result.projectId });
  } catch (err) {
    logger.error({ err }, "Failed to verify OTP");
    res.status(500).json({ message: "Erro interno — tente novamente" });
  }
});

router.get("/auth/me", async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    res.status(401).json({ message: "Não autenticado" });
    return;
  }

  try {
    const session = await resolveSession(token);
    if (!session) {
      res.clearCookie(COOKIE_NAME, { path: "/" });
      res.status(401).json({ message: "Sessão expirada" });
      return;
    }
    res.json({
      projectId: session.projectId,
      clientName: session.clientName,
      clientEmail: session.clientEmail,
    });
  } catch (err) {
    logger.error({ err }, "Failed to resolve session");
    res.status(500).json({ message: "Erro interno" });
  }
});

router.post("/auth/dev-login", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ message: "Not found" });
    return;
  }
  const TEST_EMAIL = "mateus@soloenergia.com.br";
  try {
    const [project] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.clientEmail, TEST_EMAIL))
      .limit(1);
    if (!project) {
      res.status(404).json({ message: "Projeto de teste não encontrado" });
      return;
    }
    const token = await createSession(project.id);
    res.cookie(COOKIE_NAME, token, getCookieOptions());
    logger.info({ email: TEST_EMAIL, projectId: project.id }, "Dev login");
    res.json({ status: "ok", message: "Login de teste realizado", projectId: project.id });
  } catch (err) {
    logger.error({ err }, "Dev login failed");
    res.status(500).json({ message: "Erro interno" });
  }
});

router.post("/auth/logout", async (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];

  if (token) {
    try {
      await deleteSession(token);
    } catch (err) {
      logger.error({ err }, "Failed to delete session on logout");
    }
  }

  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ message: "Logout realizado" });
});

export default router;
