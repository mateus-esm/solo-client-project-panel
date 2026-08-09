# Sprint 1.2 — Telas para os dados migrados — Claude (Fable 5), 2026-08-09

A Sprint 1 carregou `clients`, `plants` e `stock_items` no banco, mas nada disso aparece na tela.
Esta sprint fecha essa lacuna: sem ela, a operação não enxerga o que foi migrado.

## Escopo

Só o necessário para ver e editar o que já existe. Nada de funcionalidade nova.

### Backend — 3 arquivos de rota

| Arquivo | Endpoints |
|---|---|
| `internal/clients.ts` | `GET /clients` (com contagem de projetos), `GET /clients/:id` (cliente + projetos + usinas), `POST /clients`, `PATCH /clients/:id` |
| `internal/plants.ts` | `GET /plants`, `GET /plants/by-project/:projectId`, `POST /plants`, `PATCH /plants/:id` |
| `internal/stock.ts` | `GET /stock`, `POST /stock`, `PATCH /stock/:id`, `DELETE /stock/:id` |

Todos atrás do `requireAdmin` que já protege `/api/internal`.

**Regra de telefone no backend:** normaliza no servidor (só dígitos, sem DDI) antes de gravar, e
devolve 409 com mensagem clara quando o telefone já pertence a outro cliente — em vez de estourar
erro de constraint.

### Frontend — 3 telas + 1 seção

**`/interno/clientes`** — lista com busca por nome/telefone/e-mail. Colunas: nome, telefone, e-mail,
origem, nº de projetos. Mostra explicitamente quem está **sem telefone**, porque são os 7 que
precisam de preenchimento manual.

**`/interno/clientes/:id`** — dados do cliente (editáveis), projetos vinculados com etapa e valor, e
as usinas. É a tela que responde "quem é esse cliente e o que ele tem com a gente".

**`/interno/estoque`** — tabela + diálogo de criar/editar. Categoria, unidade, quantidade, custo
unitário, estoque mínimo, fornecedor, localização. Destaque visual quando `quantidade <= estoque_minimo`.

**Ficha da usina no `/interno/projetos/:id`** — bloco novo com potência, concessionária, endereço de
instalação, módulos, inversor, estrutura, monitoramento e Drive. Editável ali mesmo, porque é onde a
equipe está quando descobre o dado.

### Navegação

`Clientes` e `Estoque` entram no menu lateral do `/interno`.

## Fora de escopo

- Ficha de série/datalogger/credenciais do inversor (Sprint 2 — precisa da criptografia).
- Movimentação de estoque e consumo pela lista de materiais (Sprint 3).
- Tela de usinas separada: por ora a usina vive dentro do projeto, que é onde ela é usada.

## Como verificar

Abrir `/interno/clientes` e ver 37 clientes, 30 com telefone. Abrir um cliente e ver o projeto
ligado. Abrir um projeto e ver a ficha da usina com módulos e inversor. Criar um item de estoque.

---

## Resultado da execução

**Concluída.** Backend e frontend compilam limpos; os endpoints foram testados contra o banco de
produção com sessão admin real.

### Entregue

**Backend** — `internal/clients.ts`, `internal/plants.ts`, `internal/stock.ts`, montados atrás do
`requireAdmin` que já protege `/api/internal`.

**Frontend** — `/interno/clientes`, `/interno/clientes/:id`, `/interno/estoque`, o componente
`PlantCard` dentro de `/interno/projetos/:id`, e os itens **Clientes** e **Estoque** no menu lateral.

### Verificação (banco real, sessão admin)

| Teste | Resultado |
|---|---|
| `GET /internal/clients` sem sessão | `401 Admin não autenticado` |
| `GET /internal/clients` | 37 clientes |
| `GET /internal/clients/3` | José Brasil, tel 85994513105, 1 projeto, 1 usina |
| `GET /internal/plants/by-project/3` | 7.4 kWp, Enel Distribuição Ceará, 12×620W, Sofar |
| `POST /internal/stock` → `DELETE` | item criado e removido |
| `POST /internal/clients` com telefone existente | `409 Telefone já cadastrado para "AIrton"` |

### Um bug encontrado e corrigido durante o teste

A contagem de projetos por cliente vinha **37 para todos** — a subquery interpolando
`${clientsTable.id}` não gerava correlação, então contava a tabela inteira. Só apareceu porque
testei contra dado real: com um cliente por projeto, um número errado igual ao total passa
despercebido em revisão de código. Corrigido para referência crua (`projects.client_id = clients.id`);
a soma agora fecha em 37.

### O que ficou de fora, de propósito

- Série do inversor, datalogger, código de verificação e credenciais de monitoramento — Sprint 2,
  junto com a criptografia.
- Movimentação de estoque e consumo pela lista de materiais — Sprint 3.
- Tela separada de usinas: a usina vive dentro do projeto, que é onde a equipe a consulta.
