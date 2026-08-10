-- Sprint 2, Onda 1 — separar histórico do Jestor do checklist padrão.
-- Os itens importados têm rótulo livre do Jestor (378 rótulos distintos em 3.3k itens)
-- e não representam o processo. Marcá-los permite escondê-los sem apagar o histórico.

ALTER TABLE project_checklist_items
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'template';

-- Tudo que existe hoje veio do import do Jestor.
UPDATE project_checklist_items SET origem = 'jestor' WHERE origem = 'template';

CREATE INDEX IF NOT EXISTS "IDX_checklist_origem" ON project_checklist_items (origem);
