/**
 * Nome e descrição dos grupos de WhatsApp.
 *
 * Separado de whatsapp-groups.ts porque é lógica pura: nada de banco, nada de
 * rede, testável direto.
 */
import type { WhatsappGroupKind } from "@workspace/db/schema";
import { GROUP_SUBJECT_MAX } from "./whatsmiau";

const PREFIXO: Record<WhatsappGroupKind, string> = {
  cliente: "Solo | ",
  instalacao: "Solo Obra | ",
  homologacao: "Solo Hml | ",
};

export function subjectMax(): number {
  const raw = Number(process.env.WHATSAPP_GROUP_SUBJECT_MAX);
  return Number.isFinite(raw) && raw > 0 ? raw : GROUP_SUBJECT_MAX;
}

/**
 * O whatsmiau valida `subject` com max=25 (o WhatsApp em si aceita 100 — é o
 * gateway que corta). O nome pretendido, "Solo | Usina - Fulano (12,5 kWp)",
 * quase nunca cabe, então encolhemos por prioridade: prefixo > nome > potência.
 *
 * O nome completo vai na descrição do grupo, que não tem limite.
 *
 * Se o gateway passar a aceitar mais, basta subir WHATSAPP_GROUP_SUBJECT_MAX:
 * os grupos novos já saem com o nome inteiro.
 */
export function buildGroupSubject(
  clientName: string,
  potenciaKwp: number | null | undefined,
  kind: WhatsappGroupKind,
  max: number = subjectMax(),
): string {
  const prefixo = PREFIXO[kind];
  const potencia = formatKwp(potenciaKwp);
  const sufixo = potencia ? ` ${potencia}` : "";

  const completo = `${prefixo}${clientName}${sufixo}`;
  if (completo.length <= max) return completo;

  // Encurtar o nome mantendo a potência é melhor que perder a potência: no
  // WhatsApp o operador reconhece o grupo pelo par cliente+usina.
  const espacoComPotencia = max - prefixo.length - sufixo.length;
  if (espacoComPotencia >= 6) {
    const nome = shortenName(clientName, espacoComPotencia);
    if (nome) return `${prefixo}${nome}${sufixo}`;
  }

  const semPotencia = `${prefixo}${clientName}`;
  if (semPotencia.length <= max) return semPotencia;

  const nomeSemPotencia = shortenName(clientName, max - prefixo.length);
  if (nomeSemPotencia) return `${prefixo}${nomeSemPotencia}`;

  // Último recurso: corte seco, sem deixar separador solto na ponta.
  return completo.slice(0, max).replace(/[\s|\-–—]+$/, "");
}

/** Nome completo pretendido — vira a descrição do grupo. */
export function buildGroupSubjectFull(
  clientName: string,
  potenciaKwp: number | null | undefined,
  kind: WhatsappGroupKind,
): string {
  const potencia = formatKwp(potenciaKwp);
  const base = `Solo | Usina - ${clientName}${potencia ? ` (${potencia})` : ""}`;
  if (kind === "instalacao") return `${base} — Equipe de Instalação`;
  if (kind === "homologacao") return `${base} — Homologação`;
  return base;
}

function formatKwp(potencia: number | null | undefined): string {
  if (potencia == null || !Number.isFinite(potencia) || potencia <= 0) return "";
  // 12 kWp, não 12.0 kWp; 12,5 kWp com vírgula (padrão pt-BR).
  const n = Number.isInteger(potencia) ? String(potencia) : potencia.toFixed(1).replace(".", ",");
  return `${n} kWp`;
}

/**
 * Reduz o nome ao maior prefixo de palavras que couber, acrescentando a inicial
 * do sobrenome seguinte quando ainda sobra espaço ("José Carlos S."). Devolve ""
 * quando nem a primeira palavra cabe.
 */
function shortenName(name: string, max: number): string {
  const limpo = name.trim().replace(/\s+/g, " ");
  if (max <= 0) return "";
  if (limpo.length <= max) return limpo;

  const palavras = limpo.split(" ");
  for (let n = palavras.length - 1; n >= 1; n--) {
    const tentativa = palavras.slice(0, n).join(" ");
    if (tentativa.length <= max) {
      const comInicial = `${tentativa} ${palavras[n][0]}.`;
      return comInicial.length <= max ? comInicial : tentativa;
    }
  }
  return palavras[0].slice(0, max);
}

// ─── Casar grupo existente com cliente ────────────────────────────────────────

/** Sem acento, minúsculo, só letras e números — para comparar nomes. */
function chaveDeBusca(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Quanto o nome do grupo lembra o do cliente, de 0 a 1.
 *
 * Os grupos da Solo seguem "Solo | Usina - Tiago (6,30 kWp)", então o que conta
 * é quantas palavras do nome do cliente aparecem no nome do grupo. Palavra de
 * até 3 letras (de, da, dos) não pontua — casaria com meio mundo de grupo.
 */
export function pontuarGrupo(subject: string, clientName: string): number {
  const alvo = chaveDeBusca(subject);
  const palavras = chaveDeBusca(clientName)
    .split(" ")
    .filter((p) => p.length > 3);
  if (palavras.length === 0) return 0;

  const acertos = palavras.filter((p) => alvo.includes(p)).length;
  if (acertos === 0) return 0;

  // Pesos que somam 1: proporção de palavras (0,7) + primeiro nome (0,2) +
  // padrão da casa (0,1). Somar sem teto e cortar em 1 no fim empataria tudo em
  // 1 — e aí o desempate entre "Solo | Usina - Clairton" e "Solar Clairton"
  // deixaria de existir.
  let score = 0.7 * (acertos / palavras.length);
  if (alvo.includes(palavras[0])) score += 0.2;
  if (/\busina\b/.test(alvo)) score += 0.1;

  // Duas casas: 0,7+0,2+0,1 dá 0,9999999999999999 em ponto flutuante, e o score
  // viaja no JSON para o front.
  return Math.min(1, Math.round(score * 100) / 100);
}
