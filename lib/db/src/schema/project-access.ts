import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Additional people authorized to enter the same client portal project.
 * The primary project clientEmail remains the canonical contact; these rows
 * only add login identities and do not duplicate the project.
 */
export const projectAccessEmailsTable = pgTable(
  "project_access_emails",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    email: text("email").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("UQ_project_access_email").on(table.projectId, table.email),
    index("IDX_project_access_email").on(table.email),
  ],
);

export const insertProjectAccessEmailSchema = createInsertSchema(
  projectAccessEmailsTable,
).omit({ id: true, createdAt: true });
export type InsertProjectAccessEmail = z.infer<typeof insertProjectAccessEmailSchema>;
export type ProjectAccessEmail = typeof projectAccessEmailsTable.$inferSelect;