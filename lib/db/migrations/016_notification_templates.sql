-- Biblioteca de templates editável pelo ERP.
--
-- O catálogo em código (whatsapp-templates.ts) vira só a carga de fábrica: o
-- servidor semeia esta tabela na primeira leitura, se ela estiver vazia. Daí em
-- diante quem manda é o banco — o time de CX ajusta texto sem deploy.

CREATE TABLE IF NOT EXISTS notification_templates (
  id           serial PRIMARY KEY,
  code         text    NOT NULL,
  categoria    text    NOT NULL,
  nome         text    NOT NULL,
  quando_usar  text    NOT NULL DEFAULT '',
  publico      text    NOT NULL DEFAULT 'cliente',
  vars         jsonb   NOT NULL DEFAULT '[]'::jsonb,
  body         text    NOT NULL,
  ativo        boolean NOT NULL DEFAULT true,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamp NOT NULL DEFAULT now(),
  updated_at   timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_notification_templates_code"
  ON notification_templates (code);
