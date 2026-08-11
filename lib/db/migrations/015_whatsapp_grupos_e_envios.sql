-- Notificação por WhatsApp direto do ERP (whatsmiau).
--
-- whatsapp_groups: o JID (…@g.us) devolvido na criação é a identidade permanente
-- do grupo. Um grupo por projeto e público (cliente / instalação / homologação).
--
-- whatsapp_sends: log do que foi disparado, com o texto já editado pelo operador.

CREATE TABLE IF NOT EXISTS whatsapp_groups (
  id            serial PRIMARY KEY,
  project_id    integer NOT NULL,
  kind          text    NOT NULL,
  jid           text    NOT NULL,
  subject       text    NOT NULL,
  subject_full  text,
  invite_url    text,
  participants  jsonb   NOT NULL DEFAULT '[]'::jsonb,
  created_at    timestamp NOT NULL DEFAULT now(),
  updated_at    timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_whatsapp_groups_project_kind"
  ON whatsapp_groups (project_id, kind);
CREATE INDEX IF NOT EXISTS "IDX_whatsapp_groups_jid"
  ON whatsapp_groups (jid);

CREATE TABLE IF NOT EXISTS whatsapp_sends (
  id             serial PRIMARY KEY,
  project_id     integer,
  template_code  text,
  target_type    text NOT NULL,
  target_kind    text NOT NULL,
  target_jid     text NOT NULL,
  target_label   text,
  body           text NOT NULL,
  status         text NOT NULL DEFAULT 'enviado',
  error          text,
  sent_by        text,
  created_at     timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_whatsapp_sends_project"
  ON whatsapp_sends (project_id, created_at);

-- Técnico de homologação precisa de telefone para entrar no grupo do processo.
ALTER TABLE homologacao_technicians
  ADD COLUMN IF NOT EXISTS phone text;
