-- Fornecedores + compras por projeto (capex / custo de materiais)
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  tipo TEXT NOT NULL,
  contato_nome TEXT,
  telefone TEXT,
  email TEXT,
  observacoes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_purchases (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL,
  supplier_id INTEGER NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'cotacao',
  valor_cotacao REAL,
  valor REAL,
  data_compra TEXT,
  numero_nfe TEXT,
  forma_pagamento TEXT,
  transportadora TEXT,
  codigo_rastreio TEXT,
  previsao_entrega TEXT,
  data_recebimento TEXT,
  recebido_por TEXT,
  observacoes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_purchases_project" ON project_purchases (project_id);

-- Custo agregado de materiais avulsos (capex já existe)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS custo_materiais REAL;
