-- Migration: homologacao team auth tables
-- Applied: 2026-08-07
-- Description: Adds dedicated login and session tables for the homologação technical team,
--              giving them scoped portal access without touching the shared admin session.
--
-- New tables: homologacao_technicians, homologacao_sessions
--
-- Idempotent: safe to re-run (all statements use IF NOT EXISTS).

-- ── homologacao_technicians ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS homologacao_technicians (
  id            serial      PRIMARY KEY,
  name          text        NOT NULL,
  email         text        NOT NULL,
  password_hash text        NOT NULL,
  created_at    timestamp   NOT NULL DEFAULT now(),
  CONSTRAINT homologacao_technicians_email_unique UNIQUE (email)
);

-- ── homologacao_sessions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS homologacao_sessions (
  id             serial      PRIMARY KEY,
  technician_id  integer     NOT NULL
                               REFERENCES homologacao_technicians (id)
                               ON DELETE CASCADE,
  token_hash     text        NOT NULL,
  expires_at     timestamp   NOT NULL,
  created_at     timestamp   NOT NULL DEFAULT now(),
  CONSTRAINT homologacao_sessions_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS IDX_homologacao_sessions_technician
  ON homologacao_sessions (technician_id);
