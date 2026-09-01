import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientIntakeSubmissionsTable = pgTable("client_intake_submissions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().unique(),
  status: text("status").notNull().default("draft"),
  data: jsonb("data").$type<Record<string, string>>().notNull().default({}),
  submittedAt: timestamp("submitted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertClientIntakeSubmissionSchema = createInsertSchema(clientIntakeSubmissionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClientIntakeSubmission = z.infer<typeof insertClientIntakeSubmissionSchema>;
export type ClientIntakeSubmission = typeof clientIntakeSubmissionsTable.$inferSelect;