-- Sprint 1 — identidade do cliente, ficha da usina e estoque.
-- Aditiva: cria tabelas novas e uma coluna em projects. Nada existente é alterado.

CREATE TABLE IF NOT EXISTS clients (
  id               serial PRIMARY KEY,
  name             text NOT NULL,
  -- Só dígitos, sem DDI. Chave de identidade do cliente enquanto CPF/CNPJ não existe.
  phone_normalized text,
  phone            text,
  email            text,
  cpf_cnpj         text,
  address          text,
  city             text,
  state            text,
  origem           text NOT NULL DEFAULT 'manual',
  canal_captacao   text,
  soloapp_id       text,
  observacoes      text,
  created_at       timestamp NOT NULL DEFAULT now(),
  updated_at       timestamp NOT NULL DEFAULT now()
);

-- Único quando existe: negócio novo com telefone já cadastrado vincula ao
-- cliente existente em vez de duplicar.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_clients_phone" ON clients (phone_normalized);
CREATE INDEX IF NOT EXISTS "IDX_clients_name" ON clients (name);

-- Uma usina por projeto entregue. Alimenta Plant + Inverter no SoloApp.
CREATE TABLE IF NOT EXISTS plants (
  id                     serial PRIMARY KEY,
  project_id             integer,
  client_id              integer,
  name                   text,
  tipo_usina             text,
  status                 text,
  concessionaria         text,
  endereco_instalacao    text,
  city                   text,
  state                  text,
  potencia_instalada_kwp real,
  area_construida_m2     real,
  geracao_estimada_kwh   real,
  receita_estimada       real,
  consumo_medio_mensal   real,
  data_inicio            text,
  data_ativacao          text,
  modulo_fabricante      text,
  modulo_potencia_w      real,
  modulo_quantidade      integer,
  inversor_fabricante    text,
  inversor_potencia_kw   real,
  inversor_quantidade    integer,
  tipo_estrutura         text,
  tipo_monitoramento     text,
  monitoramento_url      text,
  drive_url              text,
  observacoes            text,
  created_at             timestamp NOT NULL DEFAULT now(),
  updated_at             timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_plants_project" ON plants (project_id);
CREATE INDEX IF NOT EXISTS "IDX_plants_client" ON plants (client_id);

-- Estoque. Consumo pela lista de materiais do serviço fica para a Sprint 3.
CREATE TABLE IF NOT EXISTS stock_items (
  id             serial PRIMARY KEY,
  sku            text,
  name           text NOT NULL,
  categoria      text NOT NULL DEFAULT 'outro',
  unidade        text NOT NULL DEFAULT 'un',
  quantidade     real NOT NULL DEFAULT 0,
  custo_unitario real,
  estoque_minimo real,
  supplier_id    integer,
  localizacao    text,
  observacoes    text,
  created_at     timestamp NOT NULL DEFAULT now(),
  updated_at     timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_stock_categoria" ON stock_items (categoria);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id integer;
