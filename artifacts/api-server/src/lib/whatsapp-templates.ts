/**
 * Biblioteca mestre de templates de notificação da Solo (planning/assets/solo_cx_templates.md).
 *
 * Fonte única: o front busca este catálogo em GET /internal/whatsapp/templates.
 * Duplicar 43 mensagens no cliente seria garantir que as duas cópias divergissem.
 *
 * Cada variável tem um `auto`: a chave do contexto do projeto que a preenche
 * sozinha na hora de abrir o template. O que não tem `auto` (valor, link, prazo)
 * fica em branco para o operador digitar.
 *
 * Negrito do WhatsApp é *asterisco simples*, não **duplo**.
 */

export const TEMPLATE_CATEGORIAS = [
  "Comercial / Fechamento",
  "Projeto Técnico",
  "Homologação",
  "Logística / Equipamentos",
  "Planejamento / Execução",
  "Ativação",
  "Monitoramento / Treinamento",
  "Encerramento",
  "Pós-venda / Suporte",
] as const;

export type TemplateCategoria = (typeof TEMPLATE_CATEGORIAS)[number];

/** Chaves preenchidas automaticamente a partir do projeto. */
export type AutoFill =
  | "primeiroNome"
  | "nomeCliente"
  | "potencia"
  | "cidadeUf"
  | "valorProjeto"
  | "equipe"
  | "concessionaria"
  | "transportadora"
  | "codigoRastreio"
  | "linkPortal"
  | "linkMonitoramento";

export interface TemplateVar {
  key: string;
  label: string;
  /** Preenchimento automático a partir do contexto do projeto. */
  auto?: AutoFill;
  /** Campo de texto longo (lista de itens, resumo). */
  multiline?: boolean;
}

/** O que o ERP sabe preencher sozinho — alimenta o seletor do editor. */
export const AUTO_FILL_OPTIONS: Array<{ value: AutoFill; label: string }> = [
  { value: "primeiroNome", label: "Primeiro nome do cliente" },
  { value: "nomeCliente", label: "Nome completo do cliente" },
  { value: "potencia", label: "Potência da usina (kWp)" },
  { value: "cidadeUf", label: "Cidade/UF" },
  { value: "valorProjeto", label: "Valor do projeto" },
  { value: "equipe", label: "Equipe de execução" },
  { value: "concessionaria", label: "Concessionária" },
  { value: "transportadora", label: "Transportadora" },
  { value: "codigoRastreio", label: "Código de rastreio" },
  { value: "linkPortal", label: "Link do portal do cliente" },
  { value: "linkMonitoramento", label: "Link do monitoramento" },
];

export interface NotificationTemplate {
  code: string;
  categoria: TemplateCategoria;
  nome: string;
  quandoUsar: string;
  /** Público natural — só ordena a lista, não impede enviar para outro destino. */
  publico: "cliente" | "equipe";
  vars: TemplateVar[];
  body: string;
}

const NOME: TemplateVar = { key: "nome", label: "Nome do cliente", auto: "primeiroNome" };

export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  // ─── 01. Comercial / Fechamento ─────────────────────────────────────────────
  {
    code: "COM-01",
    categoria: "Comercial / Fechamento",
    nome: "Novo negócio fechado — Boas-vindas",
    quandoUsar: "Cliente fechou o projeto",
    publico: "cliente",
    vars: [
      NOME,
      { key: "potencia", label: "Potência", auto: "potencia" },
      { key: "configuracao", label: "Configuração (uma por linha)", multiline: true },
      { key: "valor", label: "Valor do projeto", auto: "valorProjeto" },
      { key: "linkFormulario", label: "Link do formulário" },
    ],
    body: `💬 *Início de Projeto — Energia Solar*

Olá, {{nome}}! Seja muito bem-vindo à Solo Energia ☀️⚡

Vamos dar início ao seu projeto de energia solar, que contará com uma potência de {{potencia}}, utilizando:

{{configuracao}}

Valor do projeto: {{valor}}

O primeiro passo é o preenchimento do formulário com as informações necessárias para iniciarmos o projeto técnico:
🔗 {{linkFormulario}}

Em seguida, o projeto seguirá pelas etapas:
1️⃣ Projeto Técnico
2️⃣ Homologação
3️⃣ Logística de Material
4️⃣ Execução da Obra
5️⃣ Ativação
6️⃣ Treinamento

Qualquer dúvida, seguimos à disposição! 🚀`,
  },
  {
    code: "COM-02",
    categoria: "Comercial / Fechamento",
    nome: "Envio de proposta e contrato para assinatura",
    quandoUsar: "Contrato/proposta enviados via Clicksign",
    publico: "cliente",
    vars: [NOME],
    body: `💬 *Aceite de Proposta e Contrato*

Olá, {{nome}}! ☀️

Para darmos início ao seu projeto, enviamos para o seu WhatsApp a proposta e o contrato para aceite, através da plataforma Clicksign.

A assinatura é feita digitalmente, de forma simples e rápida.

Ficamos no aguardo da confirmação para seguirmos com as próximas etapas. ⚡`,
  },
  {
    code: "COM-03",
    categoria: "Comercial / Fechamento",
    nome: "Assinatura confirmada",
    quandoUsar: "Contrato assinado",
    publico: "cliente",
    vars: [NOME],
    body: `💬 *Atualização de Projeto — Assinatura Confirmada*

Olá, {{nome}}! ☀️

Confirmamos a assinatura da proposta e do contrato ✅

Agora seguimos para a próxima etapa, com o envio do link de pagamento da entrada e a preparação do início do projeto técnico.

Qualquer dúvida, seguimos à disposição! ⚡`,
  },
  {
    code: "COM-04",
    categoria: "Comercial / Fechamento",
    nome: "Envio de link de pagamento da entrada",
    quandoUsar: "Após assinatura",
    publico: "cliente",
    vars: [NOME, { key: "valor", label: "Valor da entrada" }, { key: "link", label: "Link de pagamento" }],
    body: `💬 *Pagamento da Entrada do Projeto*

Olá, {{nome}}! ☀️

Segue o link para pagamento da entrada do projeto, no valor de {{valor}}:

🔗 {{link}}

Assim que o pagamento for confirmado, daremos início ao projeto técnico.

Ficamos à disposição para qualquer dúvida! ⚡`,
  },
  {
    code: "COM-05",
    categoria: "Comercial / Fechamento",
    nome: "Pagamento confirmado — Início oficial",
    quandoUsar: "Entrada confirmada",
    publico: "cliente",
    vars: [NOME, { key: "linkFormulario", label: "Link do formulário" }],
    body: `💬 *Atualização de Projeto — Início Oficial*

Olá, {{nome}}! ☀️

Confirmamos o pagamento da entrada ✅

Agora vamos dar início ao seu projeto.

O primeiro passo é preencher o formulário com os dados necessários para a elaboração do projeto técnico:
🔗 {{linkFormulario}}

Caso tenha qualquer dúvida no preenchimento, pode nos chamar por aqui. ⚡`,
  },

  // ─── 02. Projeto Técnico ────────────────────────────────────────────────────
  {
    code: "PRJ-01",
    categoria: "Projeto Técnico",
    nome: "Solicitação de formulário de dados",
    quandoUsar: "No início do projeto",
    publico: "cliente",
    vars: [NOME, { key: "linkFormulario", label: "Link do formulário" }],
    body: `💬 *Atualização de Projeto — Formulário de Dados*

Olá, {{nome}}! ☀️

Para iniciarmos o desenvolvimento do seu projeto técnico, pedimos por favor o preenchimento do formulário abaixo:

🔗 {{linkFormulario}}

Se tiver qualquer dúvida em algum campo, pode nos avisar por aqui. ⚡`,
  },
  {
    code: "PRJ-02",
    categoria: "Projeto Técnico",
    nome: "Solicitação de informação complementar",
    quandoUsar: "Falta dado, foto ou documento",
    publico: "cliente",
    vars: [NOME, { key: "item", label: "Item solicitado", multiline: true }],
    body: `💬 *Atualização de Projeto — Informação Complementar*

Olá, {{nome}}! ☀️

Para seguirmos com o projeto técnico, precisamos de uma informação complementar:

📌 {{item}}

Assim que recebermos, seguimos com a elaboração do projeto.

Qualquer dúvida, estamos à disposição! ⚡`,
  },
  {
    code: "PRJ-03",
    categoria: "Projeto Técnico",
    nome: "Projeto técnico iniciado",
    quandoUsar: "Formulário recebido",
    publico: "cliente",
    vars: [NOME],
    body: `💬 *Atualização de Projeto — Início do Projeto Técnico*

Olá, {{nome}}! ☀️

Confirmamos o recebimento das informações e agora vamos dar início à fase de Projeto Técnico ✅

Caso seja necessário algum dado adicional ou visita técnica, informaremos por aqui.

Seguimos avançando! ⚡`,
  },
  {
    code: "PRJ-04",
    categoria: "Projeto Técnico",
    nome: "Projeto técnico concluído",
    quandoUsar: "Projeto pronto",
    publico: "cliente",
    vars: [NOME],
    body: `💬 *Atualização de Projeto — Projeto Técnico Concluído*

Olá, {{nome}}! ☀️

Seu projeto técnico já está pronto ✅

Agora vamos seguir para a próxima etapa, com a preparação da documentação para a homologação junto à {{concessionaria}}.

Em seguida, enviaremos os documentos que precisam de assinatura. ⚡`,
  },
  {
    code: "PRJ-05",
    categoria: "Projeto Técnico",
    nome: "Envio de FSA / documentos para assinatura",
    quandoUsar: "Precisa de assinatura do FSA/TRT/rateio",
    publico: "cliente",
    vars: [NOME, { key: "documentos", label: "Documentos (um por linha)", multiline: true }],
    body: `💬 *Atualização de Projeto — Documentos para Assinatura*

Olá, {{nome}}! ☀️

Para seguirmos com a etapa de homologação, precisamos da assinatura dos documentos abaixo:

{{documentos}}

Pedimos, por favor, que assine e nos devolva por aqui.

Assim que recebermos, damos sequência imediata ao processo. ⚡`,
  },
  {
    code: "PRJ-06",
    categoria: "Projeto Técnico",
    nome: "Documentos assinados recebidos",
    quandoUsar: "Cliente devolveu os documentos",
    publico: "cliente",
    vars: [NOME],
    body: `💬 *Atualização de Projeto — Documentos Recebidos*

Olá, {{nome}}! ☀️

Confirmamos o recebimento dos documentos assinados ✅

Agora vamos dar sequência à entrada da homologação junto à {{concessionaria}}.

Seguimos acompanhando e atualizando você por aqui. ⚡`,
  },

  // ─── 03. Homologação ────────────────────────────────────────────────────────
  {
    code: "HML-01",
    categoria: "Homologação",
    nome: "Entrada na homologação",
    quandoUsar: "Protocolo feito na concessionária",
    publico: "cliente",
    vars: [NOME],
    body: `💬 *Atualização de Projeto — Homologação*

Olá, {{nome}}! ☀️

Gostaríamos de informar que já demos entrada na homologação do projeto junto à {{concessionaria}} ✅

Agora o processo segue em análise pela concessionária. Assim que houver retorno, atualização de prazo ou solicitação de ajuste, informaremos por aqui. ⚡`,
  },
  {
    code: "HML-02",
    categoria: "Homologação",
    nome: "Update de homologação — Em análise",
    quandoUsar: "Sem novidade, mas mantendo o cliente informado",
    publico: "cliente",
    vars: [NOME, { key: "prazo", label: "Prazo informado" }],
    body: `💬 *Atualização de Projeto — Homologação em Análise*

Olá, {{nome}}! ☀️

Seu projeto segue em análise na {{concessionaria}}.

No momento, estamos acompanhando os prazos e aguardando o retorno da concessionária.

Prazo atual informado: {{prazo}}

Qualquer novidade, informamos por aqui. ⚡`,
  },
  {
    code: "HML-03",
    categoria: "Homologação",
    nome: "Pendência na homologação",
    quandoUsar: "A concessionária exigiu algum ajuste",
    publico: "cliente",
    vars: [NOME, { key: "pendencia", label: "Pendência", multiline: true }],
    body: `💬 *Atualização de Projeto — Pendência de Homologação*

Olá, {{nome}}! ☀️

Recebemos um retorno da {{concessionaria}} informando a necessidade do seguinte ajuste para continuidade da homologação:

📌 {{pendencia}}

Essa é uma exigência técnica da concessionária. Assim que esse ponto for resolvido, seguimos normalmente com o processo.

Qualquer dúvida, podemos explicar com mais detalhes. ⚡`,
  },
  {
    code: "HML-04",
    categoria: "Homologação",
    nome: "Homologação aprovada",
    quandoUsar: "Homologação aprovada",
    publico: "cliente",
    vars: [NOME],
    body: `💬 *Atualização de Projeto — Homologação Aprovada*

Olá, {{nome}}! ☀️

Temos uma ótima notícia: a homologação do seu projeto foi aprovada ✅

Agora seguimos para a próxima etapa, com a logística/entrega do material e programação da montagem.

Qualquer nova atualização, informaremos por aqui. ⚡`,
  },

  // ─── 04. Logística / Equipamentos ───────────────────────────────────────────
  {
    code: "LOG-01",
    categoria: "Logística / Equipamentos",
    nome: "Equipamentos comprados",
    quandoUsar: "Pedido feito ao fornecedor",
    publico: "cliente",
    vars: [NOME, { key: "fornecedor", label: "Fornecedor" }],
    body: `💬 *Atualização de Projeto — Equipamentos*

Olá, {{nome}}! ☀️

Gostaríamos de informar que os equipamentos do seu projeto já foram adquiridos junto ao fornecedor {{fornecedor}}.

Agora seguimos acompanhando a confirmação, faturamento e expedição do material.

Em breve atualizamos você com as próximas informações. ⚡`,
  },
  {
    code: "LOG-02",
    categoria: "Logística / Equipamentos",
    nome: "Equipamentos faturados / NF emitida",
    quandoUsar: "Material faturado",
    publico: "cliente",
    vars: [NOME],
    body: `💬 *Atualização de Projeto — Material Faturado*

Olá, {{nome}}! ☀️

Os equipamentos do seu projeto já foram faturados e a nota fiscal já foi emitida ✅

Agora seguimos para a etapa de logística e expedição do material.

Assim que recebermos a previsão da transportadora, informaremos por aqui. ⚡`,
  },
  {
    code: "LOG-03",
    categoria: "Logística / Equipamentos",
    nome: "Material em trânsito",
    quandoUsar: "Pedido enviado",
    publico: "cliente",
    vars: [
      NOME,
      { key: "data", label: "Data prevista de entrega" },
      { key: "rastreio", label: "Código de rastreio", auto: "codigoRastreio" },
    ],
    body: `💬 *Atualização de Projeto — Logística de Material*

Olá, {{nome}}! ☀️

O material do projeto já foi enviado e está em trânsito.

A previsão de entrega informada é até {{data}}.
Código de rastreio: {{rastreio}}

Assim que houver confirmação final da transportadora, avisamos por aqui. ⚡`,
  },
  {
    code: "LOG-04",
    categoria: "Logística / Equipamentos",
    nome: "Confirmação de data de entrega",
    quandoUsar: "Transportadora informou a data",
    publico: "cliente",
    vars: [
      NOME,
      { key: "data", label: "Data da entrega" },
      { key: "contato", label: "Contato da transportadora", auto: "transportadora" },
    ],
    body: `💬 *Atualização de Projeto — Entrega de Material*

Olá, {{nome}}! ☀️

Gostaríamos de confirmar a entrega do material para {{data}}.

O equipamento será enviado por transportadora e não há horário exato definido, pois eles seguem a rota do dia. O motorista normalmente entra em contato antes de chegar.

📌 Pedimos, por favor:

* que haja uma pessoa no local para receber
* que sejam feitas fotos e vídeos do material no momento da entrega
* que o material seja armazenado em local seco e seguro

📞 Contato da transportadora: {{contato}}

Qualquer dúvida, seguimos à disposição. ⚡`,
  },
  {
    code: "LOG-05",
    categoria: "Logística / Equipamentos",
    nome: "Confirmação de entrega realizada",
    quandoUsar: "Material entregue",
    publico: "cliente",
    vars: [NOME],
    body: `💬 *Atualização de Projeto — Material Entregue*

Olá, {{nome}}! ☀️

Confirmamos que o material do projeto foi entregue ✅

Agora seguimos para o planejamento da montagem e, em breve, retornaremos com as informações da execução.

Seguimos à disposição! ⚡`,
  },
  {
    code: "LOG-06",
    categoria: "Logística / Equipamentos",
    nome: "Divergência / avaria no material",
    quandoUsar: "Item veio com defeito ou faltando",
    publico: "cliente",
    vars: [NOME, { key: "item", label: "Item com divergência", multiline: true }],
    body: `💬 *Atualização de Projeto — Ajuste de Material*

Olá, {{nome}}! ☀️

Durante a conferência do material, identificamos uma divergência no seguinte item: {{item}}.

Já acionamos o fornecedor/distribuidora para providenciar a substituição/correção, e estamos acompanhando esse processo.

Se for possível, seguiremos com as demais etapas sem comprometer o cronograma. Qualquer novidade informamos por aqui. ⚡`,
  },

  // ─── 05. Planejamento / Execução ────────────────────────────────────────────
  {
    code: "EXE-01",
    categoria: "Planejamento / Execução",
    nome: "Planejamento da montagem",
    quandoUsar: "Material chegou, equipe organizando",
    publico: "cliente",
    vars: [NOME],
    body: `💬 *Atualização de Projeto — Planejamento de Montagem*

Olá, {{nome}}! ☀️

Agora vamos iniciar o planejamento da montagem do sistema.

Nossa equipe está organizando a execução e, em breve, retornaremos com a data programada para início da obra. ⚡`,
  },
  {
    code: "EXE-02",
    categoria: "Planejamento / Execução",
    nome: "Agendamento da montagem",
    quandoUsar: "Data definida",
    publico: "cliente",
    vars: [NOME, { key: "data", label: "Data" }, { key: "horario", label: "Horário" }],
    body: `💬 *Atualização de Projeto — Agendamento de Montagem*

Olá, {{nome}}! ☀️

Vamos seguir para a montagem do sistema, agendada para {{data}}, com início previsto para {{horario}}.

Em breve enviaremos também os dados da equipe e as orientações gerais para o dia do serviço. ⚡`,
  },
  {
    code: "EXE-03",
    categoria: "Planejamento / Execução",
    nome: "Confirmação da equipe / instruções gerais",
    quandoUsar: "Antes da execução",
    publico: "cliente",
    vars: [
      NOME,
      { key: "data", label: "Data" },
      { key: "horario", label: "Horário" },
      { key: "equipe", label: "Equipe responsável", auto: "equipe", multiline: true },
      { key: "tempo", label: "Duração prevista" },
    ],
    body: `💬 *Confirmação de Serviço — Execução da Montagem*

Olá, {{nome}}! ☀️

Confirmamos a execução do serviço para {{data}}, com início às {{horario}}.

👷 Equipe responsável:
{{equipe}}

📌 Observações importantes:

* É importante que haja uma pessoa no local
* O serviço pode durar {{tempo}}
* Caso surja alguma necessidade técnica adicional, entraremos em contato

Seguimos à disposição! ⚡`,
  },
  {
    code: "EXE-04",
    categoria: "Planejamento / Execução",
    nome: "Início da execução",
    quandoUsar: "Equipe começou a obra",
    publico: "cliente",
    vars: [
      NOME,
      { key: "tecnico", label: "Responsável técnico no local" },
      { key: "contatoTecnico", label: "CPF / contato do técnico" },
    ],
    body: `💬 *Atualização de Projeto — Fase de Execução*

Olá, {{nome}}! ☀️

Confirmamos que a equipe já deu início à execução do serviço.

👷 Responsável técnico no local:
{{tecnico}}
{{contatoTecnico}}

Seguimos acompanhando a execução e qualquer novidade informamos por aqui. ⚡`,
  },
  {
    code: "EXE-05",
    categoria: "Planejamento / Execução",
    nome: "Update de obra em andamento",
    quandoUsar: "Obra em curso",
    publico: "cliente",
    vars: [NOME, { key: "status", label: "Status atual", multiline: true }],
    body: `💬 *Atualização de Projeto — Execução em Andamento*

Olá, {{nome}}! ☀️

Passando para atualizar que a execução do sistema segue em andamento.

📌 Status atual: {{status}}

Seguimos acompanhando tudo de perto e informaremos os próximos passos por aqui. ⚡`,
  },
  {
    code: "EXE-06",
    categoria: "Planejamento / Execução",
    nome: "Execução concluída",
    quandoUsar: "Montagem finalizada",
    publico: "cliente",
    vars: [NOME],
    body: `💬 *Atualização de Projeto — Execução Concluída*

Olá, {{nome}}! ☀️

Informamos que a execução do sistema foi concluída com sucesso ✅

Agora seguimos para a fase de ativação, com a solicitação da troca de medidor/liberação junto à {{concessionaria}}.

Assim que houver atualização, informaremos por aqui. ⚡`,
  },
  {
    code: "EXE-07",
    categoria: "Planejamento / Execução",
    nome: "Pendências pós-montagem",
    quandoUsar: "Ficou algo faltando",
    publico: "cliente",
    vars: [NOME, { key: "pendencias", label: "Pendências (uma por linha)", multiline: true }],
    body: `💬 *Atualização de Projeto — Pendências em Andamento*

Olá, {{nome}}! ☀️

A montagem do sistema foi realizada, porém ainda temos algumas pendências em andamento para o encerramento completo do projeto:

{{pendencias}}

Assim que esses pontos forem concluídos, finalizaremos oficialmente o projeto. ⚡`,
  },

  // ─── 06. Ativação ───────────────────────────────────────────────────────────
  {
    code: "ATV-01",
    categoria: "Ativação",
    nome: "Solicitação de ativação / troca de medidor",
    quandoUsar: "Execução finalizada",
    publico: "cliente",
    vars: [NOME, { key: "prazo", label: "Prazo informado" }],
    body: `💬 *Atualização de Projeto — Fase de Ativação*

Olá, {{nome}}! ☀️

Já demos entrada na solicitação de ativação/troca do medidor junto à {{concessionaria}}.

Agora estamos aguardando o prazo da concessionária para concluir essa etapa.

Prazo informado: {{prazo}}

Assim que houver retorno, atualizamos por aqui. ⚡`,
  },
  {
    code: "ATV-02",
    categoria: "Ativação",
    nome: "Update de ativação",
    quandoUsar: "Ativação em andamento",
    publico: "cliente",
    vars: [NOME],
    body: `💬 *Atualização de Projeto — Ativação*

Olá, {{nome}}! ☀️

Seu projeto está na fase de ativação e seguimos aguardando o retorno da {{concessionaria}} para conclusão do processo.

Assim que a concessionária liberar, daremos sequência ao monitoramento e treinamento. ⚡`,
  },
  {
    code: "ATV-03",
    categoria: "Ativação",
    nome: "Pendência de ativação",
    quandoUsar: "A concessionária exigiu algo na vistoria",
    publico: "cliente",
    vars: [NOME, { key: "exigencia", label: "Exigência", multiline: true }],
    body: `💬 *Atualização de Projeto — Pendência de Ativação*

Olá, {{nome}}! ☀️

Durante a vistoria/etapa de ativação, a {{concessionaria}} sinalizou a necessidade do seguinte ajuste:

📌 {{exigencia}}

Assim que esse ponto for resolvido, a concessionária poderá concluir a ativação do sistema.

Seguimos acompanhando e atualizando você por aqui. ⚡`,
  },
  {
    code: "ATV-04",
    categoria: "Ativação",
    nome: "Sistema ativado",
    quandoUsar: "Sistema já está gerando",
    publico: "cliente",
    vars: [
      NOME,
      { key: "linkApp", label: "Link do app de monitoramento", auto: "linkMonitoramento" },
      { key: "login", label: "Login" },
      { key: "senha", label: "Senha" },
      { key: "agenda", label: "Link da agenda de treinamento" },
    ],
    body: `💬 *Atualização de Projeto — Sistema Ativado*

Olá, {{nome}}! ☀️🎉

Seu sistema solar já está ativo e gerando energia ✅

Agora vamos seguir para a fase de monitoramento e treinamento.

📱 Aplicativo: {{linkApp}}
Login: {{login}}
Senha: {{senha}}

Para agendar o treinamento, segue o link:
🔗 {{agenda}}

Qualquer dúvida, seguimos à disposição! ⚡`,
  },

  // ─── 07. Monitoramento / Treinamento ────────────────────────────────────────
  {
    code: "MON-01",
    categoria: "Monitoramento / Treinamento",
    nome: "Agendamento de treinamento",
    quandoUsar: "Após a ativação",
    publico: "cliente",
    vars: [NOME, { key: "agenda", label: "Link da agenda" }],
    body: `💬 *Atualização de Projeto — Treinamento*

Olá, {{nome}}! ☀️

Agora que seu sistema já está ativo, vamos agendar um momento para realizar o treinamento de monitoramento, explicar como acompanhar a geração e encerrar o projeto da melhor forma.

🔗 {{agenda}}

Ficamos à disposição! ⚡`,
  },
  {
    code: "MON-02",
    categoria: "Monitoramento / Treinamento",
    nome: "Treinamento realizado",
    quandoUsar: "Após a reunião de treinamento",
    publico: "cliente",
    vars: [NOME],
    body: `💬 *Atualização de Projeto — Treinamento Concluído*

Olá, {{nome}}! ☀️

Confirmamos a realização do treinamento de monitoramento ✅

Agora você já pode acompanhar a geração do sistema e consultar os principais dados de forma prática.

Sempre que surgir qualquer dúvida, estamos à disposição. ⚡`,
  },
  {
    code: "MON-03",
    categoria: "Monitoramento / Treinamento",
    nome: "Problema de monitoramento",
    quandoUsar: "App sem dados, micros sem internet",
    publico: "cliente",
    vars: [NOME, { key: "problema", label: "Problema identificado", multiline: true }],
    body: `💬 *Atualização de Projeto — Monitoramento*

Olá, {{nome}}! ☀️

Identificamos um ponto no monitoramento do sistema: {{problema}}.

Isso não significa necessariamente falha na geração, mas sim uma limitação de comunicação/dados.

Já estamos tratando a correção e, assim que ajustarmos, atualizamos você por aqui. ⚡`,
  },

  // ─── 08. Encerramento ───────────────────────────────────────────────────────
  {
    code: "ENC-01",
    categoria: "Encerramento",
    nome: "Encerramento de projeto",
    quandoUsar: "Projeto finalizado",
    publico: "cliente",
    vars: [
      NOME,
      { key: "linkApp", label: "Link do app", auto: "linkMonitoramento" },
      { key: "linkIndicacao", label: "Link de indicação" },
      { key: "linkGoogle", label: "Link de avaliação no Google" },
    ],
    body: `💬 *Encerramento de Projeto — Solo Energia*

Olá, {{nome}}! ☀️⚡

Gostaríamos de informar que o seu projeto foi concluído com sucesso e o sistema já está ativo e gerando energia.

Você já pode acompanhar tudo pelo aplicativo:
🔗 {{linkApp}}

Caso precise de treinamento adicional ou tenha qualquer dúvida, seguimos à disposição.

Também deixamos aqui nosso link de indicação:
{{linkIndicacao}}

E o link/QR Code para avaliação no Google:
{{linkGoogle}}

Agradecemos pela confiança e seguimos como seu parceiro para suporte, melhorias e futuras expansões. 🚀`,
  },
  {
    code: "ENC-02",
    categoria: "Encerramento",
    nome: "Solicitação de avaliação no Google",
    quandoUsar: "Após a conclusão",
    publico: "cliente",
    vars: [NOME, { key: "linkGoogle", label: "Link do Google" }],
    body: `💬 *Avaliação — Solo Energia*

Olá, {{nome}}! ☀️

Se puder, pedimos sua ajuda com uma avaliação da Solo Energia no Google. Isso é muito importante para fortalecer o nosso trabalho e alcançar mais pessoas.

🔗 {{linkGoogle}}

Muito obrigado pela confiança! ⚡`,
  },
  {
    code: "ENC-03",
    categoria: "Encerramento",
    nome: "Programa de indicação",
    quandoUsar: "Após a conclusão",
    publico: "cliente",
    vars: [NOME, { key: "linkIndicacao", label: "Link de indicação" }],
    body: `💬 *Programa de Indicação — Solo Energia*

Olá, {{nome}}! ☀️

Se conhecer alguém que também tenha interesse em energia solar, você pode indicar diretamente pelo link abaixo:

🔗 {{linkIndicacao}}

Nossa equipe acompanha tudo e mantém você atualizado sobre o processo. ⚡`,
  },

  // ─── 09. Pós-venda / Suporte ────────────────────────────────────────────────
  {
    code: "SUP-01",
    categoria: "Pós-venda / Suporte",
    nome: "Explicação de conta de energia",
    quandoUsar: "Cliente mandou a conta",
    publico: "cliente",
    vars: [NOME, { key: "resumo", label: "Resumo da análise", multiline: true }],
    body: `💬 *Análise da Conta de Energia*

Olá, {{nome}}! ☀️

Analisamos sua conta e a compensação da energia solar está ocorrendo normalmente.

{{resumo}}

Caso queira, podemos também orientar sobre formas de otimizar o consumo e extrair ainda mais economia do sistema. ⚡`,
  },
  {
    code: "SUP-02",
    categoria: "Pós-venda / Suporte",
    nome: "Abertura de suporte técnico",
    quandoUsar: "Cliente relatou um problema",
    publico: "cliente",
    vars: [NOME, { key: "problema", label: "Problema relatado", multiline: true }],
    body: `💬 *Suporte Técnico — Abertura de Atendimento*

Olá, {{nome}}! ☀️

Recebemos seu relato sobre {{problema}} e já estamos acompanhando o caso.

Em breve retornaremos com o diagnóstico e os próximos passos.

Seguimos à disposição. ⚡`,
  },
  {
    code: "SUP-03",
    categoria: "Pós-venda / Suporte",
    nome: "Confirmação de visita de manutenção / suporte",
    quandoUsar: "Agendar suporte",
    publico: "cliente",
    vars: [
      NOME,
      { key: "data", label: "Data" },
      { key: "horario", label: "Horário" },
      { key: "equipe", label: "Equipe responsável", auto: "equipe", multiline: true },
    ],
    body: `💬 *Confirmação de Serviço — Suporte / Manutenção*

Olá, {{nome}}! ☀️

Confirmamos o agendamento do serviço para {{data}}, com início às {{horario}}.

👷 Equipe responsável:
{{equipe}}

Pedimos que haja alguém no local para acompanhar o atendimento.

Seguimos à disposição! ⚡`,
  },
  {
    code: "SUP-04",
    categoria: "Pós-venda / Suporte",
    nome: "Conclusão de suporte / manutenção",
    quandoUsar: "Serviço concluído",
    publico: "cliente",
    vars: [NOME, { key: "valor", label: "Valor do serviço" }, { key: "link", label: "Link de pagamento" }],
    body: `💬 *Conclusão de Serviço*

Olá, {{nome}}! ☀️

Segue o relatório do serviço realizado conforme alinhado.

💰 Valor do serviço: {{valor}}
🔗 Link para pagamento: {{link}}

Qualquer dúvida, seguimos à disposição! ⚡`,
  },
  {
    code: "SUP-05",
    categoria: "Pós-venda / Suporte",
    nome: "Lembrete de pagamento de serviço",
    quandoUsar: "Cliente ainda não pagou",
    publico: "cliente",
    vars: [NOME, { key: "valor", label: "Valor" }, { key: "link", label: "Link de pagamento" }],
    body: `💬 *Lembrete — Pagamento de Serviço*

Olá, {{nome}}! ☀️

Passando para lembrar sobre o pagamento do serviço realizado.

💰 Valor: {{valor}}
🔗 Link para pagamento: {{link}}

Qualquer dúvida, seguimos à disposição! ⚡`,
  },

  // ─── Equipe (instalação e homologação) ──────────────────────────────────────
  // Não estão na biblioteca de CX porque o público é interno, mas o fluxo é o
  // mesmo: escolher template, ajustar, mandar no grupo da equipe.
  {
    code: "EQP-01",
    categoria: "Planejamento / Execução",
    nome: "Equipe — Convocação de serviço",
    quandoUsar: "Serviço designado à equipe de instalação",
    publico: "equipe",
    vars: [
      { key: "cliente", label: "Cliente", auto: "nomeCliente" },
      { key: "potencia", label: "Potência", auto: "potencia" },
      { key: "endereco", label: "Endereço", auto: "cidadeUf" },
      { key: "data", label: "Data" },
      { key: "horario", label: "Horário" },
      { key: "escopo", label: "Escopo do serviço", multiline: true },
    ],
    body: `🔧 *Solo Energia* | Convocação de Serviço

Cliente: *{{cliente}}*
Usina: {{potencia}}
Local: {{endereco}}

📅 Data: {{data}}
⏰ Início: {{horario}}

📌 Escopo:
{{escopo}}

Confirmem por aqui, por favor. Qualquer necessidade técnica adicional, avisem antes do deslocamento. ⚡`,
  },
  {
    code: "EQP-02",
    categoria: "Planejamento / Execução",
    nome: "Equipe — Cobrança de fotos e checklist",
    quandoUsar: "Obra concluída sem os registros",
    publico: "equipe",
    vars: [{ key: "cliente", label: "Cliente", auto: "nomeCliente" }],
    body: `🔧 *Solo Energia* | Registros pendentes

Obra do cliente *{{cliente}}*.

Faltam os registros para fecharmos o serviço:

* Fotos da instalação (módulos, inversor, quadro, aterramento)
* Checklist de comissionamento preenchido
* Foto do medidor

Pedimos o envio por aqui, por favor. Sem esses itens não conseguimos dar entrada na ativação. ⚡`,
  },
  {
    code: "EQP-03",
    categoria: "Homologação",
    nome: "Homologação — Cobrança de andamento",
    quandoUsar: "Processo parado na concessionária",
    publico: "equipe",
    vars: [
      { key: "cliente", label: "Cliente", auto: "nomeCliente" },
      { key: "protocolo", label: "Nº da solicitação" },
    ],
    body: `📋 *Solo Energia* | Andamento da homologação

Cliente: *{{cliente}}*
Solicitação: {{protocolo}}
Concessionária: {{concessionaria}}

Podem atualizar o status do processo por aqui? Precisamos saber se há alguma pendência aberta para acionarmos o cliente. ⚡`,
  },
];

export const TEMPLATE_BY_CODE = new Map(NOTIFICATION_TEMPLATES.map((t) => [t.code, t]));

/** Contexto do projeto que alimenta os `auto` das variáveis. */
export type TemplateContext = Partial<Record<AutoFill, string>>;

/**
 * Troca `{{chave}}` pelos valores. Placeholder sem valor fica como `[chave]`,
 * bem visível: é melhor o operador ver o buraco no preview do que mandar
 * "no valor de undefined" para o cliente.
 */
export function renderTemplate(body: string, values: Record<string, string | undefined>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_full, key: string) => {
    const v = values[key];
    return v != null && v.trim() !== "" ? v.trim() : `[${key}]`;
  });
}

/** Valores iniciais de um template: cada var pega o `auto` correspondente. */
export function initialValues(
  template: NotificationTemplate,
  ctx: TemplateContext,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const v of template.vars) out[v.key] = (v.auto ? ctx[v.auto] : "") ?? "";
  return out;
}

/**
 * `concessionaria` aparece no corpo de vários templates sem estar declarada como
 * variável editável — vem sempre do projeto, com "Enel" como padrão do Ceará.
 */
export function contextDefaults(ctx: TemplateContext): Record<string, string> {
  return { concessionaria: ctx.concessionaria ?? "Enel" };
}

// ─── Variáveis derivadas do corpo ─────────────────────────────────────────────
// Na biblioteca editável, ninguém cadastra variável: o que vale é `{{chave}}` no
// texto. Uma lista mantida à parte uma hora divergiria do corpo — e aí o campo
// apareceria no formulário sem ir para a mensagem, ou a mensagem sairia com um
// buraco sem ter onde preencher.

/** Chaves que o corpo pode usar sem virar campo — vêm do projeto. */
export const CHAVES_DE_CONTEXTO = new Set(["concessionaria"]);

/** Extrai `{{chave}}` do corpo, na ordem em que aparecem, sem repetir. */
export function extrairChaves(body: string): string[] {
  const achadas = [...body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  return [...new Set(achadas)].filter((k) => !CHAVES_DE_CONTEXTO.has(k));
}

/**
 * Variável com `auto` solto como texto: é assim que ela volta do banco, onde a
 * biblioteca editável mora. `TemplateVar` (com AutoFill) encaixa aqui.
 */
export interface TemplateVarLike {
  key: string;
  label: string;
  auto?: string;
  multiline?: boolean;
}

/**
 * Reconcilia a lista de variáveis com o corpo: mantém rótulo e `auto` do que já
 * existia, cria o que apareceu, descarta o que saiu do texto.
 */
export function reconciliarVars(
  body: string,
  anteriores: TemplateVarLike[] = [],
): TemplateVarLike[] {
  const porChave = new Map(anteriores.map((v) => [v.key, v]));
  return extrairChaves(body).map((key) => porChave.get(key) ?? { key, label: rotuloPadrao(key) });
}

/** "linkFormulario" -> "Link formulario". Ponto de partida; o usuário ajusta. */
export function rotuloPadrao(key: string): string {
  const comEspaco = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return comEspaco.charAt(0).toUpperCase() + comEspaco.slice(1).toLowerCase();
}
