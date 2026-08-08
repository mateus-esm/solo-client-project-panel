import { pgTable, serial, integer, text, real, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ─── Fornecedores ─────────────────────────────────────────────────────────────
// "equipamentos" = compras de capex (kits, inversores, painéis)
// "materiais"    = materiais avulsos (cabeamento, estrutura, misc) → custo de materiais

export const SUPPLIER_TIPOS = ["equipamentos", "materiais"] as const;
export type SupplierTipo = (typeof SUPPLIER_TIPOS)[number];

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  tipo: text("tipo").notNull(), // SupplierTipo
  contatoNome: text("contato_nome"),
  telefone: text("telefone"),
  email: text("email"),
  observacoes: text("observacoes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSupplierSchema = createInsertSchema(suppliersTable)
  .omit({ id: true, createdAt: true })
  .extend({ tipo: z.enum(SUPPLIER_TIPOS) });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;

// ─── Compras por projeto ──────────────────────────────────────────────────────
// Fluxo: cotacao → comprada → logistica_programada → recebida
// Valores de compras "equipamentos" alimentam projects.capex;
// compras "materiais" alimentam projects.custo_materiais.

export const PURCHASE_STATUS = [
  "cotacao",
  "comprada",
  "logistica_programada",
  "recebida",
] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUS)[number];

export const projectPurchasesTable = pgTable(
  "project_purchases",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id").notNull(),
    supplierId: integer("supplier_id").notNull(),
    categoria: text("categoria").notNull(), // SupplierTipo (copiada do fornecedor na criação)
    descricao: text("descricao").notNull(),
    status: text("status").notNull().default("cotacao"), // PurchaseStatus
    valorCotacao: real("valor_cotacao"),
    valor: real("valor"), // valor efetivo da compra
    dataCompra: text("data_compra"),
    numeroNfe: text("numero_nfe"),
    formaPagamento: text("forma_pagamento"),
    transportadora: text("transportadora"),
    codigoRastreio: text("codigo_rastreio"),
    previsaoEntrega: text("previsao_entrega"),
    dataRecebimento: text("data_recebimento"),
    recebidoPor: text("recebido_por"),
    observacoes: text("observacoes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("IDX_purchases_project").on(table.projectId)],
);

export const insertPurchaseSchema = createInsertSchema(projectPurchasesTable)
  .omit({ id: true, createdAt: true, projectId: true, categoria: true })
  .extend({ status: z.enum(PURCHASE_STATUS).optional() });
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof projectPurchasesTable.$inferSelect;
