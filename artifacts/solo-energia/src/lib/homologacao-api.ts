// Shared types/constants for the homologação technician portal.
// Mirrors lib/db/src/schema/homologacao.ts (kept in sync manually).

export const KANBAN_STAGES = [
  "projeto_eletrico",
  "art",
  "envio_concessionaria",
  "acompanhamento",
  "aprovacao",
  "vistoria_concluido",
] as const;

export type KanbanStage = (typeof KANBAN_STAGES)[number];

export const KANBAN_LABELS: Record<KanbanStage, string> = {
  projeto_eletrico: "Projeto Elétrico",
  art: "ART",
  envio_concessionaria: "Envio à Concessionária",
  acompanhamento: "Acompanhamento",
  aprovacao: "Aprovação",
  vistoria_concluido: "Vistoria / Concluído",
};

export interface Processo {
  id: number;
  projectId: number;
  kanbanStage: KanbanStage;
  ucNumero: string | null;
  numeroSolicitacao: string | null;
  linksEnel: string | null;
  emailAcompanhamento: string | null;
  datasPrevistas: Record<string, string> | null;
  artPaga: boolean;
  artNfUrl: string | null;
  updatedAt: string;
}

export interface KanbanProject {
  id: number;
  clientName: string;
  systemPower: number;
  stage: string;
  city: string;
  state: string;
  kanbanStage: KanbanStage;
  artPaga: boolean;
}

export interface DashboardData {
  totals: {
    total: number;
    emAndamento: number;
    comPendencias: number;
    concluidos: number;
    artPendentes: number;
  };
  upcomingDeadlines: { projectId: number; clientName: string; label: string; date: string }[];
  recentProjects: {
    id: number;
    clientName: string;
    stage: string;
    city: string;
    state: string;
    systemPower: number;
  }[];
}

export interface FinanceiroData {
  totals: { recebido: number; aReceber: number; total: number };
  projects: {
    id: number;
    clientName: string;
    stage: string;
    valor: number | null;
    pago: boolean;
    formaPagamento: string | null;
  }[];
}

export async function homologacaoGet<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { credentials: "include" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message ?? "Erro ao carregar dados");
  }
  return res.json();
}

export async function homologacaoPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).message ?? "Erro ao salvar");
  }
  return res.json();
}
