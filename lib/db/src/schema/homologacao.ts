import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

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

export const homologacaoSessionsTable = pgTable("homologacao_sessions", {
  id: serial("id").primaryKey(),
  technicianId: integer("technician_id").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
