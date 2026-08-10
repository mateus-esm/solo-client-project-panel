# Sprint 3 — Fechar o ciclo: gate, identidade, documentos e dinheiro — Claude (Fable 5), 2026-08-10

**Planejamento apenas. Nada executado.**

Baseado no `roadmap.md` e no que ficou pendente do `sprint_2.md` (Ondas 3 e 4).

## Estado de partida (medido em produção agora)

| | Valor | Leitura |
|---|---|---|
| Projetos | 37 · R$ 730.657 contratados | operação rodando |
| Etapas | pendências 17 · onboarding 7 · projeto/homologação 7 · ativação 3 · pré-execução 2 · pausado 1 | 17 em pendências é o maior bolso |
| Clientes | 37 · **30 com telefone** · 11 com e-mail · **0 com CPF** | identidade pela metade |
| Usinas | 31 · **0 com monitoramento** | ninguém chegou na entrega ainda |
| Checklist | **3.331 `jestor` · 0 `template`** | o padrão ainda não foi semeado em lugar nenhum |
| Financeiro | **0 pagamentos · 0 compras · 1 serviço** | não há dado de dinheiro no sistema |

Dois números acima mudam o plano e merecem destaque.

**O checklist padrão tem zero itens.** A semeadura acontece sob demanda, quando alguém abre a aba da
etapa no projeto. Ou ninguém abriu desde o deploy, ou a semeadura não está rodando em produção.
**Verificar isso é o item 1.1** — sem ele, a Onda 1 inteira não tem o que bloquear.

**Não existe dinheiro registrado no sistema.** Zero pagamentos, zero compras. Um razão que só
*deriva* de `payments` e `project_purchases` mostraria R$ 0,00 em todo projeto. Por isso a Onda 4
nasce com **lançamento manual como caminho principal**, e a derivação automática entra depois, à
medida que a equipe passa a registrar. Construir o contrário seria entregar uma tela vazia.

## Objetivo da sprint

O card não avança sem as ações feitas, o cliente entrega os próprios dados, e cada projeto passa a
mostrar **quanto dinheiro sobrou**.

---

## Onda 1 — Gate de avanço (fecha a Onda 3 da Sprint 2)

**1.1 Verificar a semeadura do checklist padrão em produção.** Abrir um projeto, confirmar que os
itens `template` aparecem, e corrigir se não. Bloqueia tudo o mais desta onda.

**1.2** Marcar no template quais ações são **obrigatórias** por sub-etapa. Nem toda ação bloqueia:
"anexar documentos" trava, "registrar pagamento" provavelmente não.

**1.3** O `PATCH /internal/projects/:id` recusa avanço de sub-etapa com obrigatória pendente,
devolvendo **a lista do que falta** — mesmo padrão do gate de homologação que já existe.

**1.4** No kanban e no detalhe: progresso da sub-etapa ("3 de 5") e, ao tentar avançar bloqueado, a
lista do que está pendente.

**1.5 Isenção de legado.** Os 37 projetos atuais entraram na etapa antes de existirem obrigatórias.
O gate só vale para sub-etapa em que o projeto **entrar depois** desta mudança — senão os 17 em
pendências travam de saída por itens que ninguém tinha como preencher.

**Pronto quando:** não dá para avançar com obrigatória pendente, a mensagem diz qual, e nenhum
projeto atual fica preso.

## Onda 2 — Identidade do cliente (fecha a Onda 4 da Sprint 2)

**2.1** Tela de completar cadastro para os **7 clientes sem telefone**, com sugestão vinda da base de
leads por nome aproximado — sugestão que a pessoa confirma, nunca casamento automático.

**2.2** E-mail está em **11 de 37**. Rodar os leads de novo mirando e-mail (o casamento anterior
priorizou telefone).

**2.3** Corrigir o login do cliente: `lib/auth.ts` resolve o projeto por e-mail com `.limit(1)`, então
cliente com dois projetos vê só um. Passa a resolver **cliente**, com seletor quando houver mais de um.

**2.4** Aposentar o `@sem-email.invalid`: quem não tem e-mail real fica marcado como **"sem acesso ao
portal"**, em vez de carregar um endereço falso que parece válido.

**Pronto quando:** um cliente com dois projetos entra e escolhe qual ver.

## Onda 3 — Formulário público do cliente

A onda que traz **CPF/CNPJ** — a chave definitiva de identidade, a que casa com o SoloApp
(`Client.cpfCnpj` é único lá).

**3.1** Link público com token por projeto/cliente, com validade. Sem login.

**3.2** O cliente preenche seus dados (CPF/CNPJ, endereço, contato) e anexa documentos: conta de luz,
RG/CPF, e o que a homologação exigir. Sobe pelo object storage que já existe.

**3.3** O que chega **cumpre o item-ação** correspondente do checklist — `anexar_documentos_cliente`
fica cumprido sozinho. É aqui que a Onda 1 e a Onda 3 se encontram: o cliente destrava o card sem
ninguém da equipe tocar em nada.

**3.4** Com CPF/CNPJ preenchido, ele passa a ser a chave de deduplicação, acima do telefone.

**Pronto quando:** enviar o link, o cliente preencher, e o item do checklist virar cumprido sozinho.

## Onda 4 — Resultado real do projeto

O que você descreveu: contratado é uma coisa, **dinheiro que sobrou** é outra.

**4.1 `project_ledger`** — um lançamento por linha: `tipo` (entrada | saída), `categoria`,
`descrição`, `valor`, `data_prevista`, `data_realizada`, `status` (previsto | realizado), `origem`
(manual | pagamento | compra | serviço).

Categorias, como você definiu a operação:

| | Categorias |
|---|---|
| **Entradas** | recebimento do cliente (parcela, entrada, financiamento) |
| **Deduções** | taxa de cartão, comissão paga |
| **Custos** | capex, instalação, homologação, materiais, logística, outros serviços |
| **Não previstos** | retrabalho/problema, serviço extra exigido |

**4.2** Quatro números no card:

```
Contratado        valor_projeto
Recebido líquido  Σ entradas realizadas − deduções
Custo real        Σ saídas realizadas
Resultado         recebido líquido − custo real
```

**4.3 Lançamento manual primeiro.** Como não há pagamento nem compra registrada, a equipe lança à
mão. Cada lançamento marca sua `origem`, então quando `payments`/`purchases` passarem a ser usados, a
derivação automática entra **sem duplicar** o que já foi lançado.

**4.4** Fluxo de caixa: previsto × realizado por data. É o extrato que vira a entrada do app
financeiro depois.

**Pronto quando:** um projeto em pendências mostra quanto entrou, quanto saiu e quanto sobrou.

## Onda 5 — Ficha do inversor e monitoramento

Necessária quando os 3 projetos em Ativação chegarem à entrega. Hoje **0 das 31 usinas** têm
monitoramento.

**5.1 `project_inverters`** (1..N por projeto): marca, modelo, quantidade, **nº de série do
inversor**, **nº de série do datalogger**, **código de verificação**, foto da etiqueta, fornecedor.

Os dois seriais são campos separados de propósito — pesquisei as plataformas e é o **datalogger** que
vincula a usina: Growatt pede série do datalogger + check code; Deye pede a série do logger e a
documentação avisa explicitamente que **não** é a do inversor; Sungrow usa o dongle; Huawei pede SN +
código de verificação. Juntar os dois campos é o erro de campo mais comum.

**5.2** Conta de monitoramento na usina: plataforma, login e **senha criptografada** (AES-256-GCM,
chave em Secret do Replit, `crypto` nativo — sem dependência nova). Visível só para admin, nunca no
portal do cliente, nunca em log.

**5.3** Foto da etiqueta/QR pelo object storage — a etiqueta é a fonte da verdade e evita erro de
transcrição de código alfanumérico longo.

**5.4** Isso alimenta `liberar_monitoramento` no checklist e é o payload do SoloApp (`Inverter` lá
espera `provider`, `providerId`, `providerApiKey`, `serialNumber`).

**Pronto quando:** um projeto em Ativação registra inversor e credenciais, e o item do checklist fica
cumprido.

## Onda 6 — Tipo no pipeline

Pequena e incômoda: **14 O&M no histórico, 3 ativos**, todos empurrados pelo funil de instalação
solar. Manutenção não tem Projeto Técnico nem Homologação.

**6.1** `projects.tipo` (projeto | O&M | monitoramento | carregador EV), com badge no kanban e filtro.
**6.2** O gate de homologação não se aplica a O&M.
**6.3** Backfill: o tipo dos 37 já está preservado no campo `notes`, no bloco `[Jestor] Tipo: ...`.

## Fora de escopo (Sprint 4)

- Estoque consumindo a lista de materiais do serviço.
- Integrações Sales Engine → SoloPro → SoloApp.
- Importar os 96 projetos concluídos.
- Mapear ações para as 25 sub-etapas restantes (só 9 das 34 têm dado correspondente hoje).

## Riscos

| Risco | Mitigação |
|---|---|
| Gate trava os 37 projetos legados | isenção da Onda 1.5 — só vale para etapa em que o projeto entrar depois |
| Razão financeiro nasce vazio e é abandonado | lançamento manual primeiro (4.3); derivação só quando houver origem |
| Link público do formulário vazar dado de cliente | token por cliente, com validade e revogável; nunca lista, só o próprio registro |
| Senha de monitoramento em texto | criptografia é requisito da Onda 5, não item opcional |
| Sprint grande demais | ver ordem de corte abaixo |

## Ordem e corte

Ondas **1 e 2 primeiro** — são dívida da Sprint 2 e pequenas. Depois **3**, que destrava CPF e
documentos. Depois **4**, que é o maior valor de negócio.

Se precisar cortar: **5 e 6 saem** sem prejuízo imediato — nenhum projeto chegou à entrega de
monitoramento, e o O&M já convive com o funil errado há meses. Se precisar cortar mais, a **Onda 4
sozinha** é a que a diretoria sente.
