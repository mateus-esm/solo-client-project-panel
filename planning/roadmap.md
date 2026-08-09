# Roadmap — Solo Energia: Portal do Cliente + ERP Interno

> Documento compartilhado. Entradas marcadas com `verboo-deepseek:` são do agente Verboo (DeepSeek) — 2026-08-08.
> Entradas de outros agentes/ferramentas devem usar o próprio prefixo.

---

# PLANO ATUAL — Sprints até o SoloPro v1 — Claude (Fable 5), 2026-08-09

> Este é o plano vigente. As seções abaixo são histórico das decisões que levaram até aqui.
> Arquitetura dos 3 sistemas: `planning/arquitetura-integracao.md`.

## Onde estamos

37 projetos ativos já rodando no banco, R$ 730.657 em carteira, 3.289 itens de checklist.
Falta: **clients**, **plants** e **estoque** — e corrigir o modelo de checklist.

## A correção mais importante: checklist é tarefa, não caixinha

Você apontou dois erros, e os dois são meus:

**1. Os checklists ficaram diferentes por projeto.** Isso veio do import: eu trouxe os 3.289 tokens do
Jestor com os rótulos que cada projeto tinha lá. O resultado é que cada card tem uma lista diferente —
exatamente o que não pode acontecer. O checklist **é do processo**, não do projeto.

**2. Marcar uma caixinha não é executar a tarefa.** A caixinha é uma declaração de que alguém fez
algo; a tarefa é o algo. Enquanto for caixinha, o sistema não sabe se a homologação tem técnico —
sabe apenas que alguém disse que sim.

**A visão certa:** cada sub-etapa tem um checklist **padronizado**, e cada item é uma **ação real**.
O item "Atribuir técnico de homologação" não é marcado — ele é **cumprido quando o técnico é
atribuído**. O checklist vira um **atalho para a ação**, e a conclusão é consequência do trabalho
feito, não uma marcação manual.

Isso muda o significado do sistema. O checklist deixa de ser lista de lembretes e vira o **motor do
processo**: quando todos os itens da sub-etapa estão cumpridos, o card é liberado para avançar.
E como cada item passa a ser um dado verificável (tem técnico? tem documento? tem serviço criado?),
o sistema pode avançar sozinho — é o que destrava o low-touch mais adiante.

O primitivo já existe: `project_checklist_items.kind` já é `check | form | service | client_notify`.
Falta ampliar os tipos de ação e ligar cada um ao dado que o satisfaz.

**Exemplos de itens-ação por tipo:**

| Ação | O que satisfaz o item |
|---|---|
| Atribuir técnico de homologação | `projects.homologacao_technician_id` preenchido |
| Anexar conta de luz do cliente | documento da categoria recebido |
| Registrar protocolo na concessionária | `homologacao_processos.numero_solicitacao` preenchido |
| Criar serviço de instalação | serviço vinculado criado |
| Agendar com o cliente | agendamento com data confirmada |
| Registrar compra de material | compra vinculada ao projeto |
| Cadastrar dados da usina | ficha da usina completa |
| Liberar acesso do monitoramento | credenciais da usina preenchidas |

**O que fazer com os 3.289 itens importados:** não apagar (são 1.988 marcados como feitos, é
histórico real do Jestor), mas também não deixar competindo com o padrão. Ficam marcados como
`origem = 'jestor'` e aparecem numa seção recolhida de histórico. O checklist padrão é semeado por
cima e passa a ser o que vale. A posição real do projeto já está no `stage`/`sub_stage`.

---

## Como o cliente é identificado (decisão)

CPF/CNPJ fica para depois — vem do formulário que o cliente preenche ou do contrato assinado.
Para agora, a chave é **telefone**, com nome como alternativa.

Ordem de confiança, e o motivo de cada uma:

1. **Telefone (WhatsApp)** — chave principal. É por onde a operação já fala com o cliente, é único
   na prática e muda pouco. Guardado normalizado (só dígitos, com DDI/DDD) para `(85) 9 8888-7777`,
   `85988887777` e `+5585988887777` serem o mesmo cliente.
2. **E-mail** — chave secundária. Fraca hoje: os 37 ativos têm e-mail fictício `@sem-email.invalid`.
3. **Nome normalizado** — só para casar planilha, sempre com revisão manual. Nome repete
   (2 "Flávio", 2 "Ednaldo") e varia entre as bases ("Ana" no Jestor, nome completo na proposta).
4. **CPF/CNPJ** — entra depois, e quando entrar vira a chave definitiva.

**Regra de não-duplicar:** telefone normalizado é único quando existe. Negócio novo com telefone já
cadastrado **não cria cliente** — vincula mais um projeto/serviço ao cliente existente. Sem telefone,
casa por nome e marca para revisão em vez de duplicar silenciosamente.

> **Fato que muda a Sprint 1:** telefone de cliente **não existe em nenhuma das três planilhas**.
> A proposta traz `Telefone do Consultor` e `Email do Consultor` — são do consultor, não do cliente.
> CPF/CNPJ aparece em 2 de 248. Ou seja: a tabela `clients` nasce agora com **nome e endereço**, e a
> chave telefone só passa a existir de fato quando a **base de leads** chegar. Por isso o campo é
> nulo-permitido desde o começo, e a Sprint 2 é o que dá identidade real ao cliente.

## Sprint 1 — v1 utilizável com dado real (hoje → amanhã)

Objetivo: abrir o SoloPro amanhã e ver **cliente, projeto e usina** ligados, com o que existe hoje.

**1.1 `clients`** — nome, `phone_normalized` (único quando presente, aceita nulo), telefone como
digitado, e-mail, CPF/CNPJ (nulo por enquanto), endereço, origem (`jestor` | `proposta` | `lead` |
`manual`), observações. Mais `projects.client_id`.

Um cliente tem N projetos e serviços. Backfill: 1 cliente por projeto dos 37 ativos, casando os
homônimos por nome normalizado — dos 133 do Jestor, 13 clientes têm 2 projetos, então esses viram
**um** cliente com dois projetos, não dois clientes.

Corrige de quebra o bug do login: hoje `auth.ts` usa `.limit(1)` e o cliente com 2 projetos só
enxerga um deles.

**1.2 `plants` (usinas)** — 1 por projeto entregue: potência instalada, concessionária, geração
estimada, área, data de ativação, link de monitoramento, drive, e a ficha de equipamentos
(módulo: fabricante/potência/quantidade; inversor: fabricante/potência/quantidade). É o registro que
depois alimenta `Plant` + `Inverter` no SoloApp.

**1.3 `estoque`** — itens com saldo e custo. Começa vazia; a equipe cadastra. A ligação com a lista
de materiais do serviço vem na Sprint 3.

**1.4 Backfill com as planilhas** — sem inventar dado:

| Fonte | O que entra | Cobertura |
|---|---|---|
| Propostas (248 linhas) | endereço de instalação, concessionária, módulos, inversor, tipo de monitoramento, consumo médio | **24 dos 37** ativos casam por nome (18 exato, 4 prefixo, 2 aproximado) |
| Usinas Jestor (97 linhas) | potência instalada, geração estimada, receita estimada, data de ativação, link de monitoramento, drive | complementa os concluídos e parte dos ativos |
| Projetos (já importado) | cliente, valor, etapa, checklist | 37/37 |

**Regra de duplicidade nas propostas:** 27 clientes têm mais de uma proposta. Vale a que tem
**Oportunidade** preenchida — isso resolve 24 dos 27. Os 3 restantes ficam para revisão manual.

**O que a planilha de propostas NÃO resolve:** contato do cliente. `Email do Consultor` e
`Telefone do Consultor` são do consultor. 13 dos 37 ativos não têm proposta nenhuma (a maioria O&M e
projetos antigos) — ficam para preenchimento manual.

**Pronto quando:** abrir um card e ver cliente, endereço, concessionária e ficha da usina, com o
cliente aparecendo uma vez só mesmo tendo dois projetos.

## Sprint 2 — identidade real do cliente + checklist como tarefa

A base de leads chegou e resolve a identidade. **1.145 leads, telefone em 1.123 (98%), e-mail em
708 (62%), 1.031 telefones distintos.**

Casamento medido contra os 37 ativos:

| | |
|---|---|
| Casam por nome exato, com telefone | 29 |
| Casam por prefixo de nome, com telefone | 3 |
| Casam mas o lead está sem telefone | 3 |
| Não casam com nenhum lead | 2 |
| **Ganham telefone real** | **32 / 37** |

Sem telefone ficam: Ricardo Mendes, Lanna, Chanderliê, Kepler Pascoal, Flávio SSPDS — preenchimento
manual, são cinco.

- Import dos leads → preenche `phone_normalized` e e-mail nos `clients` da Sprint 1. A partir daí o
  telefone é a chave de verdade. Ambíguos vão para fila de revisão manual em vez de casar sozinhos.
- Com telefone e e-mail reais, o portal do cliente funciona e o `@sem-email.invalid` morre.
- A planilha traz também `Canal de captação`, `Perfil`, `Tomador de decisão` e `id_soloapp` — o
  `id_soloapp` já é um ponteiro pronto para o SoloApp, mesmo que só 2 estejam preenchidos hoje.
- Checklist padronizado por sub-etapa, itens como ação (tabela acima), Jestor vira histórico recolhido.
- Card só avança quando os itens da sub-etapa estão cumpridos.

## Sprint 3 — resultado real do projeto, estoque e documentos

### O modelo financeiro: estimativa ≠ resultado

A oportunidade traz **preço estimado**. O projeto tem que responder outra pergunta: **quanto dinheiro
sobrou de verdade.** São coisas diferentes e não podem viver no mesmo campo — por isso
`valor_projeto` continua sendo o contratado, e o resultado real vem de um razão de lançamentos.

**`project_ledger`** — um lançamento por linha: `tipo` (entrada | saída), `categoria`, `descrição`,
`valor`, `data_prevista`, `data_realizada`, `status` (previsto | realizado), `origem`
(manual | pagamento | compra | serviço).

Categorias, exatamente como você descreveu a operação:

| | Categorias |
|---|---|
| **Entradas** | recebimento do cliente (parcela, entrada, financiamento) |
| **Deduções da receita** | taxa de cartão, comissão paga |
| **Custos do projeto** | capex, instalação, homologação, materiais avulsos, logística, outros serviços |
| **Custos não previstos** | retrabalho/problema, serviço extra exigido no projeto |

Com isso o card mostra quatro números que hoje não existem:

```
Contratado        valor_projeto
Recebido líquido  Σ entradas realizadas − deduções
Custo real        Σ saídas realizadas
Resultado         recebido líquido − custo real
```

E, como cada lançamento tem data prevista e data realizada, o **fluxo de caixa** sai de graça: o que
já entrou, o que falta entrar, o que vence. É esse extrato que vira a entrada do app financeiro
depois — o SoloPro registra, o app financeiro consolida.

**Não é tabela nova do zero.** Boa parte do custo já está no sistema, só espalhada: `payments`
(parcelas do cliente), `project_purchases.valor` (materiais), `services.valor_fechado`,
`custo_logistica`, `outros_custos`, e `projects.homologacao_valor`. O razão **deriva** desses
lançamentos automaticamente e só aceita entrada manual para o que não tem origem — comissão, taxa de
cartão e custo de problema. Assim ninguém digita duas vezes, e o número fecha com a operação.

- Lista de materiais do serviço consumindo do estoque → custo real por projeto, alimentando o razão.
- **Formulário público com token**: cliente preenche e devolve documentos (conta de luz, RG/CPF, docs
  de homologação). Duas consequências: o documento recebido **cumpre o item do checklist** que o
  esperava, e é aqui que **CPF/CNPJ finalmente entra** — passando a ser a chave definitiva, acima do
  telefone, e destravando o casamento com o SoloApp (`Client.cpfCnpj` é único lá).
- Tipo no pipeline (projeto / O&M / monitoramento / carregador EV): mesmo funil, filtro por tipo,
  gate de homologação não se aplica a O&M.

## Sprint 4 — integrações

- Sales Engine → SoloPro: oportunidade ganha vira cliente + projeto (webhook já existe lá).
- SoloPro → SoloApp: usina ativada vira `Plant` + `Inverter` + UCs/rateio.
- SoloApp → SoloPro: ticket vira serviço de O&M.
- Importar os 96 projetos concluídos como arquivo histórico.

## Princípio para todas as sprints

Nada entra sem dado real por trás. Onde o dado não existe, o campo fica vazio e visível como
pendência — não preenchido com suposição. Foi assim que os 37 entraram, e é o que permite confiar
no que está na tela.

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

# Estudo: a plataforma dá conta de gerir os projetos? — Claude (Fable 5), 2026-08-08

Comparação campo a campo entre o que o Jestor realmente guarda (73 colunas, 133 projetos) e o que a
plataforma modela (21 tabelas). **Nada foi migrado** — isto é só análise. Percentuais são de
preenchimento real; quando divergem, o número dos **37 ativos** manda, porque é neles que a equipe
trabalha.

## Veredito

**A plataforma é operacionalmente mais rica que o Jestor.** Ela já tem parcelas, documentos
categorizados com upload, portal do cliente, processo de homologação (UC, protocolo, ART/NF),
suprimentos com fornecedor e rastreio, serviços com contrato e escalação de equipe, portal do
instalador. O Jestor não tem nada disso.

As lacunas não são de funcionalidade — são de **classificação, responsabilidade e identidade do
cliente**. São 6, e as 3 primeiras doem no uso diário.

## Lacuna 1 — Não existe entidade Cliente (e é isto que trava o join com os leads)

Hoje `client_name`, `client_email` e `client_phone` são colunas soltas na tabela `projects`. Não há
tabela de clientes. Nos dados: **99 clientes distintos para 133 projetos — 13 clientes têm 2
projetos** (Agilson, Claudia, Ubiratan, Flávio, Tito, Acelio, Magno, Samia e outros).

Isso já é um bug em produção, não uma questão de arquitetura. Em
`artifacts/api-server/src/lib/auth.ts:132-136`, o login do cliente resolve o projeto assim:

```ts
.where(eq(projectsTable.clientEmail, email.toLowerCase()))
.limit(1);
```

**O cliente com 2 projetos entra e vê só o de menor id.** O outro é invisível, sem aviso e sem
seletor de projeto. Com os dados atuais isso atinge 13 clientes / 26 projetos.

E é exatamente o que vai atrapalhar o que você quer fazer em seguida: sem entidade cliente, o
e-mail e o telefone vindos da base de leads teriam que ser gravados **por projeto** — a mesma pessoa
casada duas vezes, e atualizar um telefone vira atualizar N linhas.

**Correção:** tabela `clients` (nome, email, telefone, documento) + `projects.client_id`. A sessão
passa a ser do cliente, com seletor quando houver mais de um projeto. É a maior das 6, e é
pré-requisito do import de leads.

## Lacuna 2 — Não existe `tipo` de projeto

**91% dos ativos têm `Tipo` preenchido** (Usina 41, O&M 14, Equipamento 2, Carregamento Veicular 1).
A tabela `projects` **não tem esse campo**.

Não é etiqueta: **O&M é outro negócio**. Um contrato de manutenção não passa por Projeto Técnico nem
por Homologação, mas hoje ele é obrigado a percorrer o mesmo funil. São 14 O&M no histórico e 3
ativos. O resultado prático é a equipe marcando etapa falsa ou abandonando o sistema para O&M.

**Correção:** coluna `tipo` + badge no kanban, e os gates de homologação não se aplicam a O&M.
Versão mínima resolve hoje; funil próprio para O&M é conversa de semana 2.

## Lacuna 3 — Não existe responsável pelo projeto

**91% dos ativos têm `Responsável Técnico`** e são só 3 pessoas (`fgmssolar@gmail.com` 30,
`Mateus Sombra` 27, outro 1). A plataforma só tem `homologacao_technician_id`, que vale para
homologação — não há dono do projeto.

Com 37 projetos ativos e equipe crescendo, ninguém consegue responder *"quais são os meus
projetos?"*. Sem isso não há cobrança nem accountability.

**Correção:** `projects.responsavel` + filtro "meus projetos" no kanban. Pequeno.

## Lacuna 4 — Datas de marco e tempo de ciclo

O Jestor guarda `Data de homologação`, `Data de instalação`, `Data de ativação` e `Data de conclusão
do projeto`. A plataforma tem fechamento, pagamento, compras e entrega — **as 4 acima não existem**.

Sem elas não dá para responder a pergunta operacional mais importante de uma integradora:
**quanto tempo leva do fechamento à ativação, e onde o projeto trava?**

**Correção recomendada — e aqui eu não copiaria o Jestor:** em vez de 4 campos digitados à mão, uma
tabela `project_stage_history` (project_id, stage, sub_stage, entrou_em, por_quem). O PATCH de etapa
já existe e é o único caminho de mudança; gravar uma linha ali dá tempo de ciclo por etapa, gargalo e
auditoria **de graça**, sem ninguém preencher data. Campo digitado não é preenchido — a prova está
no próprio Jestor: `Data de ativação` tem 10% e `Data de Início Prevista` 6%.

## Lacuna 5 — Potência zerada, mas recuperável

`Potência (kWp)` está preenchida em **0% dos ativos**. Só que a potência está escrita dentro do campo
`Usina`: **96 das 97 usinas** seguem o padrão `"José Brasil - 7.4 kWp"`. Dá para extrair por regex —
**29 dos 37 ativos** teriam a potência recuperada.

Sem isso o portal do cliente mostra "0 kWp" e não há relatório de capacidade instalada.

**Correção:** extrair no import + tornar o campo obrigatório na tela de novo projeto. Trivial.

## Lacuna 6 — Sem `updated_at` / `updated_by` em `projects`

O Jestor tem os dois a 98%. A plataforma só tem `created_at`. Com 5 portais escrevendo na mesma
linha, não dá para saber o que mudou nem quem mudou. Duas colunas.

## O que o Jestor tem e NÃO vale trazer

Medido, não achismo: `Propriedade` (2% nos ativos), `Condições Comerciais` (5% — e a tabela
`payments` modela parcelamento muito melhor que texto livre), `Observações Gerais` (0%),
`Pipeline de Projetos` (0%), `Serviços` (1 valor em 133 — o módulo de serviços já é superior).

`Usina` como entidade própria eu **adiaria**: hoje é 1 projeto ≈ 1 usina. Ela vira importante quando
O&M e monitoramento crescerem, aí o ativo durável é a usina, não o projeto.

## Preparando o join com a base de leads

Quando você mandar os leads, o problema vai ser **casar por nome**, porque a planilha de projetos não
tem nenhum e-mail de cliente (os 31 `@` são todos do responsável técnico interno). E o nome é sujo:
existem três campos parecidos (`Nome`, `Cliente`, `Negociação`) e valores que não são de pessoa —
`"Polícia Federal - Manutenção Juazeiro"`, `"André Linhares - O&M"`, `"Paulo de Oliveira - EV / O&M"`.

Ordem que eu recomendo:

1. Criar a tabela `clients` **antes** do import de leads (Lacuna 1). Casar lead → cliente uma vez, não
   uma vez por projeto.
2. Casar por nome normalizado (sem acento, minúsculo, sem sufixo de tipo) e **exigir revisão manual
   dos ambíguos** em vez de casar automático. Com 99 clientes, revisar à mão o que ficar duvidoso
   custa minutos e evita mandar e-mail do cliente errado.
3. Só depois ligar o portal do cliente para os migrados — aí sim com e-mail real, e o endereço
   `.invalid` deixa de ser necessário.

## Sequência que eu recomendo

**Antes de migrar qualquer coisa** (as 3 primeiras mudam o schema, e mexer no schema depois de
importar 133 projetos é retrabalho):

1. Tabela `clients` + `projects.client_id` + correção do login com múltiplos projetos — Lacuna 1.
2. `projects.tipo` — Lacuna 2.
3. `projects.responsavel` + `updated_at`/`updated_by` — Lacunas 3 e 6.
4. `project_stage_history` — Lacuna 4.
5. Extração de kWp do campo `Usina` no importador — Lacuna 5.
6. Aí sim: importar os 37 ativos, depois os leads, depois os 96 concluídos.

O importador já escrito continua válido: as lacunas 2, 3 e 5 são colunas novas que ele passa a
preencher, e a 1 muda o destino do cliente. Ajuste pequeno, desde que feito **antes** da carga.

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
