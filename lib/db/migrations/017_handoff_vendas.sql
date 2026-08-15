-- Handoff Vendas → Operação: o negócio ganho no pipeline comercial vira projeto.
--
-- sales_deal_id é a chave de idempotência: o webhook do Jestor faz retry, e o
-- mesmo card não pode virar dois projetos. Único quando existe (os 37 projetos
-- importados ficam com NULL e não colidem entre si).
--
-- sales_payload guarda o corpo cru recebido. Serve para auditar de onde veio
-- cada campo e para reprocessar sem pedir reenvio ao comercial.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS sales_deal_id          text,
  ADD COLUMN IF NOT EXISTS sales_payload          jsonb,
  ADD COLUMN IF NOT EXISTS consultor_nome         text,
  ADD COLUMN IF NOT EXISTS consultor_email        text,
  ADD COLUMN IF NOT EXISTS consultor_telefone     text,
  ADD COLUMN IF NOT EXISTS link_proposta          text,
  ADD COLUMN IF NOT EXISTS link_contrato          text,
  ADD COLUMN IF NOT EXISTS comissao_esperada      real,
  ADD COLUMN IF NOT EXISTS comissao_fixa          real,
  -- Indicação: quem indicou este negócio. Fica no projeto (e não no cliente)
  -- porque a indicação premia o negócio fechado, não a pessoa indicada.
  ADD COLUMN IF NOT EXISTS indicado_por           text,
  ADD COLUMN IF NOT EXISTS indicado_por_telefone  text;

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_projects_sales_deal"
  ON projects (sales_deal_id);

-- Agrupar indicações por telefone normalizado é a consulta da tela de indicações.
CREATE INDEX IF NOT EXISTS "IDX_projects_indicado_por"
  ON projects (indicado_por_telefone);
