-- Backfill do stepper do cliente após a migração 010: projetos remapeados para a
-- macro-etapa fundida devem refletir step 2 (projeto técnico) ou 3 (homologação),
-- com o percentual correspondente (curva 2→28%, 3→45%).

UPDATE projects
SET status_step = 3, completion_percent = 45
WHERE stage = 'projeto_tecnico_homologacao'
  AND sub_stage LIKE 'homologacao%'
  AND (status_step IS DISTINCT FROM 3 OR completion_percent IS DISTINCT FROM 45);

UPDATE projects
SET status_step = 2, completion_percent = 28
WHERE stage = 'projeto_tecnico_homologacao'
  AND (sub_stage IS NULL OR sub_stage NOT LIKE 'homologacao%')
  AND (status_step IS DISTINCT FROM 2 OR completion_percent IS DISTINCT FROM 28);
