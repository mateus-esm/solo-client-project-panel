/**
 * Sprint 1 — cria clients e plants a partir dos projetos já importados, enriquecendo
 * com as planilhas de leads (telefone/e-mail), propostas (endereço/equipamentos) e
 * usinas (potência/monitoramento).
 *
 *   pnpm --filter @workspace/scripts run backfill:sprint1 -- <dir-json> --dry-run
 *   pnpm --filter @workspace/scripts run backfill:sprint1 -- <dir-json>
 *
 * <dir-json> deve conter leads.json, propostas.json e usinas.json (gerados por
 * scripts/xlsx-to-json.py). Idempotente: reexecutar não duplica.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db, pool } from "@workspace/db";
import { projectsTable, clientsTable, plantsTable } from "@workspace/db/schema";
import { eq, isNull, sql } from "drizzle-orm";

type Row = Record<string, string | number | null>;

const clean = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(/^'/, "").trim();
  return s === "" || s === "-" ? null : s;
};
const num = (v: unknown): number | null => {
  const t = clean(v);
  if (t === null) return null;
  const n = Number(String(t).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};
const int = (v: unknown): number | null => {
  const n = num(v);
  return n === null ? null : Math.round(n);
};
/** Sem acento, minúsculo, sem sufixo de tipo — só para casar planilhas. */
const norm = (s: unknown): string => {
  const t = clean(s);
  if (!t) return "";
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s*-\s*(o&m|ev\b|manutencao).*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
};
/** Só dígitos, sem DDI, 10-11 dígitos. Null quando não parece telefone. */
const phoneNorm = (v: unknown): string | null => {
  let d = String(clean(v) ?? "").replace(/\D/g, "");
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  return d.length >= 10 ? d.slice(-11) : null;
};

function pick<T>(list: T[], score: (t: T) => number): T | undefined {
  return list.slice().sort((a, b) => score(b) - score(a))[0];
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const dir = args.find((a) => !a.startsWith("--"));
  if (!dir) {
    console.error("uso: backfill-sprint1 <dir-com-json> [--dry-run]");
    process.exit(1);
  }

  const load = (f: string): Row[] => JSON.parse(readFileSync(join(dir, f), "utf-8"));
  const leads = load("leads.json");
  const propostas = load("propostas.json");
  const usinas = load("usinas.json");

  // Índices por nome normalizado
  const byName = <T extends Row>(rows: T[], key: string) => {
    const m = new Map<string, T[]>();
    for (const r of rows) {
      const k = norm(r[key]);
      if (!k) continue;
      const l = m.get(k) ?? [];
      l.push(r);
      m.set(k, l);
    }
    return m;
  };
  const leadIdx = byName(leads, "Nome");
  const propIdx = byName(propostas, "Nome do Cliente");
  const usinaIdx = byName(usinas, "Cliente");
  const usinaByNome = byName(usinas, "Nome");

  /** Match exato, depois prefixo. Fuzzy fica de fora: com dado de cliente, errar é pior que faltar. */
  function lookup<T extends Row>(idx: Map<string, T[]>, ...cands: string[]): T[] {
    for (const c of cands) {
      if (c && idx.has(c)) return idx.get(c)!;
    }
    for (const c of cands) {
      if (!c) continue;
      for (const [k, v] of idx) {
        if (k.startsWith(c + " ") || c.startsWith(k + " ")) return v;
      }
    }
    return [];
  }

  const projects = await db.select().from(projectsTable).orderBy(projectsTable.id);
  console.log(`\nProjetos no banco: ${projects.length}`);

  // ── 1. Agrupar projetos por cliente (nome normalizado) ─────────────────────
  const groups = new Map<string, typeof projects>();
  for (const p of projects) {
    const k = norm(p.clientName) || `id-${p.id}`;
    const l = groups.get(k) ?? [];
    l.push(p);
    groups.set(k, l);
  }
  console.log(`Clientes distintos: ${groups.size} (${projects.length} projetos)`);
  const multi = [...groups.entries()].filter(([, v]) => v.length > 1);
  if (multi.length) {
    console.log(`Clientes com mais de um projeto: ${multi.length}`);
    for (const [k, v] of multi) console.log(`   ${v[0].clientName} (${v.length} projetos)`);
  }

  // ── 2. Montar clientes com dados dos leads ─────────────────────────────────
  const phonesUsed = new Set<string>();
  const planned: {
    key: string;
    values: typeof clientsTable.$inferInsert;
    projectIds: number[];
    conflitoTelefone?: string;
  }[] = [];

  let comTel = 0;
  let comEmail = 0;
  for (const [key, ps] of groups) {
    const p = ps[0];
    const nomes = [norm(p.clientName)];
    const ld = lookup(leadIdx, ...nomes);
    const lead = pick(ld, (l) => (phoneNorm(l["Telefone"]) ? 2 : 0) + (clean(l["Email"]) ? 1 : 0));
    let tel = lead ? phoneNorm(lead["Telefone"]) : null;
    let conflito: string | undefined;
    if (tel && phonesUsed.has(tel)) {
      conflito = tel;
      tel = null; // índice único: não derruba a carga, fica para revisão manual
    }
    if (tel) {
      phonesUsed.add(tel);
      comTel++;
    }
    const email = lead ? clean(lead["Email"]) : null;
    if (email) comEmail++;

    // Endereço vem da proposta (a que tem Oportunidade vence)
    const pr = lookup(propIdx, ...nomes);
    const prop = pick(pr, (x) => (clean(x["Oportunidade"]) ? 1 : 0));

    planned.push({
      key,
      projectIds: ps.map((x) => x.id),
      conflitoTelefone: conflito,
      values: {
        name: p.clientName,
        phoneNormalized: tel,
        phone: lead ? clean(lead["Telefone"]) : null,
        email,
        address: prop ? clean(prop["Endereço de Instalação"]) : null,
        origem: lead ? "lead" : "jestor",
        canalCaptacao: lead ? clean(lead["Canal de captação"]) : null,
        soloappId: lead ? clean(lead["id_soloapp"]) : null,
      },
    });
  }
  console.log(`\nCLIENTES: ${planned.length} | com telefone ${comTel} | com e-mail ${comEmail}`);
  const conflitos = planned.filter((x) => x.conflitoTelefone);
  if (conflitos.length) {
    console.log(`Telefone repetido (ficou nulo, revisar): ${conflitos.length}`);
    for (const c of conflitos) console.log(`   ${c.values.name} -> ${c.conflitoTelefone}`);
  }

  // ── 3. Montar usinas ───────────────────────────────────────────────────────
  let comProposta = 0;
  let comUsina = 0;
  const plantsPlanned: { projectId: number; values: typeof plantsTable.$inferInsert }[] = [];
  for (const p of projects) {
    const n = norm(p.clientName);
    const pr = lookup(propIdx, n);
    const prop = pick(pr, (x) => (clean(x["Oportunidade"]) ? 1 : 0));
    const us = lookup(usinaIdx, n).concat(lookup(usinaByNome, n));
    const usina = us[0];
    if (prop) comProposta++;
    if (usina) comUsina++;
    if (!prop && !usina) continue; // sem nada para registrar, não cria usina vazia

    plantsPlanned.push({
      projectId: p.id,
      values: {
        projectId: p.id,
        name: usina ? clean(usina["Nome"]) : `${p.clientName} - ${p.systemPower} kWp`,
        tipoUsina: usina ? clean(usina["Tipo de Usina"]) : null,
        status: usina ? clean(usina["Status"]) : null,
        concessionaria: prop ? clean(prop["Concessionária"]) : null,
        enderecoInstalacao: prop ? clean(prop["Endereço de Instalação"]) : null,
        potenciaInstaladaKwp: (usina ? num(usina["Potência Instalada (kWp)"]) : null) ?? (p.systemPower || null),
        areaConstruidaM2: usina ? num(usina["Área Construída (m²)"]) : null,
        geracaoEstimadaKwh: usina ? num(usina["Geração Estimada (kWh)"]) : null,
        receitaEstimada: usina ? num(usina["Receita Estimada (R$)"]) : null,
        consumoMedioMensal: prop ? num(prop["Consumo Médio Mensal"]) : null,
        dataInicio: usina ? clean(usina["Data de Início"]) : null,
        dataAtivacao: usina ? clean(usina["Data de Ativação"]) : null,
        moduloFabricante: prop ? clean(prop["Fabricante Módulo"]) : null,
        moduloPotenciaW: prop ? num(prop["Potência do Módulo (W)"]) : null,
        moduloQuantidade: prop ? int(prop["Número de Módulos"]) : null,
        inversorFabricante: prop ? clean(prop["Fabricante Inversor"]) : null,
        inversorPotenciaKw: prop ? num(prop["Potência do Inversor (kW)"]) : null,
        inversorQuantidade: prop ? int(prop["Quantidade de Inversores"]) : null,
        tipoEstrutura: prop ? clean(prop["Tipo de Estrutura"]) : null,
        tipoMonitoramento: prop ? clean(prop["Tipo de Monitoramento"]) : null,
        monitoramentoUrl: usina ? clean(usina["Monitoramento"]) : null,
        driveUrl: usina ? clean(usina["Drive"]) : null,
        observacoes: usina ? clean(usina["Observações Gerais"]) : null,
      },
    });
  }
  console.log(
    `\nUSINAS: ${plantsPlanned.length} a criar | com proposta ${comProposta} | com ficha de usina ${comUsina}`,
  );

  if (dryRun) {
    console.log("\n--dry-run: nada foi gravado.\n");
    console.log("Amostra de clientes:");
    for (const c of planned.slice(0, 5)) {
      console.log(
        `   ${String(c.values.name).slice(0, 26).padEnd(28)} tel=${c.values.phoneNormalized ?? "-"} ` +
          `email=${(c.values.email ?? "-").slice(0, 26)} projetos=${c.projectIds.length}`,
      );
    }
    console.log("\nAmostra de usinas:");
    for (const pl of plantsPlanned.slice(0, 5)) {
      const v = pl.values;
      console.log(
        `   proj=${pl.projectId} ${String(v.potenciaInstaladaKwp ?? "-").padStart(6)}kWp ` +
          `${(v.concessionaria ?? "-").slice(0, 12).padEnd(13)} ` +
          `mod=${v.moduloQuantidade ?? "-"}x${v.moduloPotenciaW ?? "-"}W inv=${(v.inversorFabricante ?? "-").slice(0, 14)}`,
      );
    }
    await pool.end();
    return;
  }

  // ── 4. Gravar ──────────────────────────────────────────────────────────────
  let clientesCriados = 0;
  let clientesReusados = 0;
  let vinculos = 0;
  let usinasCriadas = 0;

  await db.transaction(async (tx) => {
    for (const c of planned) {
      // Reaproveita por telefone; senão por nome exato.
      let existing = c.values.phoneNormalized
        ? (await tx.select().from(clientsTable).where(eq(clientsTable.phoneNormalized, c.values.phoneNormalized)).limit(1))[0]
        : undefined;
      if (!existing) {
        existing = (await tx.select().from(clientsTable).where(eq(clientsTable.name, c.values.name)).limit(1))[0];
      }
      let clientId: number;
      if (existing) {
        clientId = existing.id;
        clientesReusados++;
      } else {
        const [row] = await tx.insert(clientsTable).values(c.values).returning({ id: clientsTable.id });
        clientId = row.id;
        clientesCriados++;
      }
      for (const pid of c.projectIds) {
        await tx.update(projectsTable).set({ clientId }).where(eq(projectsTable.id, pid));
        vinculos++;
      }
    }

    for (const pl of plantsPlanned) {
      const exists = (
        await tx.select({ id: plantsTable.id }).from(plantsTable).where(eq(plantsTable.projectId, pl.projectId)).limit(1)
      )[0];
      if (exists) continue;
      const [proj] = await tx
        .select({ clientId: projectsTable.clientId })
        .from(projectsTable)
        .where(eq(projectsTable.id, pl.projectId))
        .limit(1);
      await tx.insert(plantsTable).values({ ...pl.values, clientId: proj?.clientId ?? null });
      usinasCriadas++;
    }
  });

  const [semCliente] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(projectsTable)
    .where(isNull(projectsTable.clientId));

  console.log(`\nCLIENTES criados=${clientesCriados} reusados=${clientesReusados}`);
  console.log(`PROJETOS vinculados=${vinculos} | ainda sem cliente=${semCliente.n}`);
  console.log(`USINAS criadas=${usinasCriadas}\n`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
