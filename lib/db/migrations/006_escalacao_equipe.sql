-- Escalação de equipe proposta pelo instalador, com aprovação do admin.
ALTER TABLE services ADD COLUMN IF NOT EXISTS escalacao_status text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS escalacao_enviada_por text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS escalacao_enviada_em timestamp;
ALTER TABLE services ADD COLUMN IF NOT EXISTS escalacao_decidida_por text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS escalacao_decidida_em timestamp;
