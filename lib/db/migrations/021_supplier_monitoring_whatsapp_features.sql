-- Supplier platform access, per-plant monitoring credentials/status,
-- WhatsMiau template attachments/actions and send history metadata.

ALTER TABLE suppliers
  ADD COLUMN IF NOT EXISTS platform_url TEXT,
  ADD COLUMN IF NOT EXISTS platform_login TEXT,
  ADD COLUMN IF NOT EXISTS platform_password TEXT;

ALTER TABLE plants
  ADD COLUMN IF NOT EXISTS monitoramento_login_solo TEXT,
  ADD COLUMN IF NOT EXISTS monitoramento_senha_solo TEXT,
  ADD COLUMN IF NOT EXISTS monitoramento_login_cliente TEXT,
  ADD COLUMN IF NOT EXISTS monitoramento_senha_cliente TEXT,
  ADD COLUMN IF NOT EXISTS monitoramento_integrado_solo BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS planta_criada_no_monitoramento BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS planta_criada_no_solo_app BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE notification_templates
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS actions JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE whatsapp_sends
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS actions JSONB NOT NULL DEFAULT '[]'::jsonb;