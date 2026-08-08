import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Installer accounts — one per installation team.
 * teamName maps to the equipe_execucao field on services.
 */
export const installerAccountsTable = pgTable("installer_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  teamName: text("team_name").notNull(), // must match equipe_execucao values in services table
  passwordHash: text("password_hash").notNull(),
  // Empresa (equipe cadastrada como empresa)
  razaoSocial: text("razao_social"),
  cnpj: text("cnpj"),
  responsavelNome: text("responsavel_nome"),
  responsavelTelefone: text("responsavel_telefone"),
  pixKey: text("pix_key"),
  formaPagamento: text("forma_pagamento"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInstallerAccountSchema = createInsertSchema(
  installerAccountsTable
).omit({ id: true, createdAt: true });
export type InsertInstallerAccount = z.infer<typeof insertInstallerAccountSchema>;
export type InstallerAccount = typeof installerAccountsTable.$inferSelect;

// Membros da equipe (com foto e documento de identidade)
export const installerTeamMembersTable = pgTable("installer_team_members", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  name: text("name").notNull(),
  documento: text("documento"), // RG/CPF
  photoUrl: text("photo_url"),
  docUrl: text("doc_url"), // foto do documento de identidade
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInstallerTeamMemberSchema = createInsertSchema(
  installerTeamMembersTable
).omit({ id: true, createdAt: true });
export type InsertInstallerTeamMember = z.infer<typeof insertInstallerTeamMemberSchema>;
export type InstallerTeamMember = typeof installerTeamMembersTable.$inferSelect;

// Quais membros vão para cada serviço
export const serviceTeamMembersTable = pgTable("service_team_members", {
  id: serial("id").primaryKey(),
  serviceId: integer("service_id").notNull(),
  memberId: integer("member_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ServiceTeamMember = typeof serviceTeamMembersTable.$inferSelect;

export const installerSessionsTable = pgTable("installer_sessions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInstallerSessionSchema = createInsertSchema(
  installerSessionsTable
).omit({ id: true, createdAt: true });
export type InsertInstallerSession = z.infer<typeof insertInstallerSessionSchema>;
export type InstallerSession = typeof installerSessionsTable.$inferSelect;
