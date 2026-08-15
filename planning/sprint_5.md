# Sprint 5 — Handoff Vendas → Operação — implementado 2026-08-14

O negócio ganho no pipeline comercial vira **cliente + projeto + usina** no ERP, sem ninguém
redigitar nada. Fecha o contrato nº 1 do `arquitetura-integracao.md`.

## A URL para configurar no pipeline de vendas

```
POST https://<dominio-do-erp>/api/webhooks/sales/deal-won
```

Autenticação — qualquer uma das duas, o valor é o `SALES_WEBHOOK_SECRET`:

| Forma | Quando usar |
|---|---|
| Header `x-webhook-secret: <segredo>` | preferível |
| Query `?token=<segredo>` | quando a automação não deixa configurar header |

## O payload: não precisa montar nada

A decisão que economiza manutenção: **o corpo nativo do Jestor é aceito como está**. Não há
template com `{{tokens}}` para manter em sincronia — campo novo na oportunidade aparece aqui sem
mexer no Jestor.

São aceitos três formatos, porque os três aparecem na prática:

```
{ "event": "deal_won", "data": { ... } }        ← Jestor direto
[ { "body": { "event": "deal_won", ... } } ]    ← repassado pelo n8n
{ "body": { "event": "deal_won", ... } }        ← nó de teste
```

Evento diferente de `deal_won` devolve `200 {ignored: true}` — assunto alheio não é erro, e 200
evita o Jestor reenviar para sempre o que nunca vamos processar.

## O que é lido do payload

| Destino no ERP | Origem, em ordem de confiança |
|---|---|
| chave de idempotência | `data.id_<tabela>` (nome dinâmico, resolvido por prefixo) |
| nome do cliente | `oportunidade.nome_do_cliente` → `contato` → `name` → `lead.name` |
| e-mail | `email` → `lead.email` |
| telefone | `telefone` → `lead.telefone` |
| CPF/CNPJ | `oportunidade.cpfcnpj` |
| canal de captação | `lead.canal_de_captacao` → `fonte` |
| **indicação** | `lead.quem_esta_indicando` + `lead.seu_telefone` |
| valor do projeto | `valor_da_oportunidade` → `oportunidade.preco_total_do_sistema_r` |
| forma de pagamento | `oportunidade.condicoes_de_pagamento` |
| comissão | `comissao_esperada`, `comissao_fixa` |
| links | `link_da_proposta` → `oportunidade.link_do_pdf`; `link_do_contrato` |
| consultor | `oportunidade.*_do_consultor` → `responsavel.*` |
| usina | `oportunidade`: endereço, concessionária, consumo, módulo, inversor, estrutura, monitoramento |
| potência (kWp) | **derivada**: `potencia_do_modulo_w × numero_de_modulos ÷ 1000` |

As cadeias de fallback não são zelo teórico: no corpo real capturado, `email` vinha `""` e o
e-mail bom estava em `lead.email`; a `oportunidade` inteira vinha nula.

**Descartado de propósito:** `estagio`, `probabilidade_de_fechamento`, `status_da_proposta`
(o evento já é "ganho"), `subtotal_de_produtos/servicos` (a operação usa custo real de compras e
serviços), `criado_por`/`atualizado_por`/`triggered_by`/`entity_logged_user` (ruído de auditoria do
CRM), `lead.empresa`/`cargo`/`status` (o lead morre no fechamento — só `id_soloapp` sobrevive,
porque é ponte para o SoloApp).

## Comportamento

**Idempotente.** `projects.sales_deal_id` é único. Reenvio devolve `200` com o mesmo `project_id`,
sem criar nada. Recusar com 409 encheria o log do Jestor de falha para um comportamento normal.

**Silencioso para o cliente.** Quem recebe WhatsApp é a equipe (`SOLO_TEAM_PHONE`), com resumo e
link do projeto. Um "ganho!" clicado por engano não pode virar mensagem no WhatsApp do cliente —
boas-vindas e grupo continuam sendo itens-ação do onboarding.

**Não duplica cliente.** Busca por telefone normalizado, depois por CPF/CNPJ. Achou, vincula mais
um projeto e **completa só os campos vazios** — o que a equipe já corrigiu no ERP vale mais que o
que vem do CRM.

**Não cria usina fantasma.** A usina só nasce quando há ficha técnica. Negócio ganho sem proposta
vinculada abre projeto e nenhuma linha vazia em `plants`.

**Guarda a origem.** O corpo cru fica em `projects.sales_payload` (jsonb): dá para auditar de onde
veio cada campo e reprocessar sem pedir reenvio ao comercial.

## Gestão de indicações

`lead.quem_esta_indicando` vira `projects.indicado_por` / `indicado_por_telefone`.

- `GET /api/internal/indicacoes` agrupa por telefone normalizado (a mesma pessoa é escrita de
  formas diferentes entre um card e outro; agrupar por nome espalharia a indicação em várias linhas)
  e devolve, por indicador, os negócios e o valor total.
- Tela `/interno/indicacoes`: lista ordenada por valor indicado, expandindo para os projetos.

## O que mudou no código

| Arquivo | O quê |
|---|---|
| `lib/db/migrations/017_handoff_vendas.sql` | colunas novas em `projects` + índices |
| `lib/db/src/schema/projects.ts` | `salesDealId`, `salesPayload`, consultor, links, comissão, indicação |
| `artifacts/api-server/src/lib/sales-payload.ts` | leitura pura do payload (normalização e fallbacks) |
| `artifacts/api-server/src/lib/__tests__/sales-payload.test.ts` | 35 testes, com o corpo real de produção |
| `artifacts/api-server/src/routes/sales.ts` | a rota + `GET /internal/indicacoes` |
| `artifacts/solo-energia/src/pages/interno/indicacoes.tsx` | tela de indicações |

## Deploy

1. `pnpm --filter @workspace/db migrate` (ou `push-force`) — aplica a migração 017.
2. Definir `SALES_WEBHOOK_SECRET` nos Secrets.
3. Configurar a URL no Jestor e disparar um negócio de teste.

## Pontos em aberto

- **Cidade e UF** não existem em lugar nenhum do payload. `projects.city`/`state` nascem vazios e a
  equipe preenche no ERP. Se o pipeline ganhar esses campos, entram na leitura em duas linhas.
- **Cliente sem e-mail** recebe `venda-<dealId>@sem-email.invalid`, mantendo a convenção atual da
  base. É o que a Onda 2.4 do `sprint_4.md` quer aposentar — quando houver a marca "sem acesso ao
  portal", este é um dos pontos a trocar.
- **Parcelas** não são derivadas de `condicoes_de_pagamento`: é texto livre ("Entrada 30% + 12x no
  boleto") e parsear parcela daí é convite a erro. O texto vai para `forma_de_pagamento` e a equipe
  lança as parcelas.
