-- 004: Team-as-company registration, team members, service financials/contracts,
--      homologation technician assignment + homologation payment info.

-- Projects: homologation assignment + payment
ALTER TABLE projects ADD COLUMN IF NOT EXISTS homologacao_technician_id integer;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS homologacao_valor real;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS homologacao_pago boolean NOT NULL DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS homologacao_forma_pagamento text;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS homologacao_pix text;

-- Installer accounts as companies
ALTER TABLE installer_accounts ADD COLUMN IF NOT EXISTS razao_social text;
ALTER TABLE installer_accounts ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE installer_accounts ADD COLUMN IF NOT EXISTS responsavel_nome text;
ALTER TABLE installer_accounts ADD COLUMN IF NOT EXISTS responsavel_telefone text;
ALTER TABLE installer_accounts ADD COLUMN IF NOT EXISTS pix_key text;
ALTER TABLE installer_accounts ADD COLUMN IF NOT EXISTS forma_pagamento text;

-- Team members (with photo + ID document)
CREATE TABLE IF NOT EXISTS installer_team_members (
  id serial PRIMARY KEY,
  account_id integer NOT NULL REFERENCES installer_accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  documento text,
  photo_url text,
  doc_url text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS installer_team_members_account_idx ON installer_team_members(account_id);

-- Which members go to each service
CREATE TABLE IF NOT EXISTS service_team_members (
  id serial PRIMARY KEY,
  service_id integer NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  member_id integer NOT NULL REFERENCES installer_team_members(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE(service_id, member_id)
);

-- Service financials + contract
ALTER TABLE services ADD COLUMN IF NOT EXISTS valor_proposto real;
ALTER TABLE services ADD COLUMN IF NOT EXISTS valor_fechado real;
ALTER TABLE services ADD COLUMN IF NOT EXISTS custo_logistica real;
ALTER TABLE services ADD COLUMN IF NOT EXISTS outros_custos real;
ALTER TABLE services ADD COLUMN IF NOT EXISTS forma_pagamento text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pix_conta text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS comprovante_url text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contrato_url text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contrato_status text NOT NULL DEFAULT 'pendente';
ALTER TABLE services ADD COLUMN IF NOT EXISTS contrato_aceito_em timestamp;
ALTER TABLE services ADD COLUMN IF NOT EXISTS contrato_aceito_por text;
