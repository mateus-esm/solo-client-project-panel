# Roadmap — Solo Energia: Portal do Cliente + ERP Interno

> Documento compartilhado. Entradas marcadas com `verboo-deepseek:` são do agente Verboo (DeepSeek) — 2026-08-08.
> Entradas de outros agentes/ferramentas devem usar o próprio prefixo.

---

# Product Manager — Claude (Fable 5) — 2026-08-08

## Veredito

A análise do Verboo está **correta nos fatos e errada na prioridade**. Verifiquei os três
bloqueadores no código: o `sub_stage` duplicado era real (`TS1117`, pacote `db` não compilava),
o banco Neon tem as 21 tabelas com **zero linhas de negócio**, e não existe script de importação
(`scripts/src/` só tem `hello.ts`). **O bloqueador de build já está corrigido** — os três pacotes
compilam limpos agora.

Onde eu discordo: *"feature-complete"* é a moldura mais perigosa deste projeto. Em ~2 dias foram
construídos 5 portais, 4 sistemas de auth, 18 arquivos de rota, 23 páginas e 10 módulos de schema,
com **1 único arquivo de teste** (integração, exige banco vivo). O risco real não são os 3
bloqueadores listados — é que **quase nada foi exercitado com dado real**. Construído ≠ funcionando.

O segundo ponto de discordância é o mais importante para hoje:

> **Migrar os 133 projetos hoje é a decisão errada.** 96 deles (72%) estão *Concluído* — não geram
> nenhum trabalho operacional. Importá-los hoje adiciona risco e entrega zero valor. Os projetos que
> a equipe precisa acompanhar são os **37 ativos**.

## A regra que segura o escopo hoje

> **Produção hoje = a equipe de operações para de usar o Jestor para os 37 projetos ativos.**
> Nada mais entra. Nada mais conta.

Corolário que precisa ficar explícito: **o portal do cliente NÃO entra em produção hoje para os
projetos migrados.** O dataset tem 2 e-mails em 133 linhas, e o login do cliente é OTP por e-mail —
sem e-mail não há login. Isso não é um bug a corrigir hoje; é um limite do dado. Portal do cliente
para clientes migrados é assunto da semana que vem, com coleta de e-mails.

## Decisões que eu tomo agora (não adiar)

| Questão em aberto | Decisão | Porquê |
|---|---|---|
| "Revisão" (17 projetos) | → `pendencias` | Significa que algo precisa de atenção. Em `pendencias` fica visível como pendência; em `onboarding` some no meio dos novos. |
| `done` dos checklists | Importar **tudo como `done=false`** | Todos os tokens do Jestor leem `:0`. Marcar `done=true` em concluídos fabricaria `doneBy`/`doneAt` — auditoria falsa é pior que auditoria vazia. |
| Checklists de projetos concluídos | **Não importar** | São arquivo morto. Zero valor operacional, 100% do risco. |
| E-mail placeholder | `<slug>@sem-email.invalid` | `.invalid` é reservado por RFC e **não roteia**. O domínio `@import.soloenergia.com.br` sugerido é real — o botão "convidar cliente" do admin dispararia e-mail de verdade para endereço inventado. |
| Ordem da importação | **37 ativos hoje; 96 concluídos no dia 2** | Valor operacional hoje, arquivo histórico depois. |

## Plano de hoje

Blocos em ordem. Cada um tem critério de pronto — se um bloco estoura, o seguinte não começa.

**Bloco 0 — Destravar (feito).** `sub_stage` duplicado removido; `lib/db`, `api-server` e frontend
compilam limpos. ✅

**Bloco 1 — Deploy do que existe (~30 min).** `git pull` → `pnpm install` → `pnpm --filter
@workspace/db run push` (o schema do banco já está atualizado, deve ser no-op) → publicar.
*Pronto quando:* `/interno/pipeline` abre em produção com o login admin.

**Bloco 2 — Smoke test com dado real (~45 min). O bloco de maior valor do dia.** Criar 1 projeto
manualmente e percorrer os 3 caminhos que a equipe vai usar amanhã de manhã: mover etapa no pipeline,
criar e editar um serviço, abrir um processo de homologação. *Pronto quando:* os 3 caminhos funcionam
sem erro de runtime. **Todo bug encontrado aqui vale mais que qualquer feature nova hoje.**

**Bloco 3 — Importador dos 37 ativos (~2 h). Depende de você me mandar o xlsx.** Script
transacional, com `--dry-run` obrigatório antes, e idempotente (dedupe por `client_name` +
`created_at`, já que o xlsx não traz o ID do Jestor). *Pronto quando:* dry-run bate 37 linhas,
importação roda em transação e o pipeline mostra os 37 projetos nas etapas certas.

**Bloco 4 — Equipe entra (~30 min).** Senha do admin distribuída, 15 minutos de walkthrough com quem
vai usar. *Pronto quando:* uma pessoa da operação move um projeto real sozinha.

O rollback é trivial e vale dizer em voz alta: o banco está vazio, o dump está salvo, e a importação
roda em transação. Pior caso = `TRUNCATE` e reimportar.

## O que NÃO fazer hoje

Lista explícita, porque o modo de falhar deste projeto é continuar construindo:

- Importar os 96 projetos concluídos.
- Qualquer coisa no portal do cliente para projetos migrados (impossível — sem e-mails).
- Polir Financeiro, Fornecedores, Equipes.
- Unificar os 4 sistemas de auth.
- Deduplicar os templates de checklist entre `lib/db/src/schema/pipeline.ts` e
  `artifacts/solo-energia/src/lib/internal-api.ts`.
- Apagar o schema morto (`conversations.ts` / `messages.ts`).
- Qualquer portal novo.

Tudo aí é legítimo. Nada aí impede a operação de trabalhar amanhã.

## Dia 2 em diante

1. **Dia 2:** importar os 96 concluídos como arquivo histórico; corrigir o que o smoke test achar.
2. **Dia 3:** campanha de coleta de e-mails dos clientes ativos → liga o portal do cliente para os migrados.
3. **Semana 2:** deduplicar templates de checklist servindo por API (o drift entre banco e frontend é
   real e vai morder); remover schema morto; teste de fumaça automatizado por portal.
4. **Semana 3+:** unificar auth (4 sistemas é passivo de manutenção, não feature) e decidir o
   `jestor_id` — enquanto for NULL nos importados, o webhook do Jestor não casa com esses registros.

## Riscos que eu estou observando

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Erros de runtime nos 5 portais não exercitados | **Alta** | Bloco 2 antes de qualquer importação |
| Importação com dado sujo (`'-'`, datas como texto, 61 valores faltando) | Alta | `--dry-run` obrigatório + transação |
| `jestor_id` NULL nos importados quebra o webhook depois | Média | Aceito hoje; resolver na semana 3 |
| Drift entre template de checklist no banco e no frontend | Média | Semana 2 |
| Envio acidental de e-mail para endereço inventado | Baixa (com `.invalid`) | Domínio não roteável por RFC |

## Bloco 3 — importador pronto (atualizado 2026-08-08)

Recebi a planilha e o importador está escrito e validado em dry-run. Duas correções ao estudo do
Verboo saíram da leitura do dado real:

**1. Os checklists NÃO estão todos zerados.** O estudo afirma *"Todos os tokens lêem `:0`"*. O dado
real é **3.430 tokens `:1` (feito) contra 1.377 `:0`** — 71% do trabalho já está marcado como
concluído no Jestor. A decisão que eu tinha tomado com base nessa premissa (*importar tudo como
`done=false`*) estava errada e **foi revertida**: o importador traz o estado real de cada item.
Descartar isso faria a equipe remarcar 3.430 itens à mão. Dos 37 projetos ativos, **32 têm
checklist preenchido** — um deles com 182/182 itens feitos.

**2. Não existe nenhum e-mail de cliente na planilha.** O estudo fala em "só 2 no dataset". Na
verdade são 31 células com `@`, e **todas** são o `Responsável Técnico` interno
(`fgmssolar@gmail.com`). Zero e-mails de cliente. Isso confirma o endereço gerado em `.invalid`
como obrigatório, não como preferência — e reforça que o portal do cliente não entra hoje.

Detalhe de normalização que vale registrar: o Excel escapa os vazios como `'-` (apóstrofo + hífen),
não `-`. O normalizador remove o apóstrofo antes de comparar.

**Resultado do dry-run (`--dry-run`, nada gravado):**

| | Ativos (padrão) | Todos (`--all`) |
|---|---|---|
| Projetos | 37 | 133 |
| Itens de checklist | 3.289 (1.988 feitos) | 4.807 (3.430 feitos) |
| Falhas | 0 | 0 |
| Avisos | 1 | 1 |

Distribuição dos 37 ativos: `onboarding` 8, `projeto_homologacao` 6, `planejamento_execucao` 2,
`ativacao` 3, `pendencias` 17, `pausado` 1. Bate exatamente com o Jestor.

Verifiquei também que os **39 mapeamentos de coluna apontam para slugs que existem de fato** no
`CHECKLIST_TEMPLATE` — um slug órfão faria o item ser gravado e nunca aparecer na tela.

**Como rodar (no Replit, onde o `DATABASE_URL` existe):**

```bash
python scripts/xlsx-to-json.py <planilha.xlsx> /tmp/jestor.json
pnpm --filter @workspace/scripts run import:jestor -- /tmp/jestor.json --dry-run   # confere
pnpm --filter @workspace/scripts run import:jestor -- /tmp/jestor.json             # importa
```

O `--dry-run` não abre conexão com o banco. A importação real roda em transação e é idempotente
(dedupe por `client_name`), então rodar de novo não duplica. Para os 96 concluídos, no dia 2:
acrescente `--all`.

Decisões que o dado mudou, consolidadas:

- **Checklists:** importar o estado real (`:1`→feito, `:0`→pendente). `doneBy` = `"importado do
  Jestor"`, `doneAt` = `null` — o Jestor não exporta quem nem quando, e data inventada é pior que
  data ausente.
- **"Revisão" → `pendencias`** (mantido). Como `pendencias` não tem sub-etapas, a `Etapa` original
  do Jestor vai para `notes` como `[Jestor] Etapa: ...`, para a equipe não perder onde o projeto
  parou. Os itens de checklist continuam nas etapas originais e seguem visíveis pelas abas.
- **Colunas "Compras e Logística"** (etapa aposentada) → `planejamento_execucao / Logística de
  Materiais`, onde a informação continua fazendo sentido.

Falta apenas rodar no Replit. Blocos 1 e 2 continuam sem dependência.

---

## verboo-deepseek: Análise do estado atual — 2026-08-08

### Veredito

**Feature-complete, mas NÃO pronto para produção.** Todos os portais estão construídos e roteados
(portal do cliente, admin, ERP interno/kanban, portal do instalador, portal de homologação — ~40 grupos
de rotas, 4 sistemas de auth). Porém existem 3 bloqueadores:

| # | Problema | Local | Impacto |
|---|----------|-------|---------|
| 1 | Coluna `sub_stage` **duplicada** no schema | `lib/db/src/schema/projects.ts:54` e `:59` | **Build quebrado agora** — `tsc` falha com `TS1117` ("multiple properties with the same name"). O pacote db não compila. |
| 2 | **Banco vazio** | dump 2026-08-08 | 21 tabelas, 0 linhas de negócio. É o que a migração vai resolver. |
| 3 | **Sem ferramenta de importação** | `scripts/` só tem placeholder | Nada carrega os 133 projetos do Jestor. |

Issues menores: `conversations.ts`/`messages.ts` são schema morto (não exportados, não criados no banco);
templates de checklist **duplicados** entre `lib/db/src/schema/pipeline.ts` e
`artifacts/solo-energia/src/lib/internal-api.ts` (risco de drift); `roadmap.md` estava vazio.

**Ponto forte:** entry point para novos negócios JÁ EXISTE — `POST /api/internal/projects`
(`artifacts/api-server/src/routes/internal/projects.ts:118`) com UI em `pages/admin/new-project.tsx`,
além do webhook Jestor (`POST /api/webhooks/jestor/project`) e do client Jestor (`lib/jestor.ts`,
tabela `mjx3lkndn84a5hhtx94s4`).

### O que está construído (funciona)

- **Client portal** (`artifacts/solo-energia`, React+Vite+Tailwind+shadcn): login OTP, dashboard com
  stepper 1–7, documentos, financeiro, notificações, agendamento, chat IA (SSE).
- **Admin**: CRUD de projetos/documentos/pagamentos, convite por e-mail, broadcast.
- **ERP interno** (`/interno`): kanban por macro-etapa, detalhe do projeto, checklists tipados
  (check/form/service/client_notify), serviços + escalação de equipe, homologação, instaladores,
  fornecedores/compras (`project_purchases`), financeiro.
- **Portal do instalador**: serviços, contratos, equipe, financeiro (allow-list — sem custos internos).
- **Portal de homologação**: dashboard, kanban, processos, ART/NF, financeiro.
- **Auth**: admin (senha compartilhada), cliente (OTP e-mail), instalador (email+senha), homologação (email+senha).

### Dados do Jestor (o que vamos migrar)

**133 projetos, 73 colunas, criados 2025-06 → 2026-08.**

- Status: **96 Concluído, 17 Revisão, 8 Onboarding, 5 Projeto Técnico, 3 Ativação, 2 Planejamento de
  Execução, 1 Homologação, 1 Pausado**.
- Valor do Projeto: 72 preenchidos — R$ 1,18M total, média R$ 16,4k (números limpos).
- Forma de Pagamento: 56 preenchidos — À vista 34, Cartão 16, Financiamento 6.
- Tipo: 58 — Usina 41, O&M 14, Equipamento 2, Carregamento Veicular 1.
- Capex/Receita Bruta: 8 preenchidos (esparso).
- Checklists por etapa: 44/133 linhas têm conteúdo — 4.807 tokens `Tarefa:0|Tarefa:0`.
- Cliente/Usina/Resp. Técnico: maioria `'-'` → normalizar para NULL.
- **E-mails: só 2 no dataset inteiro** → constraint `client_email NOT NULL` exige e-mail gerado.

**Restrições críticas da migração:**
- `client_name` e `client_email` são `NOT NULL` → gerar e-mail placeholder (ex.: `bruna@import.soloenergia.com.br`).
- O xlsx **não tem ID do registro no Jestor** → `jestor_id` fica NULL; dedupe por `Nome + Created at`.
- `'-'` → NULL.
- **"Revisão" (17 linhas)** não tem equivalente direto de macro-etapa → decidir: `pendencias` ou `onboarding`.

---

## verboo-deepseek: Plano de migração (ação única)

```
xlsx → script (Node/Python) → Postgres (Neon), em transação, com --dry-run antes
```

**Mapeamento de campos** (coluna Jestor → coluna `projects`):
- `Nome` → `client_name` (fallback: `Negociação`)
- `Status do Projeto` → `status_projeto` + `stage` (mapeado) + `status_step` (1–7) + `completion_percent` (curva da etapa)
- `Valor do Projeto` → `valor_projeto`; `Capex` → `capex`; `Receita Bruta` → `receita_bruta`
- `Forma de Pagamento` → `forma_de_pagamento` + `payment_plan_type` (À vista→avista, Cartão→cartao, Financiamento→parcelado_solo)
- `Potência (kWp)` → `system_power`; `Observações` → `notes`; `Observações Gerais` → `observacoes_gerais`
- Datas → colunas `data_*` (são `text` no schema — sem conversão)
- Sem e-mail → placeholder gerado

**Mapeamento de status → macro-etapa** (9 etapas em `lib/db/src/schema/pipeline.ts:6`):

| Status Jestor | Stage no banco |
|---|---|
| Onboarding | `onboarding` |
| Projeto Técnico | `projeto_homologacao` |
| Homologação | `projeto_homologacao` (subStage `homologacao_*`) |
| Planejamento de Execução | `planejamento_execucao` |
| Ativação | `ativacao` |
| Concluído | `concluido` |
| Pausado | `pausado` |
| **Revisão** | **→ `pendencias`? (decisão pendente)** |

**Checklists:** as 39 colunas de etapa → linhas em `project_checklist_items` (`stage`, `checklist_slug`
de `CHECKLIST_TEMPLATE`, `label` do token, `done` = status do token). Todos os tokens lêem `:0` →
decisão: importar como `done=false`, ou marcar `done=true` quando o projeto é Concluído.

**O&M / Equipamento:** `Tipo` = O&M pode virar `service` vinculado (contrato de manutenção).
Coluna `Serviços` tem só 1 valor real → maioria é projeto puro.

---

## verboo-deepseek: Entry point para novos negócios fechados

Já existem **dois**, porém admin-only:
1. **Manual:** `POST /api/internal/projects` + tela "Novo Projeto" — cria projeto, cai em `onboarding`.
2. **Automático:** webhook `POST /api/webhooks/jestor/project` + `lib/jestor.ts` — precisa de
   `JESTOR_API_TOKEN` + `JESTOR_COMPANY_SLUG` configurados e URL registrada no Jestor.

Se quiser um formulário **"Novo Negócio Fechado"** (nome do cliente, valor, forma de pagamento →
cria projeto + checklist de onboarding automaticamente), é uma adição pequena na página do pipeline interno.

---

## verboo-deepseek: Próximos passos (em ordem)

1. **Corrigir a duplicata de `sub_stage`** (`projects.ts:54/59`) — destrava o build. Correção de 2 minutos.
2. **Escrever o script de importação** — xlsx → Postgres, dry-run primeiro, depois carregar os 133 projetos no Neon.
3. **Re-gerar o dump** do banco para refletir os dados importados.
4. **Decidir** o mapeamento de "Revisão" e a regra de `done` dos checklists.
5. **Confirmar** o entry point desejado para novos negócios (form admin existente vs. webhook vs. form rápido novo).

---

## verboo-deepseek: Sugestões adicionais

- **Corrigir drift de checklist**: servir os templates por API (endpoint) em vez de duplicar entre db e frontend.
- **Remover schema morto**: `conversations.ts`/`messages.ts` não exportados — apagar ou migrar.
- **Adicionar índice/constraint de dedupe**: chave única derivada (`client_name`, `created_at`) para
  a migração ser idempotente em re-execução.
- **Rodar `pnpm run build` de ponta a ponta** depois do fix do `sub_stage` — o monorepo faz typecheck +
  build recursivo; o peer dep de `integrations-openai-ai-react` (react >=18 sem build script) é risco
  de instalação.
- **Snapshot de segurança**: dump do banco vazio já salvo (`db-dump-2026-08-08 (Verboo Code).sql`) —
  refazer após a importação.
