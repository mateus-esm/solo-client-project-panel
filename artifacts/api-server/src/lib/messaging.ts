import { Resend } from "resend";
import { logger } from "./logger";

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Solo Energia <noreply@soloenergia.com.br>";

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}

function getPortalUrl(): string {
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const primary = domains.split(",")[0].trim();
    return `https://${primary}`;
  }
  return "https://soloenergia.replit.app";
}

export async function sendWhatsApp(phone: string, text: string): Promise<void> {
  const waUrl = process.env.WHATSAPP_API_URL;
  const waKey = process.env.WHATSAPP_API_KEY;
  if (!waUrl || !waKey) {
    logger.warn("WhatsApp not configured — WHATSAPP_API_URL or WHATSAPP_API_KEY missing");
    return;
  }
  const number = normalizePhone(phone);
  const res = await fetch(waUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: waKey },
    body: JSON.stringify({ number, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    logger.error({ status: res.status, body }, "WhatsApp send failed");
    throw new Error(`WhatsApp API error: ${res.status}`);
  }
  logger.info({ number }, "WhatsApp message sent");
}

export async function sendInviteEmail(to: string, clientName: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    logger.warn("Resend not configured — RESEND_API_KEY missing");
    return;
  }
  const portalUrl = getPortalUrl();
  const loginUrl = `${portalUrl}/login`;
  const firstName = clientName.split(" ")[0];

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#111;border-radius:20px;border:1px solid #222;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#f97316,#ef4444);padding:32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">☀️ Solo Energia</p>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Portal do Cliente</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <p style="margin:0 0 16px;font-size:20px;font-weight:700;color:#fff;">Olá, ${firstName}! 👋</p>
            <p style="margin:0 0 16px;font-size:14px;color:#aaa;line-height:1.6;">
              Seu portal de acompanhamento do projeto solar está pronto. Acesse para visualizar o progresso da instalação, documentos e muito mais.
            </p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${loginUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#f97316,#ef4444);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:15px;">
                Acessar Meu Portal
              </a>
            </div>
            <p style="margin:0 0 8px;font-size:13px;color:#666;line-height:1.6;">
              Para entrar, use seu e-mail cadastrado: <strong style="color:#aaa;">${to}</strong>
            </p>
            <p style="margin:0;font-size:12px;color:#555;line-height:1.6;">
              Você receberá um código de acesso no seu e-mail ao fazer login.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 28px;border-top:1px solid #222;">
            <p style="margin:0;font-size:11px;color:#444;text-align:center;">
              Solo Energia &mdash; Energia solar para o seu futuro.<br>
              <a href="${portalUrl}" style="color:#f97316;text-decoration:none;">${portalUrl}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: "☀️ Seu portal Solar está pronto — Solo Energia",
    html,
  });
  logger.info({ to }, "Invite email sent");
}

export async function sendMessageEmail(to: string, clientName: string, title: string, body: string): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    logger.warn("Resend not configured — RESEND_API_KEY missing");
    return;
  }
  const portalUrl = getPortalUrl();
  const firstName = clientName.split(" ")[0];

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#111;border-radius:20px;border:1px solid #222;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#f97316,#ef4444);padding:32px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:700;color:#fff;letter-spacing:-0.5px;">☀️ Solo Energia</p>
            <p style="margin:8px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">Atualização do seu projeto</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <p style="margin:0 0 8px;font-size:14px;color:#aaa;">Olá, ${firstName} 👋</p>
            <p style="margin:0 0 20px;font-size:20px;font-weight:700;color:#fff;">${title}</p>
            <p style="margin:0 0 24px;font-size:14px;color:#aaa;line-height:1.7;white-space:pre-wrap;">${body}</p>
            <div style="text-align:center;margin:8px 0 4px;">
              <a href="${portalUrl}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#f97316,#ef4444);color:#fff;text-decoration:none;border-radius:12px;font-weight:700;font-size:14px;">
                Ver no Portal
              </a>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 28px;border-top:1px solid #222;">
            <p style="margin:0;font-size:11px;color:#444;text-align:center;">
              Solo Energia &mdash; <a href="${portalUrl}" style="color:#f97316;text-decoration:none;">${portalUrl}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject: `☀️ ${title} — Solo Energia`,
    html,
  });
  logger.info({ to, title }, "Message email sent");
}

export function buildInviteWhatsAppText(clientName: string): string {
  const portalUrl = getPortalUrl();
  const firstName = clientName.split(" ")[0];
  return `Olá, ${firstName}! ☀️\n\nSeu portal de acompanhamento do projeto solar está pronto!\n\nAcesse agora: ${portalUrl}/login\n\nUse o seu e-mail cadastrado para entrar — você receberá um código de verificação.\n\n— Equipe Solo Energia`;
}

export function buildMessageWhatsAppText(clientName: string, title: string, body: string): string {
  const firstName = clientName.split(" ")[0];
  return `Olá, ${firstName}! ☀️\n\n*${title}*\n\n${body}\n\n— Equipe Solo Energia`;
}
