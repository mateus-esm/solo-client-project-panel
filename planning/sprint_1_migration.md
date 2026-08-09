# Sprint 1 — Resultado da execução — Claude (Fable 5), 2026-08-09

**Status: concluída e aplicada em produção (Neon).** Tudo aditivo — nenhuma tabela existente foi
alterada, nenhum dado anterior foi tocado.

## O que foi criado

| Tabela | Registros | Observação |
|---|---|---|
| `clients` | **37** | identidade durável do cliente; chave = telefone normalizado |
| `plants` | **31** | ficha da usina + equipamentos; 1 por projeto |
| `stock_items` | **0** | tabela criada vazia, a equipe cadastra |
| `projects.client_id` | **37 / 37** | todos os projetos ligados ao cliente |

Somado: **312,1 kWp** de potência instalada registrada nas usinas.

## Preenchimento real (sem dado inventado)

**Clientes (37)**

| Campo | Preenchidos | Fonte |
|---|---|---|
| Telefone | **30** | base de leads |
| E-mail | 11 | base de leads |
| Endereço | 21 | planilha de propostas |
| Origem = `lead` | 33 | casaram com um lead |

**Usinas (31)**

| Campo | Preenchidos | Fonte |
|---|---|---|
| Potência instalada | **29** | planilha de usinas + projeto |
| Concessionária | 22 | propostas |
| Endereço de instalação | 21 | propostas |
| Módulo (fabricante/W/qtd) | 22 | propostas |
| Inversor (fabricante/kW/qtd) | 22 | propostas |
| Link de monitoramento | **0** | — |
| Drive | 1 | usinas |

Inversores na carteira ativa: Solplanet 8, Hoymilles 5, Canadian Solar 4, Sofar 1, Auxsol 1,
Deye 1, Solax 1, Tsun 1.

Exemplo de card completo depois da carga:

```
José Brasil    85994513105   onboarding    7.4 kWp   12 módulos
               rua I, 161, Quintino Cunha, Fortaleza — Enel Distribuição
```

## Decisões tomadas durante a execução

**Casamento só exato e por prefixo — sem fuzzy.** No estudo eu tinha medido 32/37 com telefone
usando também correspondência aproximada. Na execução tirei o fuzzy e ficaram **30**. Dado de
cliente errado é pior que dado faltando: telefone trocado significa mandar mensagem para outra
pessoa. Os 2 a mais não valiam o risco.

**`drizzle-kit push` foi descartado.** Ele abriu prompt interativo pedindo para truncar a tabela
`projects` (que tem os 37 projetos) para adicionar uma constraint. Apliquei o DDL explícito em vez
disso — só `CREATE TABLE IF NOT EXISTS` e `ADD COLUMN IF NOT EXISTS`, sem tocar em nada existente.

**Telefone repetido não derruba a carga.** O índice único em `phone_normalized` impediria a segunda
inserção. A regra é: se o telefone já existe, o campo fica nulo e o cliente entra mesmo assim, para
revisão manual. Nesta carga não houve nenhum conflito.

**Usina só é criada quando há dado.** 6 projetos não têm proposta nem ficha de usina — não criei
registro vazio para eles. Ficam sem usina até alguém preencher.

## O que ficou faltando, e por quê

**7 clientes sem telefone.** Não casaram com nenhum lead, ou o lead está sem telefone:
Ricardo Mendes, Lanna, Chanderliê, Kepler Pascoal, Flávio SSPDS e mais dois. Preenchimento manual —
são sete.

**Link de monitoramento: zero.** A planilha de usinas tem a coluna, mas vazia para os ativos — faz
sentido, porque monitoramento só existe depois da usina ativada, e estes projetos ainda estão em
andamento. É exatamente o campo que a ficha de equipamentos (série do inversor, série do datalogger,
código de verificação, credenciais) vai preencher quando cada projeto chegar à Ativação.

**6 projetos sem usina.** Sem proposta e sem ficha no Jestor — a maioria O&M e projetos antigos.

**Estoque vazio.** Nenhuma planilha tinha inventário. A tabela existe e espera cadastro.

**CPF/CNPJ: zero**, como planejado. Entra na Sprint 3, pelo formulário do cliente, e aí vira a chave
definitiva — é ela que casa com o SoloApp, onde `Client.cpfCnpj` é único.

## Reexecução

O script é idempotente: reaproveita cliente por telefone e depois por nome, e não recria usina que já
existe. Rodar de novo não duplica.

```bash
python scripts/xlsx-to-json.py <planilha.xlsx> <dir>/leads.json      # idem propostas.json, usinas.json
pnpm --filter @workspace/scripts run backfill:sprint1 -- <dir> --dry-run
pnpm --filter @workspace/scripts run backfill:sprint1 -- <dir>
```

## Próximo passo

A base está pronta para a Sprint 2: **checklist padronizado por sub-etapa com item-ação** (o ponto de
que marcar caixinha não é executar a tarefa) e o restante dos contatos. As telas de `clients`,
`plants` e `estoque` no `/interno` ainda não existem — os dados estão no banco, mas só aparecem via
API. Isso é o primeiro item da próxima sprint, senão a operação não enxerga o que foi carregado.
