import { logger } from "./logger";

const JESTOR_TABLE_ID = "mjx3lkndn84a5hhtx94s4";

function getJestorConfig(): { apiToken: string; companySlug: string } | null {
  const apiToken = process.env.JESTOR_API_TOKEN;
  const companySlug = process.env.JESTOR_COMPANY_SLUG;
  if (!apiToken || !companySlug) {
    logger.warn("JESTOR_API_TOKEN or JESTOR_COMPANY_SLUG not configured");
    return null;
  }
  return { apiToken, companySlug };
}

export interface JestorProject {
  id: string;
  name: string;
  tipo_cliente?: string;
  status_projeto?: string;
  data_inicio_prevista?: string;
  data_conclusao_prevista?: string;
  data_de_fechamento?: string;
  data_de_pagamento?: string;
  data_de_compras?: string;
  data_de_entrega_do_equipamento?: string;
  valor_projeto?: number;
  forma_de_pagamento?: string;
  observacoes?: string;
  observacoes_gerais?: string;
  [key: string]: unknown;
}

export async function getJestorProject(jestorId: string): Promise<JestorProject | null> {
  const config = getJestorConfig();
  if (!config) return null;

  try {
    const response = await fetch(
      `https://${config.companySlug}.api.jestor.com/object/list`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.apiToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          object_type: JESTOR_TABLE_ID,
          filters: [{ field: "id", operator: "==", value: jestorId }],
          size: 1,
        }),
      }
    );

    if (!response.ok) {
      logger.error({ status: response.status, jestorId }, "Jestor API returned error");
      return null;
    }

    const data = await response.json() as { data?: JestorProject[] };
    return data?.data?.[0] ?? null;
  } catch (err) {
    logger.error({ err, jestorId }, "Failed to fetch project from Jestor API");
    return null;
  }
}

export async function listJestorProjects(filters?: object[]): Promise<JestorProject[]> {
  const config = getJestorConfig();
  if (!config) return [];

  try {
    const response = await fetch(
      `https://${config.companySlug}.api.jestor.com/object/list`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${config.apiToken}`,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          object_type: JESTOR_TABLE_ID,
          size: 100,
          ...(filters ? { filters } : {}),
        }),
      }
    );

    if (!response.ok) {
      logger.error({ status: response.status }, "Jestor API list returned error");
      return [];
    }

    const data = await response.json() as { data?: JestorProject[] };
    return data?.data ?? [];
  } catch (err) {
    logger.error({ err }, "Failed to list projects from Jestor API");
    return [];
  }
}

/**
 * Maps Jestor's status_projeto string to our portal's step number.
 * Phases: 1=Onboarding, 2=Engenharia, 3=Homologação, 4=Logística, 5=Execução, 6=Ativação, 7=Treinamento
 */
export function mapJestorStatusToStep(statusProjeto: string | undefined | null): number {
  if (!statusProjeto) return 1;
  const normalized = statusProjeto.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (normalized.includes("treinamento") || normalized.includes("pos-venda") || normalized.includes("pos venda") || normalized.includes("pós-venda") || normalized.includes("pós venda") || normalized.includes("concluido treinamento")) return 7;
  if (normalized.includes("onboarding")) return 1;
  if (normalized.includes("engenharia") || normalized.includes("projeto tecnico") || normalized.includes("tecnico")) return 2;
  if (normalized.includes("homolog")) return 3;
  if (normalized.includes("logistic") || normalized.includes("compras") || normalized.includes("entrega")) return 4;
  if (normalized.includes("execucao") || normalized.includes("instalacao") || normalized.includes("obra")) return 5;
  if (normalized.includes("ativacao") || normalized.includes("ativação") || normalized.includes("concluido") || normalized.includes("finalizado")) return 6;
  return 1;
}

export function stepCompletionPercent(step: number): number {
  const map: Record<number, number> = { 1: 10, 2: 28, 3: 45, 4: 60, 5: 78, 6: 92, 7: 100 };
  return map[step] ?? 0;
}
