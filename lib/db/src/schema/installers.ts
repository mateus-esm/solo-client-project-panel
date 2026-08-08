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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInstallerAccountSchema = createInsertSchema(
  installerAccountsTable
).omit({ id: true, createdAt: true });
export type InsertInstallerAccount = z.infer<typeof insertInstallerAccountSchema>;
export type InstallerAccount = typeof installerAccountsTable.$inferSelect;

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
