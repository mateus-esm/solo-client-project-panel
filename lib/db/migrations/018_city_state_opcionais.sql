-- Torna city/state opcionais em projects: o webhook de vendas (deal-won)
-- recebe o endereço como texto livre e nem sempre tem cidade/UF separadas.
ALTER TABLE projects ALTER COLUMN city DROP NOT NULL;
ALTER TABLE projects ALTER COLUMN state DROP NOT NULL;
