import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Tabela de controle do runner `lib/db/migrate.mjs`.
 *
 * Ela é criada pelo próprio runner, mas PRECISA estar declarada aqui: o deploy do
 * Replit compara o schema Drizzle com o banco de produção e **derruba toda tabela
 * que não estiver declarada**. Sem esta declaração, `schema_migrations` era apagada
 * a cada publish, o runner perdia o histórico e reaplicava as 16 migrações do zero.
 */
export const schemaMigrationsTable = pgTable("schema_migrations", {
  filename: text("filename").primaryKey(),
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
});

export type SchemaMigration = typeof schemaMigrationsTable.$inferSelect;
