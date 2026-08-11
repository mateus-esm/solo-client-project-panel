import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Grupos de WhatsApp por projeto ───────────────────────────────────────────
// Um projeto tem até um grupo por público. O JID (…@g.us) é devolvido pelo
// whatsmiau na criação e é a identidade permanente do grupo: guardamos para não
// depender de procurar o grupo pelo nome depois.

export const WHATSAPP_GROUP_KINDS = ["cliente", "instalacao", "homologacao"] as const;
export type WhatsappGroupKind = (typeof WHATSAPP_GROUP_KINDS)[number];

export const WHATSAPP_GROUP_KIND_LABELS: Record<WhatsappGroupKind, string> = {
  cliente: "Grupo do cliente",
  instalacao: "Grupo da equipe de instalação",
  homologacao: "Grupo da homologação",
};

/** Participante gravado no momento da criação — histórico, não fonte da verdade. */
export interface WhatsappGroupParticipant {
  jid: string;
  papel: string;
  /** O whatsmiau devolve error != 0 quando a privacidade do contato barra a entrada. */
  error?: number;
}

export const whatsappGroupsTable = pgTable(
  "whatsapp_groups",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    kind: text("kind").notNull(),
    jid: text("jid").notNull(),
    subject: text("subject").notNull(),
    /** Nome completo pretendido — o subject do WhatsApp é limitado a 25 caracteres. */
    subjectFull: text("subject_full"),
    inviteUrl: text("invite_url"),
    participants: jsonb("participants").$type<WhatsappGroupParticipant[]>().default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("UQ_whatsapp_groups_project_kind").on(table.projectId, table.kind),
    index("IDX_whatsapp_groups_jid").on(table.jid),
  ],
);

export const insertWhatsappGroupSchema = createInsertSchema(whatsappGroupsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertWhatsappGroup = z.infer<typeof insertWhatsappGroupSchema>;
export type WhatsappGroup = typeof whatsappGroupsTable.$inferSelect;

// ─── Log de envios ────────────────────────────────────────────────────────────
// Toda notificação disparada pelo ERP fica registrada, com o texto exatamente
// como saiu (já editado pelo operador). É o histórico de comunicação do projeto.

export const whatsappSendsTable = pgTable(
  "whatsapp_sends",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id"),
    /** Código do template usado (ex.: "HML-04"); null quando o texto foi escrito à mão. */
    templateCode: text("template_code"),
    /** grupo | privado */
    targetType: text("target_type").notNull(),
    /** cliente | instalacao | homologacao — a quem se destina, grupo ou privado. */
    targetKind: text("target_kind").notNull(),
    targetJid: text("target_jid").notNull(),
    /** Rótulo legível do destino, congelado no envio ("Grupo do cliente"). */
    targetLabel: text("target_label"),
    body: text("body").notNull(),
    /** enviado | falhou */
    status: text("status").notNull().default("enviado"),
    error: text("error"),
    sentBy: text("sent_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("IDX_whatsapp_sends_project").on(table.projectId, table.createdAt)],
);

export const insertWhatsappSendSchema = createInsertSchema(whatsappSendsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWhatsappSend = z.infer<typeof insertWhatsappSendSchema>;
export type WhatsappSend = typeof whatsappSendsTable.$inferSelect;

// ─── Biblioteca de templates ──────────────────────────────────────────────────
// Fica no banco para o time de CX ajustar o texto sem mexer em código nem
// esperar deploy. O catálogo em código (whatsapp-templates.ts) é a carga de
// fábrica: semeia a tabela na primeira leitura e depois não manda mais nada.

/** Variável do template. `auto` liga a chave ao dado do projeto. */
export interface NotificationTemplateVar {
  key: string;
  label: string;
  auto?: string;
  multiline?: boolean;
}

export const notificationTemplatesTable = pgTable(
  "notification_templates",
  {
    id: serial("id").primaryKey(),
    /** Código curto e estável (HML-04). É o que vai no log de envios. */
    code: text("code").notNull(),
    categoria: text("categoria").notNull(),
    nome: text("nome").notNull(),
    quandoUsar: text("quando_usar").notNull().default(""),
    /** cliente | equipe */
    publico: text("publico").notNull().default("cliente"),
    vars: jsonb("vars").$type<NotificationTemplateVar[]>().notNull().default([]),
    body: text("body").notNull(),
    /** Arquivado some da lista de envio mas continua explicando o histórico. */
    ativo: boolean("ativo").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("UQ_notification_templates_code").on(table.code)],
);

export const insertNotificationTemplateSchema = createInsertSchema(
  notificationTemplatesTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertNotificationTemplate = z.infer<typeof insertNotificationTemplateSchema>;
export type NotificationTemplateRow = typeof notificationTemplatesTable.$inferSelect;
