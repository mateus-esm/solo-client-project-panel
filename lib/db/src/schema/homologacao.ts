import { pgTable, serial, text, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Internal kanban stages of the homologação workflow (technician portal).
export const HOMOLOGACAO_KANBAN_STAGES = [
  "projeto_eletrico",
  "art",
  "envio_concessionaria",
  "acompanhamento",
  "aprovacao",
  "vistoria_concluido",
] as const;

export type HomologacaoKanbanStage = (typeof HOMOLOGACAO_KANBAN_STAGES)[number];

export const HOMOLOGACAO_KANBAN_LABELS: Record<HomologacaoKanbanStage, string> = {
  projeto_eletrico: "Projeto Elétrico",
  art: "ART",
  envio_concessionaria: "Envio à Concessionária",
  acompanhamento: "Acompanhamento",
  aprovacao: "Aprovação",
  vistoria_concluido: "Vistoria / Concluído",
};

export const homologacaoTechniciansTable = pgTable("homologacao_technicians", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHomologacaoTechnicianSchema = createInsertSchema(
  homologacaoTechniciansTable
).omit({ id: true, createdAt: true });
export type InsertHomologacaoTechnician = z.infer<
  typeof insertHomologacaoTechnicianSchema
>;
export type HomologacaoTechnician =
  typeof homologacaoTechniciansTable.$inferSelect;

// Per-project ficha do processo Enel — editable by the assigned technician and by admins.
export const homologacaoProcessosTable = pgTable("homologacao_processos", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().unique(),
  kanbanStage: text("kanban_stage").notNull().default("projeto_eletrico"),
  ucNumero: text("uc_numero"),
  numeroSolicitacao: text("numero_solicitacao"),
  linksEnel: text("links_enel"),
  emailAcompanhamento: text("email_acompanhamento"),
  // Map kanbanStage -> expected date (YYYY-MM-DD), updated as the process evolves.
  datasPrevistas: jsonb("datas_previstas").$type<Record<string, string>>().default({}),
  artPaga: boolean("art_paga").notNull().default(false),
  artNfUrl: text("art_nf_url"),
  artNfObjectPath: text("art_nf_object_path"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertHomologacaoProcessoSchema = createInsertSchema(
  homologacaoProcessosTable
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertHomologacaoProcesso = z.infer<typeof insertHomologacaoProcessoSchema>;
export type HomologacaoProcesso = typeof homologacaoProcessosTable.$inferSelect;

export const homologacaoSessionsTable = pgTable("homologacao_sessions", {
  id: serial("id").primaryKey(),
  technicianId: integer("technician_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
