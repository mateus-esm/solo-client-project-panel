-- Migration: internal pipeline schema
-- Applied: 2026-08-07
-- Description: Adds the internal ERP pipeline tables and three new columns on projects.
--              This migration is purely additive — no existing table or column is modified.
--
-- New tables: admin_sessions, services, service_files, project_checklist_items,
--             conversations, messages
-- New columns on projects: stage (text NOT NULL DEFAULT 'onboarding'),
--                          capex (real), receita_bruta (real)
--
-- Run with:  psql $DATABASE_URL -f lib/db/migrations/001_internal_pipeline.sql
-- Idempotent: safe to re-run (all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- ── New columns on projects ────────────────────────────────────────────────────
ALTER TABLE projects ADD COLUMN IF NOT EXISTS stage          text    NOT NULL DEFAULT 'onboarding';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS capex          real;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS receita_bruta  real;

-- ── admin_sessions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_sessions (
  id          serial PRIMARY KEY,
  token_hash  text   NOT NULL UNIQUE,
  expires_at  timestamp NOT NULL,
  created_at  timestamp NOT NULL DEFAULT now()
);

-- ── services ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  id                   serial PRIMARY KEY,
  project_id           integer,
  name                 text    NOT NULL,
  tipo_servico         text,
  valor_servico        real,
  status               text    NOT NULL DEFAULT 'Agendado',
  status_pagamento     text    NOT NULL DEFAULT 'Pendente',
  pagamento_realizado  boolean NOT NULL DEFAULT false,
  data_execucao        timestamp,
  data_inicio          timestamp,
  data_termino         timestamp,
  equipe_execucao      text,
  endereco             text,
  responsavel_email    text,
  observacoes          text,
  created_at           timestamp NOT NULL DEFAULT now(),
  updated_at           timestamp NOT NULL DEFAULT now()
);

-- ── service_files ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS service_files (
  id          serial PRIMARY KEY,
  service_id  integer NOT NULL,
  kind        text    NOT NULL DEFAULT 'imagens_documentacao',
  name        text,
  url         text    NOT NULL,
  created_at  timestamp NOT NULL DEFAULT now()
);

-- ── project_checklist_items ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_checklist_items (
  id              serial PRIMARY KEY,
  project_id      integer   NOT NULL,
  stage           text      NOT NULL,
  checklist_slug  text      NOT NULL,
  label           text      NOT NULL,
  done            boolean   NOT NULL DEFAULT false,
  done_by         text,
  done_at         timestamp,
  sort_order      integer   NOT NULL DEFAULT 0,
  created_at      timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_checklist_project" ON project_checklist_items (project_id);

-- ── conversations ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id          serial PRIMARY KEY,
  title       text      NOT NULL,
  created_at  timestamp with time zone NOT NULL DEFAULT now()
);

-- ── messages ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id               serial PRIMARY KEY,
  conversation_id  integer   NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role             text      NOT NULL,
  content          text      NOT NULL,
  created_at       timestamp with time zone NOT NULL DEFAULT now()
);
