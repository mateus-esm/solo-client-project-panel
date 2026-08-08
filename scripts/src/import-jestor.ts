/**
 * Importa os projetos do Jestor (export xlsx -> JSON) para o Postgres.
 *
 *   python scripts/xlsx-to-json.py export.xlsx /tmp/jestor.json
 *   pnpm --filter @workspace/scripts run import:jestor -- /tmp/jestor.json --dry-run
 *   pnpm --filter @workspace/scripts run import:jestor -- /tmp/jestor.json
 *
 * Flags:
 *   --dry-run   mapeia e valida sem tocar no banco (não exige DATABASE_URL)
 *   --all       importa também os projetos Concluído (padrão: só os ativos)
 *
 * Idempotente: deduplica por (client_name, created_at). Rodar de novo não duplica.
 * Transacional: ou entra tudo, ou não entra nada.
 */
import { readFileSync } from "node:fs";
import {
  CHECKLIST_TEMPLATE,
  PIPELINE_STAGES,
  clientStepFor,
  isValidSubStage,
  defaultSubStage,
  type PipelineStage,
} from "@workspace/db/schema";

type RawRow = Record<string, string | number | null>;

// ─── Mapeamentos ──────────────────────────────────────────────────────────────

// "Status do Projeto" (Jestor) -> macro-etapa.
// "Revisão" -> pendencias: significa que algo precisa de atenção, e em pendências
// fica visível como pendência em vez de sumir no meio dos projetos ativos.
const STATUS_TO_STAGE: Record<string, PipelineStage> = {
  Onboarding: "onboarding",
  "Projeto Técnico": "projeto_homologacao",
  Homologação: "projeto_homologacao",
  "Planejamento de Execução": "planejamento_execucao",
  Execução: "execucao",
  Ativação: "ativacao",
  Concluído: "concluido",
  Revisão: "pendencias",
  Pausado: "pausado",
};

// "Etapa" (Jestor) -> slug de sub-etapa. Só é aplicado quando o slug pertence
// à macro-etapa de destino; caso contrário cai no defaultSubStage.
const ETAPA_TO_SUBSTAGE: Record<string, string> = {
  "Cadastro de Dados": "onboarding_documentacao_do_cliente",
  "Cadastro Comercial": "onboarding_financeiro",
  "Pendência Comercial": "onboarding_financeiro",
  "Pendência Financeira": "onboarding_financeiro",
  "Revisão Técnica": "onboarding_revisao_tecnica",
  "Pré-Análise Técnica (Viabilidade e Ajustes)": "projeto_tecnico_elaboracao",
  "Acompanhamento e Retornos": "homologacao_acompanhamento_e_retornos",
  "Validação de Planejamento": "planejamento_de_execucao_validacao_de_planejament",
  "Autorização para Ativação": "ativacao_autorizacao_para_ativacao",
  "Ativação Física e Testes": "ativacao_ativacao_fisica_e_testes",
  "Entrega Técnica": "ativacao_entrega_tecnica",
  "Projeto Concluído": "concluido_fechamento_do_projeto",
  "Gestão da Pausa": "pausado_gestao_da_pausa",
};

// Coluna de checklist do Jestor -> (macro-etapa, slug do grupo) no schema atual.
// As etapas "Compras e Logística" foram aposentadas (viraram trilha de suprimentos);
// seus itens vão para Logística de Materiais, onde a informação continua fazendo sentido.
const CHECKLIST_COLUMN_MAP: Record<string, [PipelineStage, string]> = {
  "Onboarding - Cadastro de Dados": ["onboarding", "onboarding_documentacao_do_cliente"],
  "Onboarding - Comercial": ["onboarding", "onboarding_financeiro"],
  "Onboarding - Financeiro": ["onboarding", "onboarding_financeiro"],
  "Onboarding - Técnico": ["onboarding", "onboarding_revisao_tecnica"],

  "Projeto Técnico - Pré Análise Técnica (Viabilidade e Ajustes)": ["projeto_homologacao", "projeto_tecnico_elaboracao"],
  "Projeto Técnico - Dimensionamento e Simulação": ["projeto_homologacao", "projeto_tecnico_elaboracao"],
  "Projeto Técnico - Desenho do Projeto Executivo": ["projeto_homologacao", "projeto_tecnico_elaboracao"],
  "Projeto Técnico - Emissão da ART": ["projeto_homologacao", "projeto_tecnico_elaboracao"],
  "Projeto Técnico - Validação Técnica": ["projeto_homologacao", "projeto_tecnico_validacao"],

  "Compras e Logística - Validação da Lista de Materiais": ["planejamento_execucao", "planejamento_de_execucao_logistica_de_materiais"],
  "Compras e Logística - Cotação e Compras": ["planejamento_execucao", "planejamento_de_execucao_logistica_de_materiais"],
  "Compras e Logística - Programação de Logística e Entrega": ["planejamento_execucao", "planejamento_de_execucao_logistica_de_materiais"],
  "Compras e Logística - Validação de Compras e Logística": ["planejamento_execucao", "planejamento_de_execucao_logistica_de_materiais"],

  "Homologação - Preparação de Documentação": ["projeto_homologacao", "homologacao_envio_a_concessionaria"],
  "Homologação - Envio à Concessionária": ["projeto_homologacao", "homologacao_envio_a_concessionaria"],
  "Homologação - Acompanhamento e Retornos": ["projeto_homologacao", "homologacao_acompanhamento_e_retornos"],
  "Homologação - Aprovação e Registro": ["projeto_homologacao", "homologacao_aprovacao_e_registro"],
  "Homologação - Validação de Homologação": ["projeto_homologacao", "homologacao_validacao_de_homologacao"],

  "Planejamento de Execução - Logística de Materiais": ["planejamento_execucao", "planejamento_de_execucao_logistica_de_materiais"],
  "Planejamento de Execução - Designação de Equipe": ["planejamento_execucao", "planejamento_de_execucao_designacao_de_equipe"],
  "Planejamento de Execução - Agendamento com Cliente": ["planejamento_execucao", "planejamento_de_execucao_agendamento_com_cliente"],
  "Planejamento de Execução - Mapeamento de Riscos": ["planejamento_execucao", "planejamento_de_execucao_mapeamento_de_riscos"],
  "Planejamento de Execução - Validação de Planejamento": ["planejamento_execucao", "planejamento_de_execucao_validacao_de_planejament"],

  "Execução - Preparação para Obra": ["execucao", "execucao_preparacao_para_obra"],
  "Execução - Instalação dos Equipamentos": ["execucao", "execucao_instalacao_dos_equipamentos"],
  "Execução - Conexão Elétrica e Comissionamento": ["execucao", "execucao_conexao_eletrica_e_comissionamento"],
  "Execução - Registros e Documentação": ["execucao", "execucao_registros_e_documentacao"],
  "Execução - Vistoria de Obra": ["execucao", "execucao_vistoria_de_obra"],
  "Execução - Validação de Execução": ["execucao", "execucao_validacao_de_execucao"],

  "Ativação - Autorização para ativação": ["ativacao", "ativacao_autorizacao_para_ativacao"],
  "Ativação - Ativação Física e Testes": ["ativacao", "ativacao_ativacao_fisica_e_testes"],
  "Ativação - Configuração do Monitoramento": ["ativacao", "ativacao_configuracao_do_monitoramento"],
  "Ativação - Entrega Técnica": ["ativacao", "ativacao_entrega_tecnica"],
  "Ativação - Validação de Ativação": ["ativacao", "ativacao_validacao_de_ativacao"],

  "Concluído - Confirmação Técnica de Entrega": ["concluido", "concluido_confirmacao_tecnica_de_entrega"],
  "Concluído - Documentação do Projeto": ["concluido", "concluido_documentacao_do_projeto"],
  "Concluído - Passagem de Bastão para Suporte": ["concluido", "ativacao_passagem_de_bastao_para_suporte"],
  "Concluído - Fechamento do Projeto": ["concluido", "concluido_fechamento_do_projeto"],

  "Pausado - Gestão da Pausa": ["pausado", "pausado_gestao_da_pausa"],
};

const PAYMENT_PLAN: Record<string, string> = {
  "À vista": "avista",
  Cartão: "cartao",
  Financiamento: "parcelado_solo",
};

// Curva etapa -> % usada pelo portal do cliente (mesma de lib/jestor.ts).
const STEP_PERCENT: Record<number, number> = { 1: 10, 2: 28, 3: 45, 4: 60, 5: 78, 6: 92, 7: 100 };

// ─── Normalização ─────────────────────────────────────────────────────────────

/** O Jestor exporta vazios como "-" e o Excel escapa como "'-". Ambos viram null. */
function clean(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim().replace(/^'/, "").trim();
  if (text === "" || text === "-") return null;
  return text;
}

function num(value: string | number | null | undefined): number | null {
  const text = clean(value);
  if (text === null) return null;
  const parsed = Number(String(text).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 40) || "cliente";
}

// ─── Mapeamento de uma linha ──────────────────────────────────────────────────

interface MappedChecklistItem {
  stage: PipelineStage;
  checklistSlug: string;
  label: string;
  done: boolean;
  sortOrder: number;
}

interface MappedProject {
  project: Record<string, unknown>;
  checklist: MappedChecklistItem[];
  warnings: string[];
}

function mapRow(raw: RawRow, emailsSeen: Set<string>): MappedProject {
  const warnings: string[] = [];

  const name = clean(raw["Nome"]) ?? clean(raw["Negociação"]);
  if (!name) throw new Error("linha sem 'Nome' nem 'Negociação'");

  const status = clean(raw["Status do Projeto"]) ?? "";
  const stage = STATUS_TO_STAGE[status];
  if (!stage) throw new Error(`status desconhecido: "${status}"`);

  // Sub-etapa: só aplica se pertencer à macro-etapa de destino.
  const etapa = clean(raw["Etapa"]);
  let subStage: string | null = null;
  if (etapa) {
    const candidate = ETAPA_TO_SUBSTAGE[etapa];
    if (candidate && isValidSubStage(stage, candidate)) {
      subStage = candidate;
    } else if (CHECKLIST_TEMPLATE[stage].length > 0) {
      subStage = defaultSubStage(stage);
      if (candidate) {
        warnings.push(`etapa "${etapa}" não pertence a ${stage}; usando ${subStage}`);
      }
    }
  } else if (CHECKLIST_TEMPLATE[stage].length > 0) {
    subStage = defaultSubStage(stage);
  }

  // O dataset não tem e-mail de cliente (os 31 encontrados são do responsável
  // técnico interno). client_email é NOT NULL, então geramos um endereço em
  // .invalid — TLD reservado por RFC 6761, garantidamente não roteável, para que
  // nenhum convite ou notificação saia para um endereço inventado.
  let email = `${slugify(name)}@sem-email.invalid`;
  if (emailsSeen.has(email)) {
    let n = 2;
    while (emailsSeen.has(`${slugify(name)}.${n}@sem-email.invalid`)) n += 1;
    email = `${slugify(name)}.${n}@sem-email.invalid`;
  }
  emailsSeen.add(email);

  const step = clientStepFor(stage, subStage);
  const formaPagamento = clean(raw["Forma de Pagamento"]);

  // Observações + a etapa original, para não perder a posição do Jestor quando a
  // macro-etapa é pendencias/pausado (que não têm sub-etapa).
  const notesParts = [clean(raw["Observações"])];
  if (etapa && !subStage) notesParts.push(`[Jestor] Etapa: ${etapa}`);
  const notes = notesParts.filter(Boolean).join("\n") || null;

  const project: Record<string, unknown> = {
    clientName: name,
    clientEmail: email,
    systemPower: num(raw["Potência (kWp)"]) ?? 0,
    stage,
    subStage,
    statusProjeto: status,
    statusStep: step ?? 1,
    completionPercent: stage === "concluido" ? 100 : step ? (STEP_PERCENT[step] ?? 0) : 0,
    city: "",
    state: "",
    valorProjeto: num(raw["Valor do Projeto"]),
    capex: num(raw["Capex"]),
    receitaBruta: num(raw["Receita Bruta"]),
    formaDePagamento: formaPagamento,
    paymentPlanType: formaPagamento ? (PAYMENT_PLAN[formaPagamento] ?? null) : null,
    notes,
    observacoesGerais: clean(raw["Observações Gerais"]),
    dataInicioPrevista: clean(raw["Data de Início Prevista"]),
    dataConclusaoPrevista: clean(raw["Data de Conclusão Prevista"]),
    dataDeFechamento: clean(raw["Data de fechamento"]),
    dataDePagamento: clean(raw["Data de pagamento"]),
    dataDeCompras: clean(raw["Data de compras"]),
    dataDeEntregaDoEquipamento: clean(raw["Data de entrega do equipamento"]),
  };

  // Checklists: tokens "Rótulo:1|Outro:0" — :1 = concluído, :0 = pendente.
  // O estado real é importado como está; nada é marcado como feito por inferência.
  const checklist: MappedChecklistItem[] = [];
  for (const [column, [itemStage, slug]] of Object.entries(CHECKLIST_COLUMN_MAP)) {
    const cell = clean(raw[column]);
    if (!cell) continue;
    cell.split("|").forEach((token, idx) => {
      const sep = token.lastIndexOf(":");
      if (sep < 1) return;
      const label = token.slice(0, sep).trim();
      const flag = token.slice(sep + 1).trim();
      if (!label) return;
      checklist.push({
        stage: itemStage,
        checklistSlug: slug,
        label,
        done: flag === "1",
        sortOrder: idx,
      });
    });
  }

  return { project, checklist, warnings };
}

// ─── Execução ─────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const includeAll = args.includes("--all");
  const jsonPath = args.find((a) => !a.startsWith("--"));

  if (!jsonPath) {
    console.error("uso: import-jestor <arquivo.json> [--dry-run] [--all]");
    process.exit(1);
  }

  const rows = JSON.parse(readFileSync(jsonPath, "utf-8")) as RawRow[];
  const selected = includeAll
    ? rows
    : rows.filter((r) => clean(r["Status do Projeto"]) !== "Concluído");

  console.log(`\nLinhas no arquivo: ${rows.length}`);
  console.log(`Selecionadas:      ${selected.length} (${includeAll ? "todas" : "só ativas"})\n`);

  const emailsSeen = new Set<string>();
  const mapped: MappedProject[] = [];
  const failures: string[] = [];

  for (const raw of selected) {
    try {
      mapped.push(mapRow(raw, emailsSeen));
    } catch (err) {
      failures.push(`${clean(raw["Nome"]) ?? "(sem nome)"}: ${(err as Error).message}`);
    }
  }

  const byStage = new Map<string, number>();
  for (const m of mapped) {
    const s = m.project.stage as string;
    byStage.set(s, (byStage.get(s) ?? 0) + 1);
  }
  const totalItems = mapped.reduce((n, m) => n + m.checklist.length, 0);
  const doneItems = mapped.reduce((n, m) => n + m.checklist.filter((i) => i.done).length, 0);

  console.log("Projetos por macro-etapa:");
  for (const stage of PIPELINE_STAGES) {
    const n = byStage.get(stage) ?? 0;
    if (n) console.log(`   ${stage.padEnd(28)} ${n}`);
  }
  console.log(`\nItens de checklist: ${totalItems}  (concluídos: ${doneItems})`);

  const warned = mapped.filter((m) => m.warnings.length);
  if (warned.length) {
    console.log(`\nAvisos (${warned.length}):`);
    for (const m of warned.slice(0, 10)) {
      console.log(`   ${m.project.clientName}: ${m.warnings.join("; ")}`);
    }
  }
  if (failures.length) {
    console.log(`\nFALHAS (${failures.length}):`);
    failures.forEach((f) => console.log(`   ${f}`));
  }

  if (dryRun) {
    console.log("\n--dry-run: nada foi gravado.\n");
    console.log("Amostra (3 primeiros):");
    for (const m of mapped.slice(0, 3)) {
      const p = m.project;
      console.log(
        `   ${String(p.clientName).padEnd(30)} ${String(p.stage).padEnd(22)} ` +
          `sub=${String(p.subStage ?? "-").padEnd(38)} step=${p.statusStep} itens=${m.checklist.length}`,
      );
    }
    console.log();
    return;
  }

  if (failures.length) {
    console.error("\nAbortado: corrija as falhas antes de importar.\n");
    process.exit(1);
  }

  // Importa de fato — só aqui o banco é necessário.
  const { db, pool } = await import("@workspace/db");
  const { projectsTable, projectChecklistItemsTable } = await import("@workspace/db/schema");
  const { eq } = await import("drizzle-orm");

  let created = 0;
  let skipped = 0;

  await db.transaction(async (tx) => {
    for (const m of mapped) {
      const name = m.project.clientName as string;
      // Idempotência: o export não traz o id do Jestor, então dedupe por nome.
      const existing = await tx
        .select({ id: projectsTable.id })
        .from(projectsTable)
        .where(eq(projectsTable.clientName, name))
        .limit(1);
      if (existing.length > 0) {
        skipped += 1;
        continue;
      }

      const [row] = await tx
        .insert(projectsTable)
        .values(m.project as typeof projectsTable.$inferInsert)
        .returning({ id: projectsTable.id });

      if (m.checklist.length > 0) {
        await tx.insert(projectChecklistItemsTable).values(
          m.checklist.map((item) => ({
            projectId: row.id,
            stage: item.stage,
            checklistSlug: item.checklistSlug,
            label: item.label,
            done: item.done,
            // Origem do dado. O Jestor não exporta quem concluiu nem quando,
            // então doneAt fica null em vez de receber uma data inventada.
            doneBy: item.done ? "importado do Jestor" : null,
            sortOrder: item.sortOrder,
          })),
        );
      }
      created += 1;
    }
  });

  console.log(`\nImportados: ${created}   já existentes (ignorados): ${skipped}\n`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
