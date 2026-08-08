-- Ficha do processo Enel por projeto (portal do técnico de homologação)
CREATE TABLE IF NOT EXISTS homologacao_processos (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL UNIQUE,
  kanban_stage TEXT NOT NULL DEFAULT 'projeto_eletrico',
  uc_numero TEXT,
  numero_solicitacao TEXT,
  links_enel TEXT,
  email_acompanhamento TEXT,
  datas_previstas JSONB DEFAULT '{}'::jsonb,
  art_paga BOOLEAN NOT NULL DEFAULT false,
  art_nf_url TEXT,
  art_nf_object_path TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
