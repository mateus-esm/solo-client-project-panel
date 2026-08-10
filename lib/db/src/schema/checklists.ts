import { pgTable, serial, integer, text, boolean, timestamp, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// One row per checklist item. Groups (checklistSlug/title) come from CHECKLIST_TEMPLATE
// in pipeline.ts — items are created on demand per project, matching Jestor todoList usage.
export const projectChecklistItemsTable = pgTable(
  "project_checklist_items",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    stage: text("stage").notNull(),
    checklistSlug: text("checklist_slug").notNull(),
    label: text("label").notNull(),
    // Item behavior: "check" = simple checkbox; "form" = structured fields saved to metadata;
    // "service" = creates a linked service + notifies the team; "client_notify" = notifies client.
    kind: text("kind").notNull().default("check"),
    // jestor = importado do Jestor (histórico, somente leitura)
    // template = semeado do checklist padrão | manual = criado pela equipe
    origem: text("origem").notNull().default("template"),
    // Structured data for form/service items: field values, linked serviceId, etc.
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    done: boolean("done").notNull().default(false),
    doneBy: text("done_by"),
    doneAt: timestamp("done_at"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("IDX_checklist_project").on(table.projectId)],
);

export const insertChecklistItemSchema = createInsertSchema(projectChecklistItemsTable).omit({
  id: true,
  createdAt: true,
  done: true,
  doneBy: true,
  doneAt: true,
});
export type InsertChecklistItem = z.infer<typeof insertChecklistItemSchema>;
export type ChecklistItem = typeof projectChecklistItemsTable.$inferSelect;
