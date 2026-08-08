-- Macro-etapas + sub-etapas: funde Projeto Técnico/Homologação numa macro-etapa,
-- transforma Compras/Logística em trilha paralela (suprimentos) e adiciona sub_stage.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS sub_stage TEXT;

-- Projetos: remapeia stages antigos para macro-etapa + sub-etapa equivalentes.
UPDATE projects SET stage = 'projeto_tecnico_homologacao', sub_stage = 'projeto_tecnico_elaboracao'
  WHERE stage = 'projeto_tecnico';
UPDATE projects SET stage = 'projeto_tecnico_homologacao', sub_stage = 'homologacao_envio_a_concessionaria'
  WHERE stage = 'homologacao';
-- Compras/Logística deixam de ser etapas: o projeto volta a residir na macro-etapa
-- de Projeto Técnico e Homologação (sub-etapa final) e a trilha de suprimentos
-- (project_purchases) mostra o andamento das compras em paralelo.
UPDATE projects SET stage = 'projeto_tecnico_homologacao', sub_stage = 'homologacao_validacao_de_homologacao'
  WHERE stage IN ('compras', 'logistica');

-- Checklists: itens das etapas fundidas passam a viver sob a macro-etapa; os de
-- compras/logística passam para a trilha "suprimentos".
UPDATE project_checklist_items SET stage = 'projeto_tecnico_homologacao'
  WHERE stage IN ('projeto_tecnico', 'homologacao');
UPDATE project_checklist_items SET stage = 'suprimentos'
  WHERE stage IN ('compras', 'logistica');
