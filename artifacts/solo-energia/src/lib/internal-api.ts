// Typed fetch helper + shared types/constants for the internal ERP pages.
// Mirrors lib/db/src/schema/pipeline.ts (kept in sync manually — spec decision for hour-1).

// Macro-etapas do pipeline (colunas do kanban). Compras + Logística não são mais
// etapas: viraram trilha paralela de suprimentos derivada das compras do projeto.
export const STAGES = [
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

export type StageId = (typeof STAGES)[number];

export const STAGE_LABELS: Record<StageId, string> = {
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

// Colunas do kanban: fluxo principal primeiro, Pendências/Pausado à parte no fim.
export const KANBAN_MAIN_STAGES: StageId[] = [
  "onboarding",
  "projeto_homologacao",
  "planejamento_execucao",
  "execucao",
  "ativacao",
  "comissionamento_treinamento",
  "concluido",
];
export const KANBAN_SIDE_STAGES: StageId[] = ["pendencias", "pausado"];

export interface ChecklistTemplateGroup {
  slug: string;
  title: string;
}

export const CHECKLIST_TEMPLATE: Record<StageId, ChecklistTemplateGroup[]> = {
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
// Sub-etapas são os grupos de checklist da macro-etapa (project.subStage guarda o
// slug do grupo atual). Trocar a sub-etapa não muda a coluna do kanban.

export const subStagesFor = (stage: StageId): ChecklistTemplateGroup[] =>
  CHECKLIST_TEMPLATE[stage] ?? [];

export const subStageTitle = (stage: StageId, slug: string | null): string | null =>
  subStagesFor(stage).find((g) => g.slug === slug)?.title ?? null;

// ─── Trilha de suprimentos ────────────────────────────────────────────────────
// Selo derivado das compras do projeto, visível em qualquer macro-etapa.

export interface SupplySummary {
  total: number;
  cotacao: number;
  comprada: number;
  logisticaProgramada: number;
  recebida: number;
}

export function supplyBadge(s: SupplySummary | undefined | null): {
  label: string;
  tone: "muted" | "pending" | "progress" | "done";
} {
  if (!s || s.total === 0) return { label: "Sem compras", tone: "muted" };
  if (s.recebida === s.total) return { label: `${s.recebida}/${s.total} recebidas`, tone: "done" };
  if (s.cotacao === s.total) return { label: "Em cotação", tone: "pending" };
  if (s.recebida > 0) return { label: `${s.recebida}/${s.total} recebidas`, tone: "progress" };
  if (s.logisticaProgramada > 0) return { label: "Logística programada", tone: "progress" };
  return { label: "Compras em andamento", tone: "progress" };
}

export const SERVICE_TIPOS = [
  "Instalação",
  "Manutenção",
  "Visita Técnica",
  "Projeto Elétrico",
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
  subStage: string | null;
  supply?: SupplySummary;
  capex: number | null;
  custoMateriais: number | null;
  custoServico: number | null;
  receitaBruta: number | null;
  formaDePagamento: string | null;
  paymentPlanType: PaymentPlanType | null;
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

// ─── Fornecedores e compras ───────────────────────────────────────────────────

export const SUPPLIER_TIPOS = ["equipamentos", "materiais"] as const;
export type SupplierTipo = (typeof SUPPLIER_TIPOS)[number];

export const SUPPLIER_TIPO_LABELS: Record<SupplierTipo, string> = {
  equipamentos: "Equipamentos (capex)",
  materiais: "Outros materiais",
};

export interface Supplier {
  id: number;
  name: string;
  tipo: SupplierTipo;
  contatoNome: string | null;
  telefone: string | null;
  email: string | null;
  observacoes: string | null;
  createdAt: string;
}

export const PURCHASE_STATUS = ["cotacao", "comprada", "logistica_programada", "recebida"] as const;
export type PurchaseStatus = (typeof PURCHASE_STATUS)[number];

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  cotacao: "Cotação",
  comprada: "Comprada",
  logistica_programada: "Logística programada",
  recebida: "Recebida",
};

export interface Purchase {
  id: number;
  projectId: number;
  supplierId: number;
  supplierName: string;
  categoria: SupplierTipo;
  descricao: string;
  status: PurchaseStatus;
  valorCotacao: number | null;
  valor: number | null;
  dataCompra: string | null;
  numeroNfe: string | null;
  formaPagamento: string | null;
  transportadora: string | null;
  codigoRastreio: string | null;
  previsaoEntrega: string | null;
  dataRecebimento: string | null;
  recebidoPor: string | null;
  observacoes: string | null;
  createdAt: string;
}

// ─── Financeiro do projeto ────────────────────────────────────────────────────

export const PAYMENT_PLAN_TYPES = ["avista", "cartao", "parcelado_solo", "entrada_entrega"] as const;
export type PaymentPlanType = (typeof PAYMENT_PLAN_TYPES)[number];

export const PAYMENT_PLAN_LABELS: Record<PaymentPlanType, string> = {
  avista: "À vista",
  cartao: "Cartão de crédito",
  parcelado_solo: "Parcelado com a Solo",
  entrada_entrega: "Entrada + entrega",
};

export interface ProjectPayment {
  id: number;
  projectId: number;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  paidDate: string | null;
  status: "pending" | "paid" | "overdue";
  description: string | null;
  createdAt: string;
}

export interface FinanceSummaryInstallment {
  id: number;
  projectId: number;
  clientName: string;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  description: string | null;
  status: "pending" | "paid" | "overdue";
  overdue: boolean;
}

export interface FinanceSummary {
  totals: {
    receitaBruta: number;
    custos: number;
    receitaLiquida: number;
    recebido: number;
    aReceber: number;
    atrasado: number;
  };
  projectCount: number;
  openInstallments: FinanceSummaryInstallment[];
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
  onboarding_lista_materiais: [
    { key: "listaMateriais", label: "Lista de materiais", type: "text" },
    { key: "observacoes", label: "Observações", type: "text" },
  ],
  planejamento_de_execucao_recebimento_de_material: [
    { key: "dataRecebimento", label: "Data de recebimento", type: "date" },
    { key: "recebidoPor", label: "Recebido por", type: "text" },
  ],
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
  // compras_* groups were retired with the supply track (procurement module).
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
  origem?: string;
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
  supply: SupplySummary;
  acoesCumpridas?: ChecklistAcao[];
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

// ─── Clientes, usinas e estoque (Sprint 1.2) ─────────────────────────────────

export interface Client {
  id: number;
  name: string;
  phone: string | null;
  phoneNormalized: string | null;
  email: string | null;
  cpfCnpj: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  origem: string;
  canalCaptacao: string | null;
  observacoes: string | null;
  createdAt: string;
  projectCount?: number;
}

export interface Plant {
  id: number;
  projectId: number | null;
  clientId: number | null;
  name: string | null;
  tipoUsina: string | null;
  status: string | null;
  concessionaria: string | null;
  enderecoInstalacao: string | null;
  city: string | null;
  state: string | null;
  potenciaInstaladaKwp: number | null;
  areaConstruidaM2: number | null;
  geracaoEstimadaKwh: number | null;
  receitaEstimada: number | null;
  consumoMedioMensal: number | null;
  dataInicio: string | null;
  dataAtivacao: string | null;
  moduloFabricante: string | null;
  moduloPotenciaW: number | null;
  moduloQuantidade: number | null;
  inversorFabricante: string | null;
  inversorPotenciaKw: number | null;
  inversorQuantidade: number | null;
  tipoEstrutura: string | null;
  tipoMonitoramento: string | null;
  monitoramentoUrl: string | null;
  driveUrl: string | null;
  observacoes: string | null;
}

export interface ClientDetail {
  client: Client;
  projects: InternalProject[];
  plants: Plant[];
}

export const STOCK_CATEGORIAS = [
  "modulo",
  "inversor",
  "estrutura",
  "cabo",
  "protecao",
  "ferramenta",
  "outro",
] as const;
export type StockCategoria = (typeof STOCK_CATEGORIAS)[number];

export const STOCK_CATEGORIA_LABELS: Record<StockCategoria, string> = {
  modulo: "Módulo",
  inversor: "Inversor",
  estrutura: "Estrutura",
  cabo: "Cabo",
  protecao: "Proteção",
  ferramenta: "Ferramenta",
  outro: "Outro",
};

export interface StockItem {
  id: number;
  sku: string | null;
  name: string;
  categoria: string;
  unidade: string;
  quantidade: number;
  custoUnitario: number | null;
  estoqueMinimo: number | null;
  supplierId: number | null;
  localizacao: string | null;
  observacoes: string | null;
}

/** (85) 9 8888-7777 a partir de 85988887777 — só para exibição. */
export function formatPhone(raw: string | null | undefined): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 3)} ${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw ?? "—";
}

// ─── Itens-ação do checklist (Sprint 2) ──────────────────────────────────────
// Espelha lib/db/src/schema/pipeline.ts. Item-ação não é caixinha: é cumprido
// quando a ação real acontece, e o cumprimento vem derivado do backend.

export type ChecklistAcao =
  | "atribuir_tecnico_homologacao"
  | "protocolo_concessionaria"
  | "anexar_documentos_cliente"
  | "registrar_compra"
  | "receber_material"
  | "criar_servico_instalacao"
  | "concluir_servico_instalacao"
  | "agendar_com_cliente"
  | "cadastrar_usina"
  | "liberar_monitoramento"
  | "registrar_pagamento";

export interface ChecklistActionItem {
  label: string;
  acao: ChecklistAcao;
  atalho: { tipo: "rota" | "aba"; destino: string };
}

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
};

export const CHECKLIST_ACTION_ITEMS: Record<string, ChecklistActionItem[]> = {
  onboarding_documentacao_do_cliente: [
    { label: "Receber documentos do cliente", acao: "anexar_documentos_cliente", atalho: { tipo: "aba", destino: "documentos" } },
  ],
  onboarding_financeiro: [
    { label: "Registrar o pagamento / entrada", acao: "registrar_pagamento", atalho: { tipo: "aba", destino: "financeiro" } },
  ],
  homologacao_envio_a_concessionaria: [
    { label: "Atribuir técnico de homologação", acao: "atribuir_tecnico_homologacao", atalho: { tipo: "aba", destino: "homologacao" } },
    { label: "Registrar protocolo na concessionária", acao: "protocolo_concessionaria", atalho: { tipo: "aba", destino: "homologacao" } },
  ],
  planejamento_de_execucao_logistica_de_materiais: [
    { label: "Registrar a compra dos equipamentos", acao: "registrar_compra", atalho: { tipo: "aba", destino: "compras" } },
  ],
  planejamento_de_execucao_recebimento_de_material: [
    { label: "Confirmar recebimento do material", acao: "receber_material", atalho: { tipo: "aba", destino: "compras" } },
  ],
  planejamento_de_execucao_designacao_de_equipe: [
    { label: "Criar o serviço de instalação", acao: "criar_servico_instalacao", atalho: { tipo: "rota", destino: "/interno/servicos" } },
  ],
  planejamento_de_execucao_agendamento_com_cliente: [
    { label: "Agendar a instalação com o cliente", acao: "agendar_com_cliente", atalho: { tipo: "aba", destino: "agendamento" } },
  ],
  execucao_instalacao_dos_equipamentos: [
    { label: "Concluir o serviço de instalação", acao: "concluir_servico_instalacao", atalho: { tipo: "rota", destino: "/interno/servicos" } },
  ],
  ativacao_configuracao_do_monitoramento: [
    { label: "Cadastrar a ficha da usina", acao: "cadastrar_usina", atalho: { tipo: "aba", destino: "usina" } },
    { label: "Liberar o monitoramento para o cliente", acao: "liberar_monitoramento", atalho: { tipo: "aba", destino: "usina" } },
  ],
};

export const acoesFor = (slug: string): ChecklistActionItem[] =>
  CHECKLIST_ACTION_ITEMS[slug] ?? [];
