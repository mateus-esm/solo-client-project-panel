-- Macro-etapas + sub-etapas: "projeto_tecnico"/"homologacao" merge into the
-- "projeto_homologacao" macro stage; "compras"/"logistica" stop being stages
-- (supplies become a parallel track derived from project_purchases).
-- statusStep is intentionally untouched: the client stepper (1-7) keeps its meaning.
--
-- Legacy "compras"/"logistica" projects are remapped RESPECTING the new gates,
-- so no project lands in a state the current policy would forbid:
--   * planejamento_execucao requires (a) a done homologation approval/validation
--     checklist item AND (b) supplies resolved (>= 1 purchase past "cotacao" and
--     none stuck in "comprada" without logistics programmed/received);
--   * legacy projects that do not satisfy both gates go back to
--     projeto_homologacao (sub-etapa "Aprovação e Registro" when approval is the
--     missing gate, "Validação de Homologação" when only supplies are pending —
--     an auditable holding state until the supply track resolves, mirroring how
--     the UI now blocks the same transition with a 409).

ALTER TABLE projects ADD COLUMN IF NOT EXISTS sub_stage text;

-- Old stages -> macro + sub-etapa
UPDATE projects SET stage = 'projeto_homologacao', sub_stage = 'projeto_tecnico_elaboracao'
  WHERE stage = 'projeto_tecnico';
UPDATE projects SET stage = 'projeto_homologacao', sub_stage = 'homologacao_envio_a_concessionaria'
  WHERE stage = 'homologacao';

-- Legacy compras/logistica: gate-aware remap (see header comment).
WITH gates AS (
  SELECT p.id,
    EXISTS (
      SELECT 1 FROM project_checklist_items c
      WHERE c.project_id = p.id AND c.done = true
        AND c.checklist_slug IN ('homologacao_aprovacao_e_registro', 'homologacao_validacao_de_homologacao')
    ) AS homolog_ok,
    (
      EXISTS (SELECT 1 FROM project_purchases pu WHERE pu.project_id = p.id AND pu.status <> 'cotacao')
      AND NOT EXISTS (SELECT 1 FROM project_purchases pu WHERE pu.project_id = p.id AND pu.status = 'comprada')
    ) AS supplies_ok,
    p.stage AS old_stage
  FROM projects p
  WHERE p.stage IN ('compras', 'logistica')
)
UPDATE projects p SET
  stage = CASE WHEN g.homolog_ok AND g.supplies_ok THEN 'planejamento_execucao' ELSE 'projeto_homologacao' END,
  sub_stage = CASE
    WHEN g.homolog_ok AND g.supplies_ok THEN
      CASE WHEN g.old_stage = 'logistica'
        THEN 'planejamento_de_execucao_logistica_de_materiais'
        ELSE 'planejamento_de_execucao_recebimento_de_material' END
    WHEN g.homolog_ok THEN 'homologacao_validacao_de_homologacao'
    ELSE 'homologacao_aprovacao_e_registro'
  END
FROM gates g WHERE p.id = g.id;

-- Default sub-etapa (first checklist group) for the remaining macro stages
UPDATE projects SET sub_stage = 'onboarding_documentacao_do_cliente' WHERE stage = 'onboarding' AND sub_stage IS NULL;
UPDATE projects SET sub_stage = 'planejamento_de_execucao_recebimento_de_material' WHERE stage = 'planejamento_execucao' AND sub_stage IS NULL;
UPDATE projects SET sub_stage = 'execucao_preparacao_para_obra' WHERE stage = 'execucao' AND sub_stage IS NULL;
UPDATE projects SET sub_stage = 'ativacao_autorizacao_para_ativacao' WHERE stage = 'ativacao' AND sub_stage IS NULL;
UPDATE projects SET sub_stage = 'comissionamento_treinamento_do_cliente' WHERE stage = 'comissionamento_treinamento' AND sub_stage IS NULL;
UPDATE projects SET sub_stage = 'concluido_confirmacao_tecnica_de_entrega' WHERE stage = 'concluido' AND sub_stage IS NULL;
UPDATE projects SET sub_stage = 'pausado_gestao_da_pausa' WHERE stage = 'pausado' AND sub_stage IS NULL;

-- Checklist items follow the merge (compras/logistica rows are kept as history)
UPDATE project_checklist_items SET stage = 'projeto_homologacao'
  WHERE stage IN ('projeto_tecnico', 'homologacao');
