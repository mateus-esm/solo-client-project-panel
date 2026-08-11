// Pipeline stage constants shared by API and (mirrored in) the frontend.
// Stage values are locked in docs/superpowers/specs/2026-08-07-solo-erp-consolidation-design.md

// Macro-etapas do pipeline (colunas do kanban). Compras + Logística deixaram de
// ser etapas: viraram trilha paralela de suprimentos derivada de project_purchases.
export const PIPELINE_STAGES = [
  "onboarding",
  "projeto_homologacao",
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
  projeto_homologacao: "Projeto Técnico e Homologação",
  planejamento_execucao: "Pré-execução",
  execucao: "Execução",
  ativacao: "Ativação",
  comissionamento_treinamento: "Comissionamento e Treinamento",
  concluido: "Concluído",
  pendencias: "Pendências",
  pausado: "Pausado",
};

// Maps internal macro stage -> client portal stepper (1-7). null = keep the current
// step (pendências/pausado must not move the client-facing stepper).
// "projeto_homologacao" spans client steps 2-3: use clientStepFor(stage, subStage)
// so the homologação sub-etapas map to step 3 (same meaning as before the merge).
export const STAGE_TO_CLIENT_STEP: Record<PipelineStage, number | null> = {
  onboarding: 1,
  projeto_homologacao: 2,
  planejamento_execucao: 4,
  execucao: 5,
  ativacao: 6,
  comissionamento_treinamento: 7,
  concluido: 7,
  pendencias: null,
  pausado: null,
};

/** Client stepper (1-7) for a macro stage + sub-etapa. Homologação subs = step 3. */
export function clientStepFor(stage: PipelineStage, subStage?: string | null): number | null {
  if (stage === "projeto_homologacao" && subStage?.startsWith("homologacao_")) return 3;
  return STAGE_TO_CLIENT_STEP[stage];
}

/** Client-facing label for notifications — keeps the old Projeto Técnico / Homologação wording. */
export function clientStageLabel(stage: PipelineStage, subStage?: string | null): string {
  if (stage === "projeto_homologacao") {
    return subStage?.startsWith("homologacao_") ? "Homologação" : "Projeto Técnico";
  }
  return STAGE_LABELS[stage];
}

export interface ChecklistTemplateGroup {
  slug: string;
  title: string;
}

// Checklist groups per macro stage, migrated 1:1 from the Jestor todoList fields.
// These groups double as the sub-etapas of each macro stage (project.subStage holds
// the current group slug). Compras/logística groups were retired — supplies now live
// in the procurement module (project_purchases) as a parallel track.
export const CHECKLIST_TEMPLATE: Record<PipelineStage, ChecklistTemplateGroup[]> = {
  onboarding: [
    { slug: "onboarding_documentacao_do_cliente", title: "Documentação e Informações" },
    { slug: "onboarding_boas_vindas", title: "Boas-vindas e Portal" },
    { slug: "onboarding_financeiro", title: "Atualização Financeira" },
    { slug: "onboarding_revisao_tecnica", title: "Revisão Técnica" },
    { slug: "onboarding_lista_materiais", title: "Lista de Materiais" },
  ],
  projeto_homologacao: [
    { slug: "projeto_tecnico_elaboracao", title: "Elaboração do Projeto" },
    { slug: "projeto_tecnico_validacao", title: "Validação do Projeto" },
    { slug: "homologacao_envio_a_concessionaria", title: "Envio à Concessionária" },
    { slug: "homologacao_acompanhamento_e_retornos", title: "Acompanhamento e Retornos" },
    { slug: "homologacao_aprovacao_e_registro", title: "Aprovação e Registro" },
    { slug: "homologacao_validacao_de_homologacao", title: "Validação de Homologação" },
  ],
  comissionamento_treinamento: [
    { slug: "comissionamento_treinamento_do_cliente", title: "Treinamento do Cliente" },
  ],
  pendencias: [],
  planejamento_execucao: [
    { slug: "planejamento_de_execucao_recebimento_de_material", title: "Recebimento de Material" },
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

// ─── Sub-etapas ───────────────────────────────────────────────────────────────
// Sub-etapas are the checklist groups of the macro stage. project.subStage holds
// the current group slug (null when the macro has no groups, e.g. pendências).

export function subStagesFor(stage: PipelineStage): ChecklistTemplateGroup[] {
  return CHECKLIST_TEMPLATE[stage] ?? [];
}

export function isValidSubStage(stage: PipelineStage, slug: string): boolean {
  return subStagesFor(stage).some((g) => g.slug === slug);
}

export function defaultSubStage(stage: PipelineStage): string | null {
  return subStagesFor(stage)[0]?.slug ?? null;
}

// ─── Typed checklist items ────────────────────────────────────────────────────
// Each default item has a kind that drives behavior in the pipeline UI/API:
//   check         — simple checkbox
//   form          — structured fields saved to item.metadata (and synced to the
//                   project where mapped, e.g. tracking code)
//   service       — creates a service linked to the project + notifies the team
//   client_notify — records a scheduled date and notifies the client (portal + WhatsApp)

export type ChecklistItemKind = "check" | "form" | "service" | "client_notify";

export interface ChecklistFieldDef {
  key: string;
  label: string;
  type: "text" | "date" | "select" | "currency" | "phone";
  options?: readonly string[];
}

export interface ChecklistItemTemplate {
  label: string;
  kind: ChecklistItemKind;
  fields?: ChecklistFieldDef[];
}

// Default items seeded per checklist group (keyed by group slug).
export const CHECKLIST_ITEM_TEMPLATE: Record<string, ChecklistItemTemplate[]> = {
  onboarding_documentacao_do_cliente: [
    { label: "Preencher todas as informações do cliente", kind: "check" },
    { label: "Receber documentos do cliente (RG/CPF, conta de luz)", kind: "check" },
    { label: "Enviar formulário para preenchimento de dados", kind: "check" },
    { label: "Confirmar que está tudo preenchido", kind: "check" },
  ],
  onboarding_boas_vindas: [
    // "Criar grupo com o cliente" saiu daqui: virou item-ação (criar_grupo_whatsapp),
    // cumprido de verdade quando o grupo existe em whatsapp_groups.
    { label: "Enviar mensagem de boas-vindas", kind: "check" },
    { label: "Liberar acesso ao portal do cliente", kind: "check" },
  ],
  onboarding_financeiro: [
    { label: "Atualizar dados financeiros do projeto", kind: "check" },
  ],
  onboarding_revisao_tecnica: [
    { label: "Revisão técnica do projeto", kind: "check" },
  ],
  onboarding_lista_materiais: [
    {
      label: "Definir lista de materiais necessária",
      kind: "form",
      fields: [
        { key: "listaMateriais", label: "Lista de materiais", type: "text" },
        { key: "observacoes", label: "Observações", type: "text" },
      ],
    },
  ],
  projeto_tecnico_elaboracao: [
    { label: "Elaborar projeto elétrico", kind: "check" },
    {
      label: "Dados do projeto",
      kind: "form",
      fields: [
        { key: "responsavelTecnico", label: "Responsável técnico", type: "text" },
        { key: "dataPrevistaConclusao", label: "Data prevista de conclusão", type: "date" },
      ],
    },
  ],
  projeto_tecnico_validacao: [
    { label: "Revisão interna do projeto", kind: "check" },
    { label: "Aprovação final do projeto", kind: "check" },
  ],
  homologacao_envio_a_concessionaria: [
    { label: "Preparar documentação para a concessionária", kind: "check" },
    {
      label: "Protocolo de envio",
      kind: "form",
      fields: [
        { key: "numeroProtocolo", label: "Número do protocolo", type: "text" },
        { key: "dataEnvio", label: "Data de envio", type: "date" },
        { key: "concessionaria", label: "Concessionária", type: "text" },
      ],
    },
  ],
  homologacao_acompanhamento_e_retornos: [
    { label: "Acompanhar retornos da concessionária", kind: "check" },
  ],
  homologacao_aprovacao_e_registro: [
    {
      label: "Registro da aprovação",
      kind: "form",
      fields: [
        { key: "dataAprovacao", label: "Data da aprovação", type: "date" },
        { key: "numeroRegistro", label: "Número de registro", type: "text" },
      ],
    },
  ],
  homologacao_validacao_de_homologacao: [
    { label: "Validação final da homologação", kind: "check" },
  ],
  // compras_* group templates were retired with the supply track — purchases now
  // live in project_purchases (procurement module). Existing checklist rows with
  // those slugs are kept in the DB for history but no longer seeded/rendered.
  planejamento_de_execucao_recebimento_de_material: [
    {
      label: "Confirmar recebimento de material",
      kind: "form",
      fields: [
        { key: "dataRecebimento", label: "Data de recebimento", type: "date" },
        { key: "recebidoPor", label: "Recebido por", type: "text" },
      ],
    },
  ],
  planejamento_de_execucao_logistica_de_materiais: [
    {
      label: "Logística de materiais para obra",
      kind: "form",
      fields: [
        { key: "localArmazenamento", label: "Local de armazenamento", type: "text" },
        { key: "dataDisponibilidade", label: "Materiais disponíveis em", type: "date" },
      ],
    },
  ],
  planejamento_de_execucao_designacao_de_equipe: [
    { label: "Designar equipe e criar serviço", kind: "service" },
  ],
  planejamento_de_execucao_agendamento_com_cliente: [
    { label: "Agendar instalação com o cliente", kind: "client_notify" },
  ],
  planejamento_de_execucao_mapeamento_de_riscos: [
    { label: "Mapear riscos da instalação", kind: "check" },
  ],
  planejamento_de_execucao_validacao_de_planejament: [
    { label: "Validação final do planejamento", kind: "check" },
  ],
  execucao_preparacao_para_obra: [{ label: "Preparação para obra", kind: "check" }],
  execucao_instalacao_dos_equipamentos: [
    { label: "Instalação dos painéis e inversor", kind: "check" },
  ],
  execucao_conexao_eletrica_e_comissionamento: [
    { label: "Conexão elétrica e comissionamento", kind: "check" },
  ],
  execucao_registros_e_documentacao: [
    { label: "Fotos e registros da instalação", kind: "check" },
  ],
  execucao_vistoria_de_obra: [{ label: "Vistoria de obra", kind: "check" }],
  execucao_validacao_de_execucao: [{ label: "Validação final da execução", kind: "check" }],
  ativacao_autorizacao_para_ativacao: [
    { label: "Autorização da concessionária para ativação", kind: "check" },
  ],
  ativacao_ativacao_fisica_e_testes: [{ label: "Ativação física e testes", kind: "check" }],
  ativacao_configuracao_do_monitoramento: [
    { label: "Configurar monitoramento remoto", kind: "check" },
  ],
  ativacao_entrega_tecnica: [{ label: "Entrega técnica ao cliente", kind: "check" }],
  ativacao_validacao_de_ativacao: [{ label: "Validação final da ativação", kind: "check" }],
  comissionamento_treinamento_do_cliente: [
    { label: "Treinamento de monitoramento com o cliente", kind: "client_notify" },
  ],
  concluido_confirmacao_tecnica_de_entrega: [
    { label: "Confirmação técnica de entrega", kind: "check" },
  ],
  concluido_documentacao_do_projeto: [{ label: "Arquivar documentação do projeto", kind: "check" }],
  ativacao_passagem_de_bastao_para_suporte: [
    { label: "Passagem de bastão para o suporte", kind: "check" },
  ],
  concluido_fechamento_do_projeto: [{ label: "Fechamento do projeto", kind: "check" }],
  pausado_gestao_da_pausa: [
    {
      label: "Motivo e previsão de retomada",
      kind: "form",
      fields: [
        { key: "motivoPausa", label: "Motivo da pausa", type: "text" },
        { key: "previsaoRetomada", label: "Previsão de retomada", type: "date" },
      ],
    },
  ],
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

// ─── Itens-ação ───────────────────────────────────────────────────────────────
// Um item-ação não é caixinha: ele é cumprido quando a AÇÃO REAL acontece no
// sistema. "Atribuir técnico de homologação" fica cumprido quando o técnico é
// atribuído — ninguém marca nada.
//
// São 100% derivados: não existem como linha no banco. Vêm deste template e o
// cumprimento é calculado a partir do dado real a cada leitura. Isso torna
// impossível dois projetos terem checklists diferentes, e faz o item voltar a
// pendente sozinho se a ação for desfeita.

export const CHECKLIST_ACOES = [
  "atribuir_tecnico_homologacao",
  "protocolo_concessionaria",
  "anexar_documentos_cliente",
  "registrar_compra",
  "receber_material",
  "criar_servico_instalacao",
  "concluir_servico_instalacao",
  "agendar_com_cliente",
  "cadastrar_usina",
  "liberar_monitoramento",
  "registrar_pagamento",
  "criar_grupo_whatsapp",
] as const;

export type ChecklistAcao = (typeof CHECKLIST_ACOES)[number];

export interface ChecklistActionItem {
  label: string;
  acao: ChecklistAcao;
  /** Para onde o atalho leva. `aba` navega dentro da própria tela do projeto. */
  atalho: { tipo: "rota" | "aba"; destino: string };
}

/** Texto do botão de atalho, por ação. */
export const ACAO_CTA: Record<ChecklistAcao, string> = {
  atribuir_tecnico_homologacao: "Atribuir técnico",
  protocolo_concessionaria: "Registrar protocolo",
  anexar_documentos_cliente: "Anexar documentos",
  registrar_compra: "Registrar compra",
  receber_material: "Dar baixa no material",
  criar_servico_instalacao: "Criar serviço",
  concluir_servico_instalacao: "Concluir serviço",
  agendar_com_cliente: "Agendar",
  cadastrar_usina: "Cadastrar usina",
  liberar_monitoramento: "Liberar monitoramento",
  registrar_pagamento: "Registrar pagamento",
  criar_grupo_whatsapp: "Criar grupo",
};

/** Itens-ação por sub-etapa. Convivem com os itens manuais (`check`) do template. */
export const CHECKLIST_ACTION_ITEMS: Record<string, ChecklistActionItem[]> = {
  onboarding_documentacao_do_cliente: [
    {
      label: "Receber documentos do cliente",
      acao: "anexar_documentos_cliente",
      atalho: { tipo: "aba", destino: "documentos" },
    },
  ],
  onboarding_boas_vindas: [
    {
      label: "Criar o grupo de WhatsApp com o cliente",
      acao: "criar_grupo_whatsapp",
      atalho: { tipo: "aba", destino: "whatsapp" },
    },
  ],
  onboarding_financeiro: [
    {
      label: "Registrar o pagamento / entrada",
      acao: "registrar_pagamento",
      atalho: { tipo: "aba", destino: "financeiro" },
    },
  ],
  homologacao_envio_a_concessionaria: [
    {
      label: "Atribuir técnico de homologação",
      acao: "atribuir_tecnico_homologacao",
      atalho: { tipo: "aba", destino: "homologacao" },
    },
    {
      label: "Registrar protocolo na concessionária",
      acao: "protocolo_concessionaria",
      atalho: { tipo: "aba", destino: "homologacao" },
    },
  ],
  planejamento_de_execucao_logistica_de_materiais: [
    {
      label: "Registrar a compra dos equipamentos",
      acao: "registrar_compra",
      atalho: { tipo: "aba", destino: "compras" },
    },
  ],
  planejamento_de_execucao_recebimento_de_material: [
    {
      label: "Confirmar recebimento do material",
      acao: "receber_material",
      atalho: { tipo: "aba", destino: "compras" },
    },
  ],
  planejamento_de_execucao_designacao_de_equipe: [
    {
      label: "Criar o serviço de instalação",
      acao: "criar_servico_instalacao",
      atalho: { tipo: "rota", destino: "/interno/servicos" },
    },
  ],
  planejamento_de_execucao_agendamento_com_cliente: [
    {
      label: "Agendar a instalação com o cliente",
      acao: "agendar_com_cliente",
      atalho: { tipo: "aba", destino: "agendamento" },
    },
  ],
  execucao_instalacao_dos_equipamentos: [
    {
      label: "Concluir o serviço de instalação",
      acao: "concluir_servico_instalacao",
      atalho: { tipo: "rota", destino: "/interno/servicos" },
    },
  ],
  ativacao_configuracao_do_monitoramento: [
    {
      label: "Cadastrar a ficha da usina",
      acao: "cadastrar_usina",
      atalho: { tipo: "aba", destino: "usina" },
    },
    {
      label: "Liberar o monitoramento para o cliente",
      acao: "liberar_monitoramento",
      atalho: { tipo: "aba", destino: "usina" },
    },
  ],
};

export function acoesFor(slug: string): ChecklistActionItem[] {
  return CHECKLIST_ACTION_ITEMS[slug] ?? [];
}
