import { logger } from "./logger";

const WHATSAPP_INSTANCE = "solobusiness";

interface WhatsAppPayload {
  number: string;
  text: string;
}

export async function sendWhatsApp(phone: string, message: string): Promise<void> {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const apiToken = process.env.WHATSAPP_API_TOKEN;

  if (!apiUrl || !apiToken) {
    logger.warn("WhatsApp not configured (WHATSAPP_API_URL or WHATSAPP_API_TOKEN missing) — skipping");
    return;
  }

  const cleanPhone = phone.replace(/\D/g, "");
  const numberWithCountry = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

  try {
    const url = `${apiUrl}/v1/message/sendText/${WHATSAPP_INSTANCE}`;
    const payload: WhatsAppPayload = { number: numberWithCountry, text: message };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": apiToken,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error({ status: response.status, body, phone }, "WhatsApp API error");
      return;
    }

    logger.info({ phone: numberWithCountry }, "WhatsApp message sent");
  } catch (err) {
    logger.error({ err, phone }, "Failed to send WhatsApp message");
  }
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    logger.warn("RESEND_API_KEY not configured — skipping email");
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Solo Energia <noreply@soloenergia.com.br>",
        to: [to],
        subject,
        html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      logger.error({ status: response.status, body, to }, "Resend API error");
      return;
    }

    logger.info({ to, subject }, "Email sent via Resend");
  } catch (err) {
    logger.error({ err, to }, "Failed to send email via Resend");
  }
}

export function buildPhaseNotification(
  step: number,
  clientName: string,
  trackingCode?: string | null
): { title: string; whatsapp: string; emailSubject: string; emailHtml: string } {
  const firstName = clientName.split(" ")[0];
  const portalUrl = process.env.PORTAL_URL ?? "https://seuportal.soloenergia.com.br";

  const phases: Record<number, { title: string; body: string }> = {
    1: {
      title: "Bem-vindo ao Portal Solo Energia! ☀️",
      body: `Seu projeto foi iniciado e já está sendo preparado. Acesse o portal para acompanhar cada etapa da sua jornada solar.`,
    },
    2: {
      title: "Engenharia em andamento 📐",
      body: `Nossa equipe de engenharia está elaborando o projeto técnico da sua usina solar. Em breve teremos novidades!`,
    },
    3: {
      title: "Projeto enviado para Homologação 🏛️",
      body: `O projeto foi submetido à concessionária de energia para aprovação. Esta etapa pode levar alguns dias — fique tranquilo, estamos acompanhando!`,
    },
    4: {
      title: "Equipamentos em Logística 🚚",
      body: `Sua usina foi aprovada pela concessionária! Os equipamentos já estão sendo separados e despachados para você.${trackingCode ? ` Rastreie com o código: *${trackingCode}*` : ""}`,
    },
    5: {
      title: "Instalação em andamento 🔧",
      body: `Nossa equipe técnica está trabalhando na instalação dos painéis e inversor solar no seu imóvel. Logo sua usina estará pronta!`,
    },
    6: {
      title: "Usina Solar Ativada! ☀️🎉",
      body: `Parabéns, ${firstName}! Sua usina solar está ativa e gerando energia limpa. Acesse o portal para ativar o monitoramento em tempo real.`,
    },
  };

  const phase = phases[step] ?? phases[1];

  const whatsapp = `☀️ *Solo Energia* | Atualização do seu projeto\n\nOlá, ${firstName}!\n\n${phase.title}\n\n${phase.body}\n\n👉 Acompanhe no portal: ${portalUrl}`;

  const emailHtml = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#141414;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:32px;">
      <img src="${portalUrl}/logo-dark.png" alt="Solo Energia" height="48" style="height:48px;" />
    </div>
    <div style="background:#1e1e1e;border-radius:16px;padding:32px;border:1px solid #2a2a2a;">
      <h1 style="color:#FF481E;font-size:22px;margin:0 0 8px 0;">${phase.title}</h1>
      <h2 style="color:#E3E2DD;font-size:18px;margin:0 0 16px 0;">Olá, ${firstName}!</h2>
      <p style="color:#9ca3af;font-size:16px;line-height:1.6;margin:0 0 24px 0;">${phase.body}</p>
      <a href="${portalUrl}" style="display:inline-block;background:#FF481E;color:#fff;font-weight:bold;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:16px;">
        Acompanhar no Portal
      </a>
    </div>
    <p style="color:#4b5563;font-size:12px;text-align:center;margin-top:24px;">
      Solo Energia · Você no controle da sua energia
    </p>
  </div>
</body>
</html>
  `.trim();

  return {
    title: phase.title,
    whatsapp,
    emailSubject: `Solo Energia: ${phase.title}`,
    emailHtml,
  };
}
