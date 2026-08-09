# Sprint 2 — Checklist como motor do processo — Claude (Fable 5), 2026-08-09

**Planejamento apenas. Nada executado.**

## O tamanho real do problema (medido em produção)

| Métrica | Valor | Leitura |
|---|---|---|
| Itens de checklist | 3.318 | — |
| **Rótulos distintos** | **378** | deveria ser ~60 (o template padrão) |
| Itens por projeto | de **4 a 217** | o mesmo processo, listas totalmente diferentes |
| `kind = check` | 3.313 | quase tudo é caixinha |
| `kind = form` | 5 | os tipos ricos praticamente não existem |
| Itens marcados feitos | 1.988 | histórico real, não pode ser jogado fora |

Um projeto tem 217 itens em 30 grupos; outro tem 4. **É o mesmo processo.** A causa é conhecida: o
import trouxe os rótulos que cada projeto tinha no Jestor.

## Objetivo

O checklist deixa de ser lista de lembretes e vira o **motor do processo**: padronizado por
sub-etapa, com itens que representam **ações reais**, e que liberam o avanço do card quando cumpridos.

## Onda 1 — Separar histórico de padrão

Sem isto, nada mais funciona: hoje não há como distinguir item do processo de item importado.

**1.1** Coluna `origem` em `project_checklist_items` (`jestor` | `template` | `manual`), migração
versionada em `lib/db/migrations/`. Marcar os 3.289 itens importados como `jestor`.

**1.2** Semear o checklist padrão (`CHECKLIST_ITEM_TEMPLATE`) para a sub-etapa atual de cada um dos
37 projetos. O endpoint de seed já existe e pula grupo que já tem item — precisa passar a ignorar
itens de origem `jestor` nessa checagem, senão nunca semeia.

**1.3** UI: o checklist padrão é o conteúdo principal; os itens do Jestor vão para uma seção
**"Histórico Jestor"** recolhida, somente leitura, com contagem (ex.: "182 itens, 182 concluídos").

**Pronto quando:** dois projetos na mesma sub-etapa mostram exatamente a mesma lista, e o histórico
continua consultável.

## Onda 2 — O item vira ação

O coração da sprint. Marcar caixinha é declarar; a ação é fazer.

**2.1** Ampliar `kind`: `check` (manual, continua existindo para tarefas sem dado) e **`action`**
(cumprido por dado real). O template ganha um campo `condicao`.

**2.2** Vocabulário de condições — cada uma é uma consulta a tabela que **já existe**:

| Condição | Cumprida quando |
|---|---|
| `tecnico_homologacao_atribuido` | `projects.homologacao_technician_id` preenchido |
| `processo_protocolado` | `homologacao_processos.numero_solicitacao` preenchido |
| `documento_recebido:<categoria>` | documento da categoria com arquivo anexado |
| `servico_criado:<tipo>` | serviço do tipo vinculado ao projeto |
| `servico_concluido:<tipo>` | serviço do tipo com status Concluído |
| `compra_registrada` | existe compra no projeto |
| `compra_recebida` | compra com status `recebida` |
| `agendamento_confirmado` | agendamento com data confirmada |
| `usina_cadastrada` | existe `plants` para o projeto |
| `monitoramento_liberado` | `plants.monitoramento_url` preenchido |
| `pagamento_recebido` | parcela com status pago |
| `campo_preenchido:<tabela>.<coluna>` | genérico, para os casos que sobrarem |

**2.3** Resolver no backend: um registry `condicao -> função`, avaliado **por projeto em lote** (uma
consulta por tipo de condição, não uma por item) e devolvido junto do detalhe do projeto.

**Decisão de design:** o cumprimento de item `action` é **derivado, não gravado**. Calculado na
leitura a partir do dado real. Gravar significaria manter dois lugares em sincronia e conviver com
estado velho — se o técnico for desatribuído, o item tem que voltar a pendente sozinho. Item `check`
manual continua com `done` gravado, como hoje.

**2.4** UI: item `action` mostra o **atalho para a ação** ("Atribuir técnico", "Anexar conta de luz",
"Criar serviço de instalação") e um estado cumprido/pendente derivado — sem caixinha clicável. Ao
clicar, leva para o lugar onde a ação acontece, ou abre o diálogo ali mesmo.

**Pronto quando:** atribuir um técnico em Homologação faz o item ficar cumprido sem ninguém marcar
nada, e desatribuir volta a pendente.

## Onda 3 — Gate de avanço

**3.1** Marcar no template quais itens são **obrigatórios** para liberar a sub-etapa (nem todo item é
bloqueante).

**3.2** O avanço de sub-etapa/macro-etapa exige os obrigatórios cumpridos. A resposta de bloqueio diz
**o que falta**, item a item — o padrão que os gates de homologação e compras já usam
(`HOMOLOGACAO_GATE_MESSAGE`).

**3.3** UI: o card mostra progresso da sub-etapa (ex.: "3 de 5") e, ao tentar avançar bloqueado,
lista os itens pendentes.

**Pronto quando:** não é possível pular uma sub-etapa com obrigatório pendente, e a mensagem diz
exatamente qual.

## Onda 4 — Identidade completa do cliente

Independente das ondas 1-3 — pode correr em paralelo, não bloqueia nada.

**4.1** Os **7 clientes sem telefone** (Ricardo Mendes, Lanna, Chanderliê, Kepler Pascoal,
Flávio SSPDS e mais dois): tela de preenchimento manual, com busca no arquivo de leads por nome
aproximado como sugestão — sugestão, nunca casamento automático.

**4.2** E-mail está em apenas **11 dos 37**. Rodar a base de leads de novo mirando e-mail (hoje o
casamento priorizou telefone) e completar o que der.

**4.3** Corrigir o login do cliente: `lib/auth.ts:132` usa `.limit(1)` e resolve o projeto pelo
e-mail — cliente com dois projetos vê só um. Passa a resolver **cliente** e, havendo mais de um
projeto, mostra seletor.

**4.4** Enterrar o `@sem-email.invalid`: com e-mail real, o portal passa a funcionar; sem e-mail, o
cliente fica explicitamente marcado como "sem acesso ao portal" em vez de ter um endereço falso que
parece válido.

**Pronto quando:** um cliente com dois projetos entra e escolhe qual ver.

## Riscos

| Risco | Mitigação |
|---|---|
| Condição derivada custa consulta a mais por projeto | avaliar em lote por projeto, não por item; medir antes de otimizar |
| Semear padrão em cima de 217 itens do Jestor polui a tela | histórico recolhido por padrão (Onda 1.3) |
| Time perde referência do que já fez no Jestor | nada é apagado; histórico fica somente-leitura |
| Gate trava a operação em projeto legado | obrigatórios só valem para sub-etapa em que o projeto **entrar** depois da mudança |

## Fora de escopo

- Série/datalogger/credenciais do inversor e criptografia (essa era a Sprint 2 antiga; move para a 3,
  junto com o formulário do cliente que traz CPF/CNPJ).
- Estoque consumindo lista de materiais.
- `project_ledger` e resultado real do projeto.
- Integrações Sales Engine / SoloApp.

## Ordem sugerida

Onda 1 → Onda 2 → Onda 3, nessa sequência, porque cada uma depende da anterior. A Onda 4 entra em
qualquer momento. Se precisar cortar, **a Onda 1 sozinha já resolve** a queixa original de que cada
projeto tem um checklist diferente.
