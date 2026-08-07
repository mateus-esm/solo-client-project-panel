-- Backfill: map old 7-phase status_step vocabulary → new 11-stage pipeline
-- Applied: 2026-08-07
-- Description: Sets the `stage` column on every existing project based on status_step.
--              Projects with unknown/null status_step stay in 'onboarding' (the default).
--
-- Mapping (from Jestor 7-phase vocab → internal 11-stage pipeline):
--   step 1 → onboarding              (exact semantic match)
--   step 2 → projeto_tecnico         (Engenharia / Projeto Técnico)
--   step 3 → homologacao             (exact match)
--   step 4 → compras                 (Logística → earliest step-4 sub-phase)
--   step 5 → execucao                (exact match)
--   step 6 → ativacao                (post-execution activation)
--   step 7 → comissionamento_treinamento (commissioning and handover)
--   else   → onboarding              (safe default for new/unknown statuses)
--
-- Execution: managed by lib/db/migrate.mjs, which runs this file exactly once
--            (tracked in the schema_migrations table). Do NOT run manually against
--            production after the runner has already applied it — admin-set stages
--            would be overwritten.

UPDATE projects
SET stage = CASE
  WHEN status_step = 1 THEN 'onboarding'
  WHEN status_step = 2 THEN 'projeto_tecnico'
  WHEN status_step = 3 THEN 'homologacao'
  WHEN status_step = 4 THEN 'compras'
  WHEN status_step = 5 THEN 'execucao'
  WHEN status_step = 6 THEN 'ativacao'
  WHEN status_step = 7 THEN 'comissionamento_treinamento'
  ELSE 'onboarding'
END
WHERE stage = 'onboarding';

-- Verify: each row's stage should match the mapping above.
-- Run manually to inspect:
--   SELECT id, client_name, status_step, stage FROM projects ORDER BY status_step;
