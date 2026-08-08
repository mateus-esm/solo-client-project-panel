-- Merge-resolution compatibility: two parallel implementations of the macro-etapa
-- restructure used different ids for the merged "Projeto Técnico e Homologação"
-- stage ('projeto_tecnico_homologacao' on main vs 'projeto_homologacao' in the
-- task branch, which is the canonical id after the merge). Rename any rows
-- produced by the main-side migrations (010_macro_etapas_sub_etapas.sql /
-- 011_backfill_client_step_macro_etapas.sql) to the canonical id. Idempotent.

UPDATE projects SET stage = 'projeto_homologacao'
  WHERE stage = 'projeto_tecnico_homologacao';

UPDATE project_checklist_items SET stage = 'projeto_homologacao'
  WHERE stage = 'projeto_tecnico_homologacao';

-- Rows the main-side migration moved to the 'suprimentos' checklist track are
-- retired history in the canonical model (procurement module supersedes them);
-- they are intentionally left untouched.
