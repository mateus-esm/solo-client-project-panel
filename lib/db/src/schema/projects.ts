import { pgTable, serial, text, integer, real, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  jestorId: text("jestor_id").unique(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  clientPhone: text("client_phone"),
  systemPower: real("system_power").notNull().default(0),
  statusStep: integer("status_step").notNull().default(1),
  statusProjeto: text("status_projeto"),
  trackingCode: text("tracking_code"),
  trackingCarrier: text("tracking_carrier"),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  completionPercent: integer("completion_percent").notNull().default(0),
  estimatedActivation: text("estimated_activation"),
  notes: text("notes"),
  estimatedDate: text("estimated_date"),
  valorProjeto: real("valor_projeto"),
  formaDePagamento: text("forma_de_pagamento"),
  observacoesGerais: text("observacoes_gerais"),
  dataInicioPrevista: text("data_inicio_prevista"),
  dataConclusaoPrevista: text("data_conclusao_prevista"),
  dataDeFechamento: text("data_de_fechamento"),
  dataDePagamento: text("data_de_pagamento"),
  dataDeCompras: text("data_de_compras"),
  dataDeEntregaDoEquipamento: text("data_de_entrega_do_equipamento"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;

export const documentsTable = pgTable("documents", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  category: text("category").notNull().default("entrada"),
  required: boolean("required").notNull().default(false),
  description: text("description"),
  fileUrl: text("file_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDocumentSchema = createInsertSchema(documentsTable).omit({ id: true, createdAt: true });
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documentsTable.$inferSelect;

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({ id: true, createdAt: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
