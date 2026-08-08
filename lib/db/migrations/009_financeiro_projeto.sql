-- Financeiro do projeto: custo de serviço (instalação) e plano de pagamento do cliente
ALTER TABLE projects ADD COLUMN IF NOT EXISTS custo_servico REAL;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS payment_plan_type TEXT;
