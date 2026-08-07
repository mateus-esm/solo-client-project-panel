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
  createdAt: string;
}

export interface ChecklistItem {
  id: number;
  projectId: number;
  stage: StageId;
  checklistSlug: string;
  label: string;
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
  createdAt: string;
  updatedAt: string;
  files: ServiceFileItem[];
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
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  del: <T = void>(path: string) => request<T>("DELETE", path),
};

export const formatBRL = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "—"
    : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
