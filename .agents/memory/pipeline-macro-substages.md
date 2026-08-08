---
name: Pipeline macro-etapas & sub-etapas
description: How the kanban pipeline model works after the macro/sub-stage restructure
---
- Pipeline stages are macro-etapas only; `projects.sub_stage` holds the current checklist-group slug of that macro. Sub-etapas derive from `CHECKLIST_TEMPLATE[stage]` (mirrored in db schema + frontend internal-api.ts).
- "compras" and "logistica" are no longer stages — supply status is a parallel track derived from `project_purchases` (badge: sem compras / em cotação / X/Y recebidas).
- `projeto_homologacao` merges old projeto_tecnico + homologacao and spans client steps 2–3: `clientStepFor(stage, subStage)` returns 3 when the sub-etapa slug starts with `homologacao_`; `clientStageLabel()` keeps the old notification wording ("Projeto Técnico"/"Homologação").
- Homologation portal scope = pendencias/pausado OR (projeto_homologacao + subStage LIKE 'homologacao\_%'). Technician handoff target is planejamento_execucao and must pass BOTH the homologation gate and `comprasGateError()`.
- **Why:** stage-name string checks scattered in portals broke silently when stages were renamed; always route scope/gates through the shared helpers in `homologacao-gate.ts` and pipeline.ts.
- **How to apply:** when adding stages or sub-etapas, update `lib/db/src/schema/pipeline.ts`, mirror in `artifacts/solo-energia/src/lib/internal-api.ts`, and check portal scope filters + gates.
