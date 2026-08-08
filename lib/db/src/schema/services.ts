import { pgTable, serial, integer, text, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Mirrors the Jestor "Serviços / Contratos" table.
export const servicesTable = pgTable("services", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id"),
  name: text("name").notNull(),
  tipoServico: text("tipo_servico"),
  valorServico: real("valor_servico"),
  status: text("status").notNull().default("Agendado"),
  statusPagamento: text("status_pagamento").notNull().default("Pendente"),
  pagamentoRealizado: boolean("pagamento_realizado").notNull().default(false),
  dataExecucao: timestamp("data_execucao"),
  dataInicio: timestamp("data_inicio"),
  dataTermino: timestamp("data_termino"),
  equipeExecucao: text("equipe_execucao"),
  endereco: text("endereco"),
  responsavelEmail: text("responsavel_email"),
  observacoes: text("observacoes"),
  // Financeiro do serviço
  valorProposto: real("valor_proposto"),
  valorFechado: real("valor_fechado"),
  custoLogistica: real("custo_logistica"),
  outrosCustos: real("outros_custos"),
  formaPagamento: text("forma_pagamento"),
  pixConta: text("pix_conta"),
  comprovanteUrl: text("comprovante_url"),
  // Contrato de prestação de serviço
  contratoUrl: text("contrato_url"),
  contratoStatus: text("contrato_status").notNull().default("pendente"), // pendente | enviado | aceito
  contratoAceitoEm: timestamp("contrato_aceito_em"),
  contratoAceitoPor: text("contrato_aceito_por"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertServiceSchema = createInsertSchema(servicesTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    dataExecucao: z.coerce.date().nullish(),
    dataInicio: z.coerce.date().nullish(),
    dataTermino: z.coerce.date().nullish(),
    contratoAceitoEm: z.coerce.date().nullish(),
  });
export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof servicesTable.$inferSelect;

// Hour-1 file handling: URL references (Drive etc.). Object storage upload is a follow-up.
export const serviceFilesTable = pgTable("service_files", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull(),
  kind: text("kind").notNull().default("imagens_documentacao"), // contrato_escopo | imagens_documentacao
  name: text("name"),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertServiceFileSchema = createInsertSchema(serviceFilesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertServiceFile = z.infer<typeof insertServiceFileSchema>;
export type ServiceFile = typeof serviceFilesTable.$inferSelect;
