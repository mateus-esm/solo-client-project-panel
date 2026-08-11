# Sprint 3 — Notificação por WhatsApp direto do ERP

Objetivo: acabar com o trabalho manual de abrir o WhatsApp, procurar o grupo,
copiar o template de algum lugar, ajustar e colar. Dentro do ERP: escolher
destino → escolher template → ajustar → enviar.

Status: **implementado e testado de verdade** — grupo criado, foto aplicada,
mensagem enviada no grupo e no privado. Falta rodar a migração e setar as
variáveis de ambiente (ver "Para subir", no fim).

---

## O que foi entregue

### 1. Envio com template, dentro da ficha do projeto

Bloco novo em `/interno/projetos/:id` (`NotificarWhatsApp`), acima do financeiro:

- **Destino** — cartões selecionáveis: privado do cliente, grupo do cliente,
  grupo da equipe de instalação, grupo da homologação, privado do técnico.
  Grupo que ainda não existe mostra botão **Criar** ali mesmo.
- **Template** — botão abre a biblioteca com busca (nome, código, "quando usar").
  43 mensagens, agrupadas pelas 9 categorias da jornada.
- **Variáveis** — os campos aparecem já preenchidos com o que o ERP sabe do
  projeto (nome, potência, cidade, valor, equipe, concessionária, rastreio,
  link de monitoramento). O resto é digitado.
- **Preview editável** — o texto final fica numa caixa de texto. É esse texto que
  sai, não o template. Dá para reescrever tudo antes de mandar.
- **Trava de buraco** — placeholder não preenchido vira `[valor]` e o botão de
  enviar fica desabilitado enquanto sobrar algum. Não tem como mandar
  "no valor de [valor]" para o cliente.
- **Histórico** — os últimos envios do projeto, com status, destino e o texto
  exato que saiu.

### 2. Grupos automáticos

Um grupo por projeto **e por público** (`whatsapp_groups`, único em
`project_id + kind`):

| kind          | Quem entra                                                  |
|---------------|-------------------------------------------------------------|
| `cliente`     | número da Solo (dono) + admins + telefone do cliente          |
| `instalacao`  | número da Solo + admins + responsável da equipe do serviço    |
| `homologacao` | número da Solo + admins + técnico de homologação atribuído    |

Na criação: **foto do grupo** (a marca da Solo) e **descrição** com o nome
completo. O JID (`…@g.us`) é gravado e é a identidade permanente — nunca
procuramos grupo por nome.

A criação é **idempotente**: chamar de novo devolve o grupo existente sem tocar
no WhatsApp. Criar dois grupos iguais deixaria o cliente em dois lugares sem
saber qual é o bom.

### 3. Vincular os grupos que já existem

A Solo já tinha **122 grupos** no número conectado, sendo **48 no padrão
`Solo | Usina - Nome (X kWp)`**. Recriar seria jogar fora o histórico de
conversa de cada cliente. Então o botão **Vincular** abre a lista dos grupos
reais do WhatsApp e você aponta qual é o do projeto.

A lista vem **ordenada pela parecença com o nome do cliente** — os prováveis
aparecem destacados em "Parecem ser deste cliente", o resto abaixo, com busca.
Grupo já usado por outro projeto vem marcado, para não vincular duas vezes.

Vincular **não mexe no grupo**: não renomeia, não troca a foto, não adiciona
ninguém. O grupo é do cliente e já está funcionando — mudar sem pedir seria
invasivo. **Desvincular** também só solta o ponteiro; o grupo continua lá.

Por isso o card mostra **Vincular** antes de **Criar**: para cliente antigo,
criar um segundo grupo dividiria a conversa em dois lugares.

### 4. Criar o grupo virou tarefa do onboarding

`"Criar grupo com o cliente"` era caixinha manual em *Boas-vindas e Portal*.
Agora é **item-ação** (`criar_grupo_whatsapp`): fica cumprido quando o grupo
existe de verdade em `whatsapp_groups`, e o atalho leva direto ao bloco de
WhatsApp. Segue a regra dos itens-ação já usada no resto do checklist — ninguém
marca nada à mão.

---

## Observações importantes (leia estas)

### 🔴 O JID do WhatsApp não é o número que você digita

O achado mais importante desta rodada, e um bug de verdade no que eu tinha
escrito antes. Perguntei ao próprio WhatsApp:

```
POST /v1/chat/whatsappNumbers/solobusiness  {"numbers":["5585996487923", ...]}
→ {"exists":true, "number":"5585996487923", "jid":"558596487923@s.whatsapp.net"}
→ {"exists":true, "number":"5585999289511", "jid":"558599289511@s.whatsapp.net"}
```

Repare: **o JID perde o nono dígito**. Seu número é `5585996487923`, mas o JID é
`558596487923@s.whatsapp.net`. Contas antigas mantêm a forma de 8 dígitos.

Eu montava o JID concatenando (`${digitos}@s.whatsapp.net`), o que geraria
`5585996487923@s.whatsapp.net` — um JID que não é o seu. O grupo seria criado
**sem você dentro**, e sem erro nenhum.

Corrigido: antes de criar o grupo o servidor chama `chat/whatsappNumbers` e usa
o JID que o WhatsApp devolve. Quem não tem WhatsApp fica de fora com aviso
explícito em vez de sumir em silêncio. Se o gateway estiver fora do ar na hora,
cai na forma antiga em vez de travar a criação.

### 🟢 O número do Gabriel está certo — eu é que estava errado

`+55 85 9928-9511` **existe e funciona**. Conferido na API: resolve para
`558599289511@s.whatsapp.net`, e a forma discável com o nono dígito
(`5585999289511`) aponta para o mesmo contato.

Meu validador anterior reprovava esse número por "estar faltando um dígito".
Estava reprovando número bom: ele era 12 dígitos porque é a forma de JID, não
porque estava truncado. Afrouxei a checagem para só formato (55 + DDD + 8 ou 9
dígitos) e deixei a decisão de existir ou não com o WhatsApp, que é quem sabe.

Ele já entrou no grupo de teste sem problema.

### 🔴 O nome do grupo não cabe nos 25 caracteres

O nome que você pediu era:

```
Solo | Usina - {client_name} ({project_potency} kWp)
```

Isso não é possível hoje. O whatsmiau valida o campo `subject` com
`max=25` caracteres e devolve 400. Verifiquei direto contra o servidor:

```
POST /v1/group/updateGroupSubject/solobusiness
{"subject":"Solo | Usina - Teste Nome Longo (75 kWp)"}
→ HTTP 400 "Field validation for 'Subject' failed on the 'max' tag"
```

`Solo | Usina - Chica Doce (75 kWp)` tem 34 caracteres. Nenhum cliente real cabe.

**O que fiz:** o nome encolhe por prioridade — prefixo > nome > potência:

| Cliente                     | Potência | Nome do grupo             |
|-----------------------------|----------|---------------------------|
| Chica Doce                  | 75       | `Solo | Chica Doce 75 kWp` |
| José Carlos da Silva Neto   | 12,5     | `Solo | José 12,5 kWp`     |
| Ana Paula                   | —        | `Solo | Ana Paula`         |

Prefixo por público: `Solo | ` (cliente), `Solo Obra | ` (instalação),
`Solo Hml | ` (homologação). O **nome completo pretendido vai na descrição do
grupo**, que não tem limite:
`Solo | Usina - Chica Doce (75 kWp)`.

**A prova de que é limitação do gateway, não do WhatsApp:** seus 48 grupos atuais
já têm nomes longos — `Solo | Usina - Josélia | Estêvão (22,32 kWp)` tem 44
caracteres. Foram criados na mão, pelo app, que aceita até 100. Só a API do
whatsmiau corta em 25. Tentei também a rota alternativa
(`POST /v1/instance/{instance}/group/create`): mesmo DTO, mesma validação.

**Como recuperar o nome que você queria:** trocar `validate:"max=25"` por
`max=100` no [verbeux-ai/whatsmiau](https://github.com/verbeux-ai/whatsmiau) e
subir o gateway de novo. Depois é só setar `WHATSAPP_GROUP_SUBJECT_MAX=100` e os
grupos novos saem com `Solo | Usina - Chica Doce (75 kWp)` inteiro — o código já
está pronto para os dois cenários, com teste cobrindo.

Enquanto isso o impacto é pequeno: **cliente antigo já tem grupo** e entra por
"Vincular", mantendo o nome bonito. O corte só atinge cliente novo.

### 🟡 Os números fixos ficaram em variável de ambiente, não no código

`WHATSAPP_ADMIN_PHONES="5585996487923:Mateus,5585999289511:Gabriel"` — o rótulo
depois dos dois-pontos é opcional e só serve para o registro de quem é quem.
Número de pessoa muda; recompilar o servidor para trocar telefone seria ruim.

O número conectado (o da Solo) **não** vai nessa lista: ele é o dono do grupo e
entra sozinho. Colocá-lo lá faria o gateway tentar adicionar o próprio dono.

### 🟡 Privacidade do contato pode barrar a entrada no grupo

Quem tem "quem pode me adicionar em grupos" restrito no WhatsApp não entra
direto. O gateway avisa isso na resposta (`error != 0` por participante) e o ERP
mostra o aviso na hora: *"Fulano não pôde ser adicionado — a privacidade do
contato bloqueia. Mande o convite pelo link."* O link de convite do grupo é
buscado e gravado em `whatsapp_groups.invite_url` justamente para esse caso.

### 🟡 A doc do ambiente estava errada

`replit.md` documentava `WHATSAPP_API_TOKEN`, mas o código sempre leu
`WHATSAPP_API_KEY`. Corrigi a tabela e documentei as variáveis novas.

### 🟡 Técnico de homologação não tinha telefone

Sem telefone ele não entra no grupo do processo. Adicionei `phone` em
`homologacao_technicians` e um `PATCH /internal/technicians/:id` para preencher.
Os técnicos já cadastrados estão com o campo vazio — precisa preencher.

### 🟡 Duas implementações de `sendWhatsApp` conviviam no repo

`lib/messaging.ts` e `lib/notifications.ts` têm cada uma a sua, ambas mandando
`{ Number, Text }` com maiúscula (funciona: o Go é case-insensitive no JSON).
**Não mexi nelas** — estão em uso por outros fluxos e não era o escopo. O código
novo usa `lib/whatsmiau.ts`, que é o cliente completo do gateway. Consolidar as
três numa só é dívida para uma próxima passada.

### 🟢 A foto do grupo foi ajustada para o recorte circular

O WhatsApp recorta a foto do grupo em círculo, e o símbolo da Solo é largo — as
pontas laterais sumiriam. Reduzi a marca para 72% do quadro, sobre o mesmo fundo
preto, em JPEG 512×512.

Vai embutida em base64 (`lib/grupo-avatar.ts`, ~12 KB) porque o build gera um
`dist/index.mjs` único e um arquivo solto não seria copiado. A arte-fonte está em
`planning/assets/grupo-avatar.jpg` e o gerador em
`scripts/src/gerar-avatar-grupo.py`.

### 🟢 O catálogo de templates não foi duplicado no front

São 43 mensagens. Duas cópias divergiriam na primeira correção de texto. O front
busca em `GET /internal/whatsapp/templates`. É a exceção consciente à regra de
espelhamento manual que o resto de `internal-api.ts` segue.

---

## Arquivos

**Banco**
- `lib/db/migrations/015_whatsapp_grupos_e_envios.sql` — tabelas novas + `phone` no técnico
- `lib/db/src/schema/whatsapp.ts` — `whatsapp_groups`, `whatsapp_sends`
- `lib/db/src/schema/pipeline.ts` — ação `criar_grupo_whatsapp`
- `lib/db/src/schema/homologacao.ts` — `phone`

**API**
- `artifacts/api-server/src/lib/whatsmiau.ts` — cliente do gateway (inclui `resolveJids`)
- `artifacts/api-server/src/lib/whatsapp-templates.ts` — os 43 templates
- `artifacts/api-server/src/lib/whatsapp-subject.ts` — nome do grupo e casamento com cliente (lógica pura)
- `artifacts/api-server/src/lib/whatsapp-groups.ts` — criar, vincular, participantes
- `artifacts/api-server/src/lib/grupo-avatar.ts` — foto em base64
- `artifacts/api-server/src/routes/internal/whatsapp.ts` — rotas
- `artifacts/api-server/src/lib/checklist-actions.ts` — resolve `criar_grupo_whatsapp`
- `artifacts/api-server/src/lib/__tests__/whatsapp.test.ts` — 21 testes, passando

**Front**
- `artifacts/solo-energia/src/components/notificar-whatsapp.tsx`
- `artifacts/solo-energia/src/pages/interno/projeto-detalhe.tsx`
- `artifacts/solo-energia/src/lib/internal-api.ts`

### Rotas

```
GET    /api/internal/whatsapp/templates              catálogo
GET    /api/internal/whatsapp/grupos-disponiveis     grupos reais do WhatsApp
                                     ?projectId=N    …ordenados pela parecença
GET    /api/internal/whatsapp/:projectId/contexto    destinos + variáveis preenchidas
POST   /api/internal/whatsapp/:projectId/grupos      { kind } → cria (idempotente)
GET    /api/internal/whatsapp/:projectId/grupos      grupos do projeto
POST   /api/internal/whatsapp/:projectId/grupos/vincular  { kind, jid }
DELETE /api/internal/whatsapp/:projectId/grupos/:kind     solta o vínculo
POST   /api/internal/whatsapp/:projectId/enviar      { destinoId, texto, templateCode? }
GET    /api/internal/whatsapp/:projectId/historico   últimos 50 envios
```

### Rotas do whatsmiau usadas

Confirmadas contra `GET /v1/swagger/doc.json` do servidor — o payload da spec que
você mandou estava desatualizado em dois pontos: o campo é **`subject`**, não
`name`, e a resposta traz **`id`**, não `JID` (o código aceita os dois).

```
POST /v1/chat/whatsappNumbers/{instance}         { numbers[] } → JID real
POST /v1/message/sendText/{instance}             { number, text }
POST /v1/group/create/{instance}                 { subject, participants[], description }
GET  /v1/group/fetchAllGroups/{instance}         lista para vincular
POST /v1/group/updateGroupPicture/{instance}     { groupJid, image }  base64 ou URL
POST /v1/group/updateGroupDescription/{instance} { groupJid, description }
GET  /v1/group/inviteCode/{instance}?groupJid=…
POST /v1/group/sendInvite/{instance}             { groupJid, numbers[] }
```

---

## Para subir

```bash
# 1. Migração
pnpm --filter @workspace/db migrate

# 2. Variáveis (Replit → Secrets)
WHATSAPP_API_URL=http://72.61.219.156:8081
WHATSAPP_API_KEY=<a apikey>
WHATSAPP_INSTANCE=solobusiness
WHATSAPP_ADMIN_PHONES=5585996487923:Mateus,558599289511:Gabriel
```

Depois, num projeto em `/interno/projetos/:id`:

1. **Vincular** o grupo que já existe (ou **Criar**, se for cliente novo)
2. Escolher um template, ajustar, enviar

Vale passar nos projetos ativos vinculando os grupos de uma vez — a lista já vem
ordenada pelo nome do cliente, então é quase só confirmar.

Instância verificada como conectada em 11/08/2026:
`GET /v1/instance/connectionState/solobusiness` → `{"state":"open"}`.

### Verificado

**Teste real, contra o WhatsApp de produção (11/08/2026):**

| O quê | Resultado |
|---|---|
| Criar grupo com você + Gabriel + Solo | ✅ `120363412280299300@g.us`, 3 participantes, nenhum bloqueado |
| Foto do grupo | ✅ `pictureId: 1786479288` |
| Descrição do grupo | ✅ aplicada na criação |
| Mensagem no grupo (template HML-04) | ✅ `status: sent` |
| Mensagem no privado (você) | ✅ `status: sent` |
| Resolver JID pelo número | ✅ os dois números resolvidos corretamente |

O grupo de teste chama **"Solo | Teste ERP"** e está no seu WhatsApp — confira a
foto e o texto, e pode apagar quando quiser.

**Automatizado:**

- `vitest run`: **27/27 passando** (nome do grupo em todos os tamanhos,
  integridade dos 43 templates, normalização de número, JID, casamento de grupo
  com cliente usando os nomes reais dos seus grupos)
- `typecheck` de `api-server` e `solo-energia`: limpos
- `build` de `api-server` (esbuild) e de `solo-energia` (vite, 3103 módulos): ok

### Falhas pré-existentes (não são deste sprint)

- `pipeline-gates.test.ts` exige `DATABASE_URL`; sem banco local não roda.
- `pnpm typecheck:libs` quebra em `lib/integrations-openai-ai-react` — o pacote
  está sem `node_modules` neste checkout (`Cannot find module 'react'`).
- Este checkout foi instalado para Linux/Replit, então faltavam os binários
  nativos de Windows (`rollup`, `lightningcss`, `@tailwindcss/oxide`) e nem
  teste nem build rodavam aqui. Coloquei os três em `node_modules` para
  conseguir verificar — é só local, `node_modules` está no `.gitignore` e no
  Replit os binários corretos já vêm no install.

---

## Próximos passos naturais

1. **Disparo automático por mudança de etapa** — a infra está pronta: quando o
   projeto muda de macro-etapa, sugerir o template daquela fase já preenchido,
   com um clique para confirmar. Sugerir, não mandar sozinho.
2. **Consolidar os três `sendWhatsApp`** em `lib/whatsmiau.ts`.
3. **Envio de mídia** (`POST /v1/message/sendMedia`) — mandar a proposta em PDF
   ou as fotos da obra pelo mesmo bloco.
4. **Receber mensagem** — o whatsmiau tem webhook de entrada; daria para mostrar
   a conversa do grupo dentro da ficha do projeto.
