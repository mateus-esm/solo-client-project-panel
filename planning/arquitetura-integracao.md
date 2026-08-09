# Arquitetura dos 3 sistemas — entendimento — Claude (Fable 5), 2026-08-09

Documento de **entendimento**, não de implementação. Registra a lógica de integração para as
decisões de schema do SoloPro não serem inventadas, e sim derivadas do que os outros dois sistemas
já esperam.

## O fluxo

```
Sales Engine (Supabase, multi-tenant, SaaS vendável)
        │  deal ganho
        ▼
SoloPro (este repo — ERP interno de operações)
        │  projeto concluído / usina ativada
        ▼
SoloApp (Prisma — monitoramento do cliente)
        │  ticket / falha
        └──────────────► volta ao SoloPro como serviço de O&M
```

SoloPro é o **meio de campo**: recebe o negócio fechado, entrega o produto físico, e entrega a usina
monitorada para o SoloApp. Não é CRM (isso é o Sales Engine) nem monitoramento (isso é o SoloApp).

## O que cada sistema já tem

**Sales Engine** (~40 tabelas): `leads`, `opportunities`, `opportunity_stage_history`, `companies`,
`properties`, `property_owner_links`, `contact_company_links`, `pipelines`, `pipeline_stages`,
`tasks`, `touchpoints`. Multi-tenant (`profiles`, `user_roles`, `planos`, `niches`) e automação
(`webhook_configs`, `webhook_logs`, `scheduled_automations`, `copilot_agents`, `ai_decisions`).
Já tem **modelo de propriedade e de proprietário** — o SoloPro não tem.
Já tem **webhooks configuráveis** — o mecanismo do handoff existe, não precisa ser construído.

**SoloApp** (15 models): `Client`, `Plant`, `Inverter`, `ConsumerUnit`, `CreditAllocation`,
`GenerationUnit`, `Consumption`, `EnergyBill`, `Transaction`, `Investment`, `Indication`, `Offer`.

**SoloPro** (21 tabelas): projects (+37 importados), checklists, services, purchases, suppliers,
payments, documents, homologação, instaladores, portal do cliente.

## Achado principal: falta uma chave de identidade comum

O `SoloApp.Client` tem **`cpfCnpj @unique`** e `email @unique`. O SoloPro identifica cliente por
`client_name` (texto) e `client_email` — e no import dos 37 ativos **nenhum tinha e-mail real**
(os endereços são `@sem-email.invalid` gerados).

Sem CPF/CNPJ o SoloPro não consegue:
- deduplicar cliente ao receber um segundo negócio ganho (o requisito que você levantou);
- casar com o cliente que já existe no SoloApp;
- casar com o lead/oportunidade do Sales Engine.

**CPF/CNPJ é a chave natural entre os três sistemas.** É o primeiro campo a existir na tabela
`clients` do SoloPro. E-mail é chave fraca aqui (cliente troca, compartilha, e hoje 100% é fictício).

## Contratos de handoff (o que trafega entre sistemas)

### 1. Sales Engine → SoloPro (negócio ganho)

`opportunity` ganha vira, no SoloPro: **1 cliente** (novo ou reaproveitado por CPF/CNPJ) + **1
projeto/serviço** vinculado a ele. Nunca um cliente duplicado.

Carrega: dados do cliente (nome, CPF/CNPJ, e-mail, telefone), propriedade/endereço de instalação
(o Sales Engine tem `properties` — o SoloPro não tem endereço em nenhum dos 37 importados), valor
fechado, forma de pagamento, e o **tipo** do que foi vendido.

### 2. SoloPro → SoloApp (usina entregue)

Aqui o contrato já está escrito — é o schema do SoloApp. O `Inverter` espera exatamente:

```
provider, providerId, providerPlantId, providerApiKey, providerApiSecret, providerUrl,
serialNumber, manufacturer, modelName, nominalPowerKw, installedAt, commissionedAt
```

Ou seja: **os campos de monitoramento que discutimos ontem não são invenção — são o payload que o
SoloApp já pede.** `provider` = Growatt/Solarman/iSolarCloud/FusionSolar; `providerId` +
`providerApiKey/Secret` = as credenciais; `serialNumber` = o nº do inversor; e o nº do
datalogger/check code é o que permite obter o `providerPlantId`.

O `Plant` espera `installedPowerKw`, `address`, `city`, `state`, `latitude`, `longitude`.
O `ConsumerUnit` espera `installationNumber`, `clientNumber`, `accountHolder`, `distributor`,
`isGenerator`/`isConsumer` — e `CreditAllocation` é o **rateio**.

Conclusão: a tabela de **usinas** que você pediu não é um cadastro solto. É o registro que alimenta
`Plant` + `Inverter` + `ConsumerUnit` + `CreditAllocation` no SoloApp.

A planilha de Usinas do Jestor (97 linhas) traz: Nome, Cliente, Propriedade, Tipo de Usina, Status,
Área Construída, Potência Instalada (kWp), Geração Estimada (kWh), Receita Estimada (R$), Data de
Início, Data de Ativação, Observações, Monitoramento (link), Drive. Cobre `Plant` quase inteiro —
falta serial/credencial de inversor e o rateio (UCs).

### 3. SoloApp → SoloPro (ticket vira O&M)

Ticket/falha no monitoramento abre um **serviço de O&M** no SoloPro, vinculado ao mesmo cliente e à
mesma usina. Isso fecha o ciclo: a usina entregue volta a gerar trabalho (e receita recorrente)
dentro do mesmo pipeline.

## Consequências para o schema do SoloPro (não implementar ainda)

Em ordem de dependência — cada item destrava o seguinte:

1. **`clients`** com `cpf_cnpj` único. Sem isso não há dedup nem integração. É a base.
2. **`tipo` no pipeline** — projeto, O&M, monitoramento, carregador EV. Você já quer um pipeline só
   com filtro, e os dados confirmam: 14 O&M no histórico, 3 ativos. Mesmo funil, filtro por tipo, e
   os gates de homologação não se aplicam a O&M.
3. **`usinas`** (1 por projeto entregue) + inversores com serial/datalogger/credenciais. É o payload
   do SoloApp e a origem do "mandar o acesso pro cliente".
4. **UCs e rateio** — vinculadas à usina. Alimenta `ConsumerUnit`/`CreditAllocation`.
5. **Estoque** — itens com saldo, e a lista de materiais do serviço consumindo do estoque. Dá custo
   real por projeto e melhora o controle financeiro enquanto não existe app financeiro.
6. **Formulário do cliente** — link enviado ao cliente que retorna documentos (conta de luz, RG/CPF,
   docs de homologação). O SoloPro já tem `documents` com categoria e upload por object storage;
   falta o link público com token e o vínculo com o checklist que espera o documento.

## O que NÃO precisa ser construído

- CRM, funil comercial, lead scoring → é o Sales Engine.
- Coleta de geração, curvas, faturas → é o SoloApp.
- Mecanismo de webhook → o Sales Engine já tem `webhook_configs`/`webhook_logs`.
- Multi-tenant no SoloPro → o SoloPro é interno da Solo. Quem é multi-tenant é o Sales Engine.

## Estado atual (2026-08-09)

37 projetos ativos importados e em uso, 3.289 itens de checklist (1.988 concluídos), R$ 730.657 em
carteira. 96 concluídos ainda fora. Nenhum cliente tem e-mail real, telefone ou endereço — o que
reforça a ordem acima: `clients` primeiro, e a base de leads é a fonte natural desses contatos.
