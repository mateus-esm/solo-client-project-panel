import { describe, it, expect, afterAll } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";
import {
  comprasGateErrorFor,
  COMPRAS_GATE_MESSAGE,
  LOGISTICA_GATE_MESSAGE,
} from "../homologacao-gate";
import {
  clientStepFor,
  clientStageLabel,
  isValidSubStage,
  defaultSubStage,
  PIPELINE_STAGES,
  CHECKLIST_TEMPLATE,
} from "@workspace/db/schema";

// ─── Supplies gate: every purchase-status combination ────────────────────────

describe("comprasGateErrorFor", () => {
  it("blocks when there are no purchases", () => {
    expect(comprasGateErrorFor([])).toBe(COMPRAS_GATE_MESSAGE);
  });
  it("blocks when all purchases are still quotes", () => {
    expect(comprasGateErrorFor(["cotacao", "cotacao"])).toBe(COMPRAS_GATE_MESSAGE);
  });
  it("blocks when any effective purchase lacks logistics", () => {
    expect(comprasGateErrorFor(["comprada"])).toBe(LOGISTICA_GATE_MESSAGE);
    expect(comprasGateErrorFor(["recebida", "comprada"])).toBe(LOGISTICA_GATE_MESSAGE);
    expect(comprasGateErrorFor(["logistica_programada", "comprada", "cotacao"])).toBe(
      LOGISTICA_GATE_MESSAGE
    );
  });
  it("passes when every effective purchase has logistics programmed or received", () => {
    expect(comprasGateErrorFor(["logistica_programada"])).toBeNull();
    expect(comprasGateErrorFor(["recebida"])).toBeNull();
    expect(comprasGateErrorFor(["recebida", "logistica_programada", "cotacao"])).toBeNull();
  });
});

// ─── Sub-etapa model: client step + validation ────────────────────────────────

describe("sub-etapa model", () => {
  it("projeto_homologacao spans client steps 2-3 by sub-etapa", () => {
    expect(clientStepFor("projeto_homologacao", "projeto_tecnico_elaboracao")).toBe(2);
    expect(clientStepFor("projeto_homologacao", "homologacao_envio_a_concessionaria")).toBe(3);
    expect(clientStageLabel("projeto_homologacao", "projeto_tecnico_elaboracao")).toBe(
      "Projeto Técnico"
    );
    expect(clientStageLabel("projeto_homologacao", "homologacao_aprovacao_e_registro")).toBe(
      "Homologação"
    );
  });
  it("validates sub-etapas against the macro's checklist groups", () => {
    expect(isValidSubStage("projeto_homologacao", "homologacao_envio_a_concessionaria")).toBe(true);
    expect(isValidSubStage("planejamento_execucao", "homologacao_envio_a_concessionaria")).toBe(
      false
    );
    for (const stage of PIPELINE_STAGES) {
      const def = defaultSubStage(stage);
      if (CHECKLIST_TEMPLATE[stage].length > 0) {
        expect(isValidSubStage(stage, def!)).toBe(true);
      } else {
        expect(def).toBeNull();
      }
    }
  });
});

// ─── Migration 010: legacy compras/logistica remap is gate-aware ─────────────
// Runs the migration SQL inside a rolled-back transaction against the dev DB,
// seeding legacy projects for each gate combination.

const MIGRATION = readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../../lib/db/migrations/010_macro_stages.sql"
  ),
  "utf8"
);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
afterAll(() => pool.end());

describe("migration 010 legacy remap", () => {
  it("maps compras/logistica according to homologation + supplies gates", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const mk = async (stage: string) => {
        const r = await client.query(
          `INSERT INTO projects (client_name, client_email, system_power, city, state, stage)
           VALUES ('t', 't@t.t', 1, 'c', 'SP', $1) RETURNING id`,
          [stage]
        );
        return r.rows[0].id as number;
      };
      const approve = (id: number) =>
        client.query(
          `INSERT INTO project_checklist_items (project_id, stage, checklist_slug, label, done)
           VALUES ($1, 'homologacao', 'homologacao_aprovacao_e_registro', 'ok', true)`,
          [id]
        );
      const supplier = (
        await client.query(
          `INSERT INTO suppliers (name, tipo) VALUES ('t','distribuidor') RETURNING id`
        )
      ).rows[0].id;
      const purchase = (id: number, status: string) =>
        client.query(
          `INSERT INTO project_purchases (project_id, supplier_id, categoria, descricao, status)
           VALUES ($1, $2, 'kit', 't', $3)`,
          [id, supplier, status]
        );

      // A: compras, no approval, no purchases → back to aprovação e registro
      const a = await mk("compras");
      // B: compras, approved, purchases still in cotação → holding (validação)
      const b = await mk("compras");
      await approve(b);
      await purchase(b, "cotacao");
      // C: compras, approved, supplies resolved → planejamento_execucao (recebimento)
      const c = await mk("compras");
      await approve(c);
      await purchase(c, "recebida");
      // D: logistica, approved, supplies resolved → planejamento_execucao (logística)
      const d = await mk("logistica");
      await approve(d);
      await purchase(d, "logistica_programada");
      // E: logistica, approved, but a purchase stuck in "comprada" → holding
      const e = await mk("logistica");
      await approve(e);
      await purchase(e, "comprada");

      await client.query(MIGRATION);

      const rows = (
        await client.query(
          `SELECT id, stage, sub_stage FROM projects WHERE id = ANY($1) ORDER BY id`,
          [[a, b, c, d, e]]
        )
      ).rows;
      const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
      expect(byId[a]).toMatchObject({
        stage: "projeto_homologacao",
        sub_stage: "homologacao_aprovacao_e_registro",
      });
      expect(byId[b]).toMatchObject({
        stage: "projeto_homologacao",
        sub_stage: "homologacao_validacao_de_homologacao",
      });
      expect(byId[c]).toMatchObject({
        stage: "planejamento_execucao",
        sub_stage: "planejamento_de_execucao_recebimento_de_material",
      });
      expect(byId[d]).toMatchObject({
        stage: "planejamento_execucao",
        sub_stage: "planejamento_de_execucao_logistica_de_materiais",
      });
      expect(byId[e]).toMatchObject({
        stage: "projeto_homologacao",
        sub_stage: "homologacao_validacao_de_homologacao",
      });
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  }, 30000);
});
