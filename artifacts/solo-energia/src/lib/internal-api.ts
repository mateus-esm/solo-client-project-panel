// Typed fetch helper + shared types/constants for the internal ERP pages.
// Mirrors lib/db/src/schema/pipeline.ts (kept in sync manually — spec decision for hour-1).

export const STAGES = [
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

export type StageId = (typeof STAGES)[number];

export const STAGE_LABELS: Record<StageId, string> = {
  onboarding: "Onboarding",
  projeto_tecnico: "Projeto Técnico",
  homologacao: "Homologação",
  compras: "Compras",
  planejamento_execucao: "Planej. de Execução",
  execucao: "Execução",
  ativacao: "Ativação",
  comissionamento_treinamento: "Comissionamento e Treinamento",
  concluido: "Concluído",
  pendencias: "Pendências",
  pausado: "Pausado",
};

export interface ChecklistTemplateGroup {
  slug: string;
  title: string;
}

export const CHECKLIST_TEMPLATE: Record<StageId, ChecklistTemplateGroup[]> = {
  onboarding: [
    { slug: "onboarding_documentacao_do_cliente", title: "Documentação do Cliente" },
    { slug: "onboarding_boas_vindas", title: "Boas-vindas e Portal" },
  ],
  projeto_tecnico: [
    { slug: "projeto_tecnico_elaboracao", title: "Elaboração do Projeto" },
    { slug: "projeto_tecnico_validacao", title: "Validação do Projeto" },
  ],
  compras: [
    { slug: "compras_cotacoes", title: "Cotações" },
    { slug: "compras_compra", title: "Compra" },
    { slug: "compras_nfe", title: "NF-e" },
    { slug: "compras_logistica", title: "Logística e Entrega" },
  ],
  comissionamento_treinamento: [
    { slug: "comissionamento_treinamento_do_cliente", title: "Treinamento do Cliente" },
  ],
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

// --- Types (API JSON shapes) ---

export interface InternalProject {
  id: number;
  jestorId: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  systemPower: number;
  stage: StageId;
  capex: number | null;
  receitaBruta: number | null;
  statusStep: number;
  statusProjeto: string | null;
  trackingCode: string | null;
  trackingCarrier: string | null;
  city: string;
  state: string;
  completionPercent: number;
  estimatedActivation: string | null;
  notes: string | null;
  estimatedDate: string | null;
  valorProjeto: number | null;
  homologacaoTechnicianId: number | null;
  homologacaoValor: number | null;
  homologacaoPago: boolean;
  homologacaoFormaPagamento: string | null;
  homologacaoPix: string | null;
  createdAt: string;
}

export interface TeamMember {
  id: number;
  accountId: number;
  name: string;
  documento: string | null;
  photoUrl: string | null;
  docUrl: string | null;
  createdAt: string;
}

export interface InstallerAccount {
  id: number;
  name: string;
  email: string;
  teamName: string;
  razaoSocial: string | null;
  cnpj: string | null;
  responsavelNome: string | null;
  responsavelTelefone: string | null;
  pixKey: string | null;
  formaPagamento: string | null;
  createdAt: string;
  members: TeamMember[];
}

export interface Technician {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

export type ChecklistItemKind = "check" | "form" | "service" | "client_notify";

export interface ChecklistFieldDef {
  key: string;
  label: string;
  type: "text" | "date" | "select" | "currency" | "phone";
  options?: readonly string[];
}

// Field definitions per checklist group slug (mirrors lib/db/src/schema/pipeline.ts).
// Used to render the structured form when a "form" item is filled in.
export const CHECKLIST_FIELD_DEFS: Record<string, ChecklistFieldDef[]> = {
  projeto_tecnico_elaboracao: [
    { key: "responsavelTecnico", label: "Responsável técnico", type: "text" },
    { key: "dataPrevistaConclusao", label: "Data prevista de conclusão", type: "date" },
  ],
  homologacao_envio_a_concessionaria: [
    { key: "numeroProtocolo", label: "Número do protocolo", type: "text" },
    { key: "dataEnvio", label: "Data de envio", type: "date" },
    { key: "concessionaria", label: "Concessionária", type: "text" },
  ],
  homologacao_aprovacao_e_registro: [
    { key: "dataAprovacao", label: "Data da aprovação", type: "date" },
    { key: "numeroRegistro", label: "Número de registro", type: "text" },
  ],
  compras_cotacoes: [
    { key: "fornecedor", label: "Fornecedor", type: "text" },
    { key: "valorCotacao", label: "Valor da cotação", type: "currency" },
    { key: "prazoEntrega", label: "Prazo de entrega", type: "date" },
  ],
  compras_compra: [
    { key: "fornecedor", label: "Fornecedor escolhido", type: "text" },
    { key: "valorCompra", label: "Valor da compra", type: "currency" },
    { key: "dataCompra", label: "Data da compra", type: "date" },
    { key: "formaPagamento", label: "Forma de pagamento", type: "text" },
  ],
  compras_nfe: [
    { key: "numeroNfe", label: "Número da NF-e", type: "text" },
    { key: "dataEmissao", label: "Data de emissão", type: "date" },
  ],
  compras_logistica: [
    { key: "trackingCarrier", label: "Transportadora", type: "text" },
    { key: "trackingCode", label: "Código de rastreio", type: "text" },
    { key: "prazoEntrega", label: "Prazo de entrega", type: "date" },
  ],
  planejamento_de_execucao_logistica_de_materiais: [
    { key: "localArmazenamento", label: "Local de armazenamento", type: "text" },
    { key: "dataDisponibilidade", label: "Materiais disponíveis em", type: "date" },
  ],
  pausado_gestao_da_pausa: [
    { key: "motivoPausa", label: "Motivo da pausa", type: "text" },
    { key: "previsaoRetomada", label: "Previsão de retomada", type: "date" },
  ],
};

export interface ChecklistItem {
  id: number;
  projectId: number;
  stage: StageId;
  checklistSlug: string;
  label: string;
  kind: ChecklistItemKind;
  metadata: Record<string, unknown> | null;
  done: boolean;
  doneBy: string | null;
  doneAt: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface ServiceFileItem {
  id: number;
  serviceId: number;
  kind: "contrato_escopo" | "imagens_documentacao";
  name: string | null;
  url: string;
  createdAt: string;
}

export interface ServiceItem {
  id: number;
  projectId: number | null;
  name: string;
  tipoServico: string | null;
  valorServico: number | null;
  status: string;
  statusPagamento: string;
  pagamentoRealizado: boolean;
  dataExecucao: string | null;
  dataInicio: string | null;
  dataTermino: string | null;
  equipeExecucao: string | null;
  endereco: string | null;
  responsavelEmail: string | null;
  observacoes: string | null;
  valorProposto: number | null;
  valorFechado: number | null;
  custoLogistica: number | null;
  outrosCustos: number | null;
  formaPagamento: string | null;
  pixConta: string | null;
  comprovanteUrl: string | null;
  contratoUrl: string | null;
  contratoStatus: string;
  contratoAceitoEm: string | null;
  contratoAceitoPor: string | null;
  escalacaoStatus: 'pendente' | 'aprovada' | 'recusada' | null;
  escalacaoEnviadaPor: string | null;
  escalacaoEnviadaEm: string | null;
  escalacaoDecididaPor: string | null;
  escalacaoDecididaEm: string | null;
  createdAt: string;
  updatedAt: string;
  files: ServiceFileItem[];
  members?: TeamMember[];
}

export interface ProjectDetail {
  project: InternalProject;
  checklist: ChecklistItem[];
  services: ServiceItem[];
}

// --- Fetch helper ---

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = await res.json();
      if (data?.message) message = data.message;
    } catch {
      // keep statusText
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  del: <T = void>(path: string) => request<T>("DELETE", path),
};

export const formatBRL = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
