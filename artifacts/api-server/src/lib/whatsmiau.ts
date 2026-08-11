/**
 * Cliente do gateway whatsmiau (whatsmeow atrás de uma API HTTP).
 *
 * Base: WHATSAPP_API_URL + /v1, autenticado pelo header `apikey`.
 * Instância: WHATSAPP_INSTANCE (o número conectado da Solo).
 *
 * Rotas confirmadas contra o swagger do servidor (GET /v1/../swagger/doc.json):
 *   POST /v1/message/sendText/{instance}        { number, text }
 *   POST /v1/group/create/{instance}            { subject, participants[], description? }
 *   POST /v1/group/updateGroupPicture/{instance} { groupJid, image }
 *   POST /v1/group/updateGroupDescription/{instance} { groupJid, description }
 *   POST /v1/group/updateGroupSubject/{instance}  { groupJid, subject }
 *   POST /v1/group/updateParticipant/{instance}   { groupJid, action, participants[] }
 *   GET  /v1/group/inviteCode/{instance}?groupJid=…
 *   POST /v1/chat/whatsappNumbers/{instance}    { numbers[] }
 */
import { logger } from "./logger";

export type WhatsResult<T> = { ok: true; data: T } | { ok: false; error: string; status?: number };

/** Limite validado pelo whatsmiau no subject de grupo (tag `max=25`). */
export const GROUP_SUBJECT_MAX = 25;

export interface CreateGroupResponse {
  /** O swagger devolve `id`; deployments mais antigos devolvem `JID`. Ver normalizeGroupJid. */
  id?: string;
  JID?: string;
  subject?: string;
  owner?: string;
  participants?: Array<{ jid?: string; displayName?: string; error?: number }>;
}

function config(): { base: string; key: string; instance: string } | null {
  const base = process.env.WHATSAPP_API_URL;
  const key = process.env.WHATSAPP_API_KEY;
  if (!base || !key) return null;
  return {
    base: base.replace(/\/+$/, ""),
    key,
    instance: process.env.WHATSAPP_INSTANCE ?? "solobusiness",
  };
}

export function isWhatsAppConfigured(): boolean {
  return config() !== null;
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  query?: Record<string, string>,
): Promise<WhatsResult<T>> {
  const cfg = config();
  if (!cfg) {
    logger.warn("WhatsApp não configurado — WHATSAPP_API_URL ou WHATSAPP_API_KEY ausente");
    return { ok: false, error: "WhatsApp não configurado no servidor" };
  }
  const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
  const url = `${cfg.base}/v1${path.replace("{instance}", cfg.instance)}${qs}`;
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json", apikey: cfg.key },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    if (!res.ok) {
      // O whatsmiau devolve { message, errorMessage } nos 4xx — a mensagem dele é
      // muito mais útil que "HTTP 400" para quem está olhando o ERP.
      let detail = text.slice(0, 300);
      try {
        const j = JSON.parse(text);
        detail = j.errorMessage ?? j.message ?? detail;
      } catch {
        /* corpo não-JSON: fica o texto cru */
      }
      logger.error({ url, status: res.status, body: text.slice(0, 500) }, "whatsmiau retornou erro");
      return { ok: false, error: detail, status: res.status };
    }
    return { ok: true, data: (text ? JSON.parse(text) : {}) as T };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err, url }, "Falha ao chamar whatsmiau");
    return { ok: false, error: msg };
  }
}

// ─── Números e JIDs ───────────────────────────────────────────────────────────

/**
 * Normaliza para o formato que o WhatsApp espera: DDI 55 + DDD + número, só dígitos.
 * Aceita "(85) 9 9648-7923", "85996487923", "+5585996487923".
 */
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  // 0055… e 0 de operadora na frente do DDD.
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (!digits.startsWith("55")) digits = `55${digits}`;
  return digits;
}

/**
 * Checagem só de formato: 55 + DDD + 8 ou 9 dígitos.
 *
 * Não dá para ser mais esperto que isso offline. Celular brasileiro tem 9
 * dígitos, mas o JID que o WhatsApp usa para contas antigas continua com 8 — o
 * mesmo Gabriel é 5585999289511 quando discado e 558599289511 no JID. Rejeitar
 * a forma de 8 dígitos barraria número que funciona.
 *
 * Quem decide de verdade se o número existe é o WhatsApp, em resolveJids().
 */
export function isPlausibleBrazilianPhone(raw: string): boolean {
  const d = normalizePhone(raw);
  if (d.length !== 12 && d.length !== 13) return false;
  const ddd = Number(d.slice(2, 4));
  return ddd >= 11 && ddd <= 99;
}

/** Forma ingênua do JID. Use resolveJids() quando o JID for para valer. */
export function toUserJid(phone: string): string {
  return `${normalizePhone(phone)}@s.whatsapp.net`;
}

export interface NumeroResolvido {
  /** Como foi informado no cadastro. */
  entrada: string;
  exists: boolean;
  /** JID real do contato. Pode diferir do número digitado (nono dígito). */
  jid: string | null;
}

/**
 * Pergunta ao WhatsApp o JID real de cada número.
 *
 * Necessário porque montar `${digitos}@s.whatsapp.net` na mão dá errado: o
 * número 5585996487923 tem JID 558596487923@s.whatsapp.net. Criar o grupo com o
 * JID inventado adiciona ninguém e não reclama.
 */
export async function resolveJids(phones: string[]): Promise<Map<string, NumeroResolvido>> {
  const out = new Map<string, NumeroResolvido>();
  if (phones.length === 0) return out;

  const numeros = phones.map(normalizePhone);
  const res = await call<Array<{ exists?: boolean; jid?: string; number?: string }>>(
    "POST",
    "/chat/whatsappNumbers/{instance}",
    { numbers: numeros },
  );

  if (!res.ok) {
    // Gateway fora do ar não pode impedir a criação do grupo: cai na forma
    // ingênua, que funciona para a maioria dos números.
    logger.warn({ error: res.error }, "Não deu para resolver os JIDs — usando o número cru");
    for (let i = 0; i < phones.length; i++) {
      out.set(phones[i], { entrada: phones[i], exists: true, jid: toUserJid(numeros[i]) });
    }
    return out;
  }

  // A resposta é deduplicada por JID: dois números que apontam para o mesmo
  // contato voltam numa entrada só. Casamos pelo `number` devolvido e, quando
  // ele não bate, pelos dígitos do JID.
  const porNumero = new Map<string, { exists?: boolean; jid?: string }>();
  for (const r of res.data ?? []) {
    if (r.number) porNumero.set(normalizePhone(r.number), r);
    if (r.jid) porNumero.set(r.jid.split("@")[0], r);
  }

  for (let i = 0; i < phones.length; i++) {
    const achado = porNumero.get(numeros[i]);
    out.set(phones[i], {
      entrada: phones[i],
      exists: achado?.exists === true,
      jid: achado?.exists && achado.jid ? achado.jid : null,
    });
  }
  return out;
}

export function isGroupJid(target: string): boolean {
  return target.endsWith("@g.us");
}

/** Extrai o JID do grupo tolerando as duas formas de resposta (`id` e `JID`). */
export function normalizeGroupJid(res: CreateGroupResponse): string | null {
  const raw = res.id ?? res.JID;
  if (!raw) return null;
  return raw.includes("@") ? raw : `${raw}@g.us`;
}

// ─── Operações ────────────────────────────────────────────────────────────────

/** `target` pode ser telefone cru, JID de usuário ou JID de grupo. */
export async function sendText(target: string, text: string): Promise<WhatsResult<unknown>> {
  const number = target.includes("@") ? target : normalizePhone(target);
  return call("POST", "/message/sendText/{instance}", { number, text, linkPreview: true });
}

export async function createGroup(
  subject: string,
  participantJids: string[],
  description?: string,
): Promise<WhatsResult<CreateGroupResponse>> {
  return call<CreateGroupResponse>("POST", "/group/create/{instance}", {
    subject,
    participants: participantJids,
    ...(description ? { description } : {}),
  });
}

export async function updateGroupPicture(groupJid: string, imageBase64: string) {
  return call<{ pictureId?: string }>("POST", "/group/updateGroupPicture/{instance}", {
    groupJid,
    image: imageBase64,
  });
}

export async function updateGroupDescription(groupJid: string, description: string) {
  return call("POST", "/group/updateGroupDescription/{instance}", { groupJid, description });
}

export async function updateGroupSubject(groupJid: string, subject: string) {
  return call("POST", "/group/updateGroupSubject/{instance}", { groupJid, subject });
}

export async function addParticipants(groupJid: string, participantJids: string[]) {
  return call<{ participants?: Array<{ jid?: string; error?: number }> }>(
    "POST",
    "/group/updateParticipant/{instance}",
    { groupJid, action: "add", participants: participantJids },
  );
}

export async function getInviteCode(groupJid: string) {
  return call<{ inviteCode?: string; inviteUrl?: string }>(
    "GET",
    "/group/inviteCode/{instance}",
    undefined,
    { groupJid },
  );
}

export interface GrupoRemoto {
  id: string;
  subject: string;
  size?: number;
  desc?: string;
  owner?: string;
  creation?: number;
}

/** Todos os grupos em que o número conectado está. */
export async function fetchAllGroups(): Promise<WhatsResult<GrupoRemoto[]>> {
  const res = await call<GrupoRemoto[]>("GET", "/group/fetchAllGroups/{instance}");
  if (!res.ok) return res;
  return { ok: true, data: Array.isArray(res.data) ? res.data : [] };
}

/** Convite por mensagem — saída quando a privacidade do contato barra a adição direta. */
export async function sendGroupInvite(groupJid: string, numbers: string[], description?: string) {
  return call("POST", "/group/sendInvite/{instance}", {
    groupJid,
    numbers: numbers.map(normalizePhone),
    ...(description ? { description } : {}),
  });
}
