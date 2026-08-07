// Pipeline stage constants shared by API and (mirrored in) the frontend.
// Stage values are locked in docs/superpowers/specs/2026-08-07-solo-erp-consolidation-design.md

export const PIPELINE_STAGES = [
  "onboarding",
  "projeto_tecnico",
  "homologacao",
  "compras",
  "planejamento_execucao",
  "execucao",
  "ativacao",
  "comissionamento_treinamento",
  "concluido",
  "pendencias",
  "pausado",
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  onboarding: "Onboarding",
  projeto_tecnico: "Projeto Técnico",
  homologacao: "Homologação",
  compras: "Compras",
  planejamento_execucao: "Planejamento de Execução",
  execucao: "Execução",
  ativacao: "Ativação",
  comissionamento_treinamento: "Comissionamento e Treinamento",
  concluido: "Concluído",
  pendencias: "Pendências",
  pausado: "Pausado",
};

// Maps internal stage -> client portal stepper (1-7). null = keep the current step
// (pendências/pausado must not move the client-facing stepper).
export const STAGE_TO_CLIENT_STEP: Record<PipelineStage, number | null> = {
  onboarding: 1,
  projeto_tecnico: 2,
  homologacao: 3,
  compras: 4,
  planejamento_execucao: 4,
  execucao: 5,
  ativacao: 6,
  comissionamento_treinamento: 7,
  concluido: 7,
  pendencias: null,
  pausado: null,
};

export interface ChecklistTemplateGroup {
  slug: string;
  title: string;
}

// Checklist groups per stage, migrated 1:1 from the Jestor todoList fields.
// Items inside each group are created per-project by the team (no per-project seeding).
export const CHECKLIST_TEMPLATE: Record<PipelineStage, ChecklistTemplateGroup[]> = {
  onboarding: [],
  projeto_tecnico: [],
  compras: [],
  comissionamento_treinamento: [],
  pendencias: [],
  homologacao: [
    { slug: "homologacao_envio_a_concessionaria", title: "Envio à Concessionária" },
    { slug: "homologacao_acompanhamento_e_retornos", title: "Acompanhamento e Retornos" },
    { slug: "homologacao_aprovacao_e_registro", title: "Aprovação e Registro" },
    { slug: "homologacao_validacao_de_homologacao", title: "Validação de Homologação" },
  ],
  planejamento_execucao: [
    { slug: "planejamento_de_execucao_logistica_de_materiais", title: "Logística de Materiais" },
    { slug: "planejamento_de_execucao_designacao_de_equipe", title: "Designação de Equipe" },
    { slug: "planejamento_de_execucao_agendamento_com_cliente", title: "Agendamento com Cliente" },
    { slug: "planejamento_de_execucao_mapeamento_de_riscos", title: "Mapeamento de Riscos" },
    { slug: "planejamento_de_execucao_validacao_de_planejament", title: "Validação de Planejamento" },
  ],
  execucao: [
    { slug: "execucao_preparacao_para_obra", title: "Preparação para Obra" },
    { slug: "execucao_instalacao_dos_equipamentos", title: "Instalação dos Equipamentos" },
    { slug: "execucao_conexao_eletrica_e_comissionamento", title: "Conexão Elétrica e Comissionamento" },
    { slug: "execucao_registros_e_documentacao", title: "Registros e Documentação" },
    { slug: "execucao_vistoria_de_obra", title: "Vistoria de Obra" },
    { slug: "execucao_validacao_de_execucao", title: "Validação de Execução" },
  ],
  ativacao: [
    { slug: "ativacao_autorizacao_para_ativacao", title: "Autorização para Ativação" },
    { slug: "ativacao_ativacao_fisica_e_testes", title: "Ativação Física e Testes" },
    { slug: "ativacao_configuracao_do_monitoramento", title: "Configuração do Monitoramento" },
    { slug: "ativacao_entrega_tecnica", title: "Entrega Técnica" },
    { slug: "ativacao_validacao_de_ativacao", title: "Validação de Ativação" },
  ],
  concluido: [
    { slug: "concluido_confirmacao_tecnica_de_entrega", title: "Confirmação Técnica de Entrega" },
    { slug: "concluido_documentacao_do_projeto", title: "Documentação do Projeto" },
    { slug: "ativacao_passagem_de_bastao_para_suporte", title: "Passagem de Bastão para Suporte" },
    { slug: "concluido_fechamento_do_projeto", title: "Fechamento do Projeto" },
  ],
  pausado: [{ slug: "pausado_gestao_da_pausa", title: "Gestão da Pausa" }],
};

export const SERVICE_TIPOS = [
  "Instalação",
  "Manutenção",
  "Visita Técnica",
  "Projeto Elétrico",
  "Homologação",
  "Outro",
] as const;

export const SERVICE_STATUS = ["Agendado", "Em Execução", "Concluído", "Cancelado"] as const;

export const SERVICE_STATUS_PAGAMENTO = [
  "Pendente",
  "Aguardando Aprovação",
  "Aprovado",
  "Pago",
] as const;
