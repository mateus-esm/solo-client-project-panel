/**
 * Leitura do webhook de negócio ganho do pipeline comercial (Jestor).
 *
 * Módulo puro de propósito: o corpo que chega é hostil (campos nulos, números
 * como string, chave de ID com nome dinâmico, embrulho do n8n), e toda essa
 * defesa precisa ser testável sem banco.
 *
 * O que o corpo real traz — e o que isso obriga:
 *
 * - `oportunidade` pode vir inteira nula (negócio ganho sem proposta vinculada).
 *   Nada aqui pode assumir que ela existe.
 * - `email` do card vem `""` enquanto `lead.email` está preenchido. Daí as
 *   cadeias de fallback: card → lead → oportunidade.
 * - `subtotal_de_produtos: "0.0000000000"` — número é string.
 * - A chave do ID é `id_<table_id>`, que muda por tabela. Resolvemos por prefixo.
 */

/** Campos que o Jestor manda como texto vazio, literal nulo ou array serializado. */
const VAZIOS = new Set(["", "null", "undefined", "[]", "{}", "-"]);

/**
 * Normaliza qualquer campo de texto do Jestor.
 * Devolve null para tudo que não é conteúdo real — inclusive token `{{campo}}`
 * não substituído, que aparece quando o corpo é montado à mão no Jestor e o
 * campo não existe no registro.
 */
export function texto(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "boolean") return null;
  const s = String(v).trim();
  if (VAZIOS.has(s.toLowerCase())) return null;
  if (/^\{\{.*\}\}$/.test(s)) return null;
  return s;
}

/**
 * Grupos de exatamente três dígitos separados por ponto: "4.200", "90.000",
 * "1.234.567". É milhar brasileiro digitado à mão — nunca um número nativo do
 * Jestor, que serializa com dez casas decimais ("1000.0000000000").
 */
const MILHAR_BR = /^-?\d{1,3}(\.\d{3})+$/;

/**
 * Número vindo como string, em formato americano ("0.0000000000") ou brasileiro
 * ("R$ 45.000,00"). A vírgula é o desempate: se existe, ela é o decimal e o
 * ponto é milhar. Sem vírgula, o ponto é decimal — salvo quando o formato é
 * milhar brasileiro inequívoco, porque ler "4.200 kWh" como 4,2 erra por mil.
 */
export function numero(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = texto(v);
  if (s == null) return null;

  let limpo = s.replace(/[^0-9.,-]/g, "");
  if (limpo === "" || limpo === "-") return null;

  if (limpo.includes(",")) {
    limpo = limpo.replace(/\./g, "").replace(",", ".");
  } else if (MILHAR_BR.test(limpo)) {
    limpo = limpo.replace(/\./g, "");
  }

  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

/**
 * O ID do registro. A chave é `id_<table_id>` e o table_id muda por tabela, então
 * procuramos pelo prefixo em vez de fixar o nome — que foi o que quebrou o
 * primeiro rascunho deste contrato.
 */
export function idDoRegistro(obj: unknown): string | null {
  if (obj == null || typeof obj !== "object") return null;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (!k.startsWith("id_")) continue;
    // `id_user`, `id_org`, `id_profile` e `id_soloapp` são campos de negócio,
    // não a chave primária do registro.
    if (k === "id_user" || k === "id_org" || k === "id_profile" || k === "id_soloapp") continue;
    const s = texto(v);
    if (s != null) return s;
  }
  return null;
}

/** Primeiro valor com conteúdo, na ordem de confiança dada. */
function primeiro(...vs: unknown[]): string | null {
  for (const v of vs) {
    const s = texto(v);
    if (s != null) return s;
  }
  return null;
}

function primeiroNumero(...vs: unknown[]): number | null {
  for (const v of vs) {
    const n = numero(v);
    if (n != null) return n;
  }
  return null;
}

function objeto(v: unknown): Record<string, unknown> {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

/**
 * Descasca o corpo até o objeto do Jestor.
 *
 * Aceita as três formas em que ele chega: direto do Jestor
 * (`{event, data}`), repassado pelo n8n (`[{ body: {event, data} }]`) e o
 * corpo de um nó de teste (`{ body: {...} }`). Tolerar as três custa dez
 * linhas e evita que trocar o roteamento quebre a integração.
 */
export function desembrulhar(raw: unknown): Record<string, unknown> {
  let atual: unknown = raw;
  for (let i = 0; i < 4; i++) {
    if (Array.isArray(atual)) {
      atual = atual[0];
      continue;
    }
    const o = objeto(atual);
    if (o.body !== undefined && o.event === undefined) {
      atual = o.body;
      continue;
    }
    return o;
  }
  return objeto(atual);
}

export interface NegocioGanho {
  dealId: string;
  dealName: string | null;
  evento: string | null;
  estagio: string | null;
  cliente: {
    nome: string | null;
    cpfCnpj: string | null;
    email: string | null;
    telefone: string | null;
    canalCaptacao: string | null;
    soloappId: string | null;
  };
  indicacao: { nome: string; telefone: string | null } | null;
  contrato: {
    valor: number | null;
    condicoesPagamento: string | null;
    comissaoEsperada: number | null;
    comissaoFixa: number | null;
    linkProposta: string | null;
    linkContrato: string | null;
    observacoes: string | null;
    dataFechamento: string | null;
  };
  instalacao: {
    endereco: string | null;
    concessionaria: string | null;
    consumoMedioKwh: number | null;
  };
  sistema: {
    moduloFabricante: string | null;
    moduloPotenciaW: number | null;
    moduloQuantidade: number | null;
    inversorFabricante: string | null;
    inversorPotenciaKw: number | null;
    inversorQuantidade: number | null;
    tipoEstrutura: string | null;
    tipoMonitoramento: string | null;
    /** Derivada: módulos × potência do módulo. Não vem no payload. */
    potenciaKwp: number | null;
  };
  consultor: { nome: string | null; email: string | null; telefone: string | null };
}

/** kWp do sistema a partir da ficha de módulos — um campo a menos para o vendedor errar. */
export function potenciaKwp(potenciaModuloW: number | null, quantidade: number | null): number | null {
  if (!potenciaModuloW || !quantidade) return null;
  return Math.round((potenciaModuloW * quantidade) / 10) / 100;
}

export type LeituraFalha = { ok: false; motivo: string };
export type LeituraOk = { ok: true; negocio: NegocioGanho; data: Record<string, unknown> };

/**
 * Lê o corpo do webhook. Nunca lança: devolve o motivo para a rota responder
 * algo que o log do Jestor deixe entender sem abrir o servidor.
 */
export function lerNegocioGanho(raw: unknown): LeituraOk | LeituraFalha {
  const corpo = desembrulhar(raw);
  const evento = texto(corpo.event);
  const data = objeto(corpo.data);

  if (Object.keys(data).length === 0) {
    return { ok: false, motivo: "Corpo sem o objeto `data` do registro" };
  }

  const dealId = idDoRegistro(data);
  if (dealId == null) {
    return { ok: false, motivo: "Não foi possível identificar o ID do card (campo `id_<tabela>`)" };
  }

  const lead = objeto(data.lead);
  const oportunidade = objeto(data.oportunidade);
  const responsavel = objeto(data.responsavel);

  const dealName = primeiro(data.name);

  const indicadoPor = primeiro(lead.quem_esta_indicando);

  const moduloPotenciaW = primeiroNumero(
    // O campo mudou de nome entre versões do formulário de proposta.
    oportunidade.potencia_do_modulo_w,
    oportunidade.potencia_modulo_w,
  );
  const moduloQuantidade = primeiroNumero(oportunidade.numero_de_modulos);

  const negocio: NegocioGanho = {
    dealId,
    dealName,
    evento,
    estagio: primeiro(data.estagio),
    cliente: {
      nome: primeiro(oportunidade.nome_do_cliente, data.contato, dealName, lead.name),
      cpfCnpj: primeiro(oportunidade.cpfcnpj),
      email: primeiro(data.email, lead.email),
      telefone: primeiro(data.telefone, lead.telefone),
      canalCaptacao: primeiro(lead.canal_de_captacao, data.fonte),
      soloappId: primeiro(lead.id_soloapp),
    },
    indicacao: indicadoPor
      ? { nome: indicadoPor, telefone: primeiro(lead.seu_telefone) }
      : null,
    contrato: {
      valor: primeiroNumero(data.valor_da_oportunidade, oportunidade.preco_total_do_sistema_r),
      condicoesPagamento: primeiro(oportunidade.condicoes_de_pagamento),
      comissaoEsperada: primeiroNumero(data.comissao_esperada),
      comissaoFixa: primeiroNumero(data.comissao_fixa),
      linkProposta: primeiro(data.link_da_proposta, oportunidade.link_do_pdf),
      linkContrato: primeiro(data.link_do_contrato),
      observacoes: primeiro(data.observacoes, lead.observacoes),
      dataFechamento: primeiro(data.data_de_fechamento),
    },
    instalacao: {
      endereco: primeiro(oportunidade.endereco_de_instalacao),
      concessionaria: primeiro(oportunidade.concessionaria),
      consumoMedioKwh: primeiroNumero(oportunidade.consumo_medio_mensal),
    },
    sistema: {
      moduloFabricante: primeiro(oportunidade.fabricante_modulo),
      moduloPotenciaW,
      moduloQuantidade,
      inversorFabricante: primeiro(oportunidade.fabricante_inversor),
      inversorPotenciaKw: primeiroNumero(oportunidade.potencia_do_inversor_kw),
      inversorQuantidade: primeiroNumero(oportunidade.quantidade_de_inversores),
      tipoEstrutura: primeiro(oportunidade.tipo_de_estrutura),
      tipoMonitoramento: primeiro(oportunidade.tipo_de_monitoramento),
      potenciaKwp: potenciaKwp(moduloPotenciaW, moduloQuantidade),
    },
    consultor: {
      // O `responsavel` é o dono do card no CRM e vem sempre; o consultor da
      // proposta é preenchido à mão e falta com frequência.
      nome: primeiro(oportunidade.nome_do_consultor, responsavel.display_name, responsavel.name),
      email: primeiro(oportunidade.email_do_consultor, responsavel.email),
      telefone: primeiro(
        oportunidade.telefone_do_consultor,
        responsavel.whatsapp,
        responsavel.phone,
      ),
    },
  };

  return { ok: true, negocio, data };
}

/**
 * Há ficha técnica suficiente para abrir a usina?
 *
 * Sem isto, todo negócio ganho sem proposta vinculada criaria uma linha vazia em
 * `plants` — e a tela de usinas passaria a listar fantasmas.
 */
export function temFichaDeUsina(n: NegocioGanho): boolean {
  const { instalacao, sistema } = n;
  return Boolean(
    instalacao.endereco ||
      instalacao.concessionaria ||
      instalacao.consumoMedioKwh ||
      sistema.moduloFabricante ||
      sistema.moduloQuantidade ||
      sistema.inversorFabricante ||
      sistema.inversorPotenciaKw ||
      sistema.potenciaKwp,
  );
}
