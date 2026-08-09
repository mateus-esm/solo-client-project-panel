import { pgTable, serial, text, real, timestamp, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Cliente é a identidade durável: um cliente tem N projetos e serviços.
// Chave de identidade hoje: telefone normalizado. CPF/CNPJ entra depois (formulário
// do cliente / contrato) e passa a ser a chave definitiva — é o que casa com o SoloApp,
// onde Client.cpfCnpj é único.
export const clientsTable = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    // Só dígitos, sem DDI: "(85) 9 8888-7777", "85988887777" e "+5585988887777"
    // viram o mesmo valor, para o mesmo cliente não entrar duas vezes.
    phoneNormalized: text("phone_normalized"),
    phone: text("phone"),
    email: text("email"),
    cpfCnpj: text("cpf_cnpj"),
    address: text("address"),
    city: text("city"),
    state: text("state"),
    // jestor | proposta | lead | manual | sales_engine
    origem: text("origem").notNull().default("manual"),
    canalCaptacao: text("canal_captacao"),
    soloappId: text("soloapp_id"),
    observacoes: text("observacoes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    // Único quando existe: negócio novo com telefone já cadastrado vincula ao
    // cliente existente em vez de duplicar.
    uniqueIndex("UQ_clients_phone").on(table.phoneNormalized),
    index("IDX_clients_name").on(table.name),
  ],
);

export const insertClientSchema = createInsertSchema(clientsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clientsTable.$inferSelect;

// Usina: uma por projeto entregue. É o registro que depois alimenta
// Plant + Inverter no SoloApp (ver planning/arquitetura-integracao.md).
export const plantsTable = pgTable(
  "plants",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id"),
    clientId: integer("client_id"),
    name: text("name"),
    tipoUsina: text("tipo_usina"),
    status: text("status"),
    concessionaria: text("concessionaria"),
    enderecoInstalacao: text("endereco_instalacao"),
    city: text("city"),
    state: text("state"),
    potenciaInstaladaKwp: real("potencia_instalada_kwp"),
    areaConstruidaM2: real("area_construida_m2"),
    geracaoEstimadaKwh: real("geracao_estimada_kwh"),
    receitaEstimada: real("receita_estimada"),
    consumoMedioMensal: real("consumo_medio_mensal"),
    dataInicio: text("data_inicio"),
    dataAtivacao: text("data_ativacao"),
    // Ficha de equipamentos (origem: planilha de propostas)
    moduloFabricante: text("modulo_fabricante"),
    moduloPotenciaW: real("modulo_potencia_w"),
    moduloQuantidade: integer("modulo_quantidade"),
    inversorFabricante: text("inversor_fabricante"),
    inversorPotenciaKw: real("inversor_potencia_kw"),
    inversorQuantidade: integer("inversor_quantidade"),
    tipoEstrutura: text("tipo_estrutura"),
    // Monitoramento — o que é entregue ao cliente no fim do projeto.
    tipoMonitoramento: text("tipo_monitoramento"),
    monitoramentoUrl: text("monitoramento_url"),
    driveUrl: text("drive_url"),
    observacoes: text("observacoes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("UQ_plants_project").on(table.projectId),
    index("IDX_plants_client").on(table.clientId),
  ],
);

export const insertPlantSchema = createInsertSchema(plantsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlant = z.infer<typeof insertPlantSchema>;
export type Plant = typeof plantsTable.$inferSelect;

// Estoque: itens em saldo. O consumo pela lista de materiais do serviço entra na Sprint 3.
export const stockItemsTable = pgTable(
  "stock_items",
  {
    id: serial("id").primaryKey(),
    sku: text("sku"),
    name: text("name").notNull(),
    // modulo | inversor | estrutura | cabo | protecao | ferramenta | outro
    categoria: text("categoria").notNull().default("outro"),
    unidade: text("unidade").notNull().default("un"),
    quantidade: real("quantidade").notNull().default(0),
    custoUnitario: real("custo_unitario"),
    estoqueMinimo: real("estoque_minimo"),
    supplierId: integer("supplier_id"),
    localizacao: text("localizacao"),
    observacoes: text("observacoes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("IDX_stock_categoria").on(table.categoria)],
);

export const insertStockItemSchema = createInsertSchema(stockItemsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertStockItem = z.infer<typeof insertStockItemSchema>;
export type StockItem = typeof stockItemsTable.$inferSelect;
