-- New pipeline stage "logistica" (split out of "compras" as a parallel sub-stage
-- of the Compras + Logística group). projects.stage is a plain text column, so no
-- DDL is needed — only re-home the existing logistics checklist items.
UPDATE project_checklist_items
SET stage = 'logistica'
WHERE checklist_slug = 'compras_logistica'
  AND stage = 'compras';
