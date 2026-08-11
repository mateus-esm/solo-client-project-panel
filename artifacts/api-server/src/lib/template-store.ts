/**
 * Biblioteca de templates viva, no banco.
 *
 * O catálogo em whatsapp-templates.ts é a carga de fábrica: semeia a tabela na
 * primeira leitura e nunca mais interfere. A partir daí a verdade é o banco, e
 * o time de CX edita o texto pelo ERP sem esperar deploy.
 *
 * Variáveis são derivadas do corpo, não digitadas: o que vale é `{{chave}}` no
 * texto. Manter uma lista à parte garantiria que uma hora ela ia divergir do
 * corpo — e aí o campo aparece no formulário sem ir para a mensagem, ou pior,
 * a mensagem sai com `[chave]` sem ter onde preencher.
 */
import { db } from "@workspace/db";
import {
  notificationTemplatesTable,
  type NotificationTemplateRow,
  type NotificationTemplateVar,
} from "@workspace/db/schema";
import { asc, eq } from "drizzle-orm";
import { logger } from "./logger";
import {
  AUTO_FILL_OPTIONS,
  NOTIFICATION_TEMPLATES,
  extrairChaves,
  reconciliarVars,
  type AutoFill,
  type NotificationTemplate,
  type TemplateVar,
} from "./whatsapp-templates";

const AUTO_FILLS_VALIDOS = new Set<string>(AUTO_FILL_OPTIONS.map((o) => o.value));

export { extrairChaves, reconciliarVars };

let semeando: Promise<void> | null = null;

/**
 * Semeia a tabela a partir do catálogo de código, uma vez só.
 *
 * A promessa fica guardada porque duas requisições simultâneas no boot chamariam
 * isto ao mesmo tempo; sem isso, as duas veriam a tabela vazia e tentariam
 * inserir. O onConflictDoNothing cobre a corrida de verdade, no banco.
 */
async function semearSeVazio(): Promise<void> {
  if (semeando) return semeando;
  semeando = (async () => {
    const [algum] = await db
      .select({ id: notificationTemplatesTable.id })
      .from(notificationTemplatesTable)
      .limit(1);
    if (algum) return;

    const linhas = NOTIFICATION_TEMPLATES.map((t, i) => ({
      code: t.code,
      categoria: t.categoria,
      nome: t.nome,
      quandoUsar: t.quandoUsar,
      publico: t.publico,
      vars: t.vars as NotificationTemplateVar[],
      body: t.body,
      ativo: true,
      sortOrder: i,
    }));
    await db.insert(notificationTemplatesTable).values(linhas).onConflictDoNothing();
    logger.info({ total: linhas.length }, "Biblioteca de templates semeada a partir do código");
  })().catch((err) => {
    // Falhar a semeadura não pode derrubar a leitura; a próxima chamada tenta de novo.
    semeando = null;
    logger.error({ err }, "Falha ao semear a biblioteca de templates");
  });
  return semeando;
}

/**
 * O banco guarda `auto` como texto livre. Um `auto` que não existe mais (chave
 * renomeada no código) não pode virar campo "preenchido automaticamente" que
 * nunca preenche nada — vira campo comum, digitado na hora.
 */
function sanitizarVars(vars: NotificationTemplateVar[]): TemplateVar[] {
  return vars.map((v) => ({
    key: v.key,
    label: v.label,
    ...(v.auto && AUTO_FILLS_VALIDOS.has(v.auto) ? { auto: v.auto as AutoFill } : {}),
    ...(v.multiline ? { multiline: true } : {}),
  }));
}

function paraApi(row: NotificationTemplateRow): NotificationTemplate {
  return {
    code: row.code,
    categoria: row.categoria as NotificationTemplate["categoria"],
    nome: row.nome,
    quandoUsar: row.quandoUsar,
    publico: row.publico as NotificationTemplate["publico"],
    vars: sanitizarVars(row.vars),
    body: row.body,
  };
}

/** Templates ativos, no formato que o bloco de envio consome. */
export async function listarTemplatesAtivos(): Promise<NotificationTemplate[]> {
  await semearSeVazio();
  const rows = await db
    .select()
    .from(notificationTemplatesTable)
    .where(eq(notificationTemplatesTable.ativo, true))
    .orderBy(asc(notificationTemplatesTable.sortOrder), asc(notificationTemplatesTable.id));
  return rows.map(paraApi);
}

/** Tudo, inclusive arquivados — a tela de administração precisa ver os dois. */
export async function listarTemplatesAdmin(): Promise<NotificationTemplateRow[]> {
  await semearSeVazio();
  return db
    .select()
    .from(notificationTemplatesTable)
    .orderBy(asc(notificationTemplatesTable.sortOrder), asc(notificationTemplatesTable.id));
}

export async function buscarPorCodigo(code: string): Promise<NotificationTemplateRow | null> {
  const [row] = await db
    .select()
    .from(notificationTemplatesTable)
    .where(eq(notificationTemplatesTable.code, code));
  return row ?? null;
}

export interface DadosTemplate {
  code: string;
  categoria: string;
  nome: string;
  quandoUsar?: string;
  publico?: string;
  body: string;
  ativo?: boolean;
  sortOrder?: number;
  /** Rótulos e `auto` informados pelo usuário; as chaves vêm sempre do corpo. */
  vars?: NotificationTemplateVar[];
}

export async function criarTemplate(d: DadosTemplate): Promise<NotificationTemplateRow> {
  const [row] = await db
    .insert(notificationTemplatesTable)
    .values({
      code: d.code.trim().toUpperCase(),
      categoria: d.categoria,
      nome: d.nome,
      quandoUsar: d.quandoUsar ?? "",
      publico: d.publico ?? "cliente",
      body: d.body,
      vars: reconciliarVars(d.body, d.vars ?? []),
      ativo: d.ativo ?? true,
      sortOrder: d.sortOrder ?? 999,
    })
    .returning();
  return row;
}

export async function atualizarTemplate(
  id: number,
  d: Partial<DadosTemplate>,
): Promise<NotificationTemplateRow | null> {
  const [atual] = await db
    .select()
    .from(notificationTemplatesTable)
    .where(eq(notificationTemplatesTable.id, id));
  if (!atual) return null;

  const body = d.body ?? atual.body;
  const [row] = await db
    .update(notificationTemplatesTable)
    .set({
      ...(d.code !== undefined ? { code: d.code.trim().toUpperCase() } : {}),
      ...(d.categoria !== undefined ? { categoria: d.categoria } : {}),
      ...(d.nome !== undefined ? { nome: d.nome } : {}),
      ...(d.quandoUsar !== undefined ? { quandoUsar: d.quandoUsar } : {}),
      ...(d.publico !== undefined ? { publico: d.publico } : {}),
      ...(d.ativo !== undefined ? { ativo: d.ativo } : {}),
      ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
      body,
      // Mesmo sem mexer no corpo, revalidamos: o usuário pode ter editado só os
      // rótulos das variáveis.
      vars: reconciliarVars(body, d.vars ?? atual.vars),
      updatedAt: new Date(),
    })
    .where(eq(notificationTemplatesTable.id, id))
    .returning();
  return row;
}

export async function excluirTemplate(id: number): Promise<void> {
  await db.delete(notificationTemplatesTable).where(eq(notificationTemplatesTable.id, id));
}

/**
 * Devolve à biblioteca os templates de fábrica que foram apagados, sem tocar nos
 * que já existem. Rede de segurança para quem apagou algo por engano.
 */
export async function restaurarPadrao(): Promise<number> {
  const linhas = NOTIFICATION_TEMPLATES.map((t, i) => ({
    code: t.code,
    categoria: t.categoria,
    nome: t.nome,
    quandoUsar: t.quandoUsar,
    publico: t.publico,
    vars: t.vars as NotificationTemplateVar[],
    body: t.body,
    ativo: true,
    sortOrder: i,
  }));
  const inseridos = await db
    .insert(notificationTemplatesTable)
    .values(linhas)
    .onConflictDoNothing()
    .returning({ id: notificationTemplatesTable.id });
  return inseridos.length;
}
