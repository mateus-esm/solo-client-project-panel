import { describe, it, expect } from "vitest";
import {
  texto,
  numero,
  idDoRegistro,
  desembrulhar,
  potenciaKwp,
  lerNegocioGanho,
  temFichaDeUsina,
} from "../sales-payload";

// Corpo real capturado do Jestor em 2026-08-14 (planning/sprint_5.md), incluindo
// o embrulho do n8n. Reduzido nos objetos de usuário, que são só ruído — mas com
// todos os campos que a leitura consulta, e com a `oportunidade` nula como veio.
const PAYLOAD_REAL = [
  {
    headers: { host: "72.61.219.156:5678", "user-agent": "Jestor-Core/1.0" },
    params: {},
    query: {},
    body: {
      event: "deal_won",
      button: "ganho!",
      table_id: "b378a15_e431f4fa_a8c725a0_j1hon6d8x9td47wi9mp9a",
      triggered_by: { id_user: 1, id_profile: 10001, name: "Mateus Sombra" },
      data: {
        id_ab378a15_e431f4fa_a8c725a0_j1hon6d8x9td47wi9mp9a: 1431,
        name: "mateus teste",
        criado_em: "2026-08-14T23:40:23+00:00",
        empresa: null,
        contato: null,
        valor_da_oportunidade: null,
        probabilidade_de_fechamento: null,
        estagio: "Ganho",
        data_de_fechamento: "2026-08-14",
        responsavel: {
          id_user: 18,
          id_org: 1,
          email: "luizhenriqueteixeira@hotmail.com",
          name: "luizhenriqueteixeira@hotmail.com",
          display_name: "luizhenriqueteixeira@hotmail.com",
          whatsapp: null,
          phone: null,
        },
        email: "",
        proposta: "[]",
        contrato: "[]",
        observacoes: "",
        telefone: "85 99815-3923",
        fonte: "Tráfego Pago",
        lead: {
          id_ab378a15_e431f4fa_a8c725a0_vccj8t1_90haco9re6urh: 1468,
          name: "mateus teste",
          email: "mateussmaia95@hotmail.com",
          telefone: "85 99815-3923",
          canal_de_captacao: "Tráfego Pago",
          quem_esta_indicando: null,
          seu_telefone: null,
          observacoes: null,
          status: null,
          id_soloapp: null,
        },
        oportunidade: {
          id_w13noi_k44se96www0fcz: null,
          name: null,
          nome_do_cliente: null,
          cpfcnpj: null,
          endereco_de_instalacao: null,
          concessionaria: null,
          nome_do_consultor: null,
          email_do_consultor: null,
          telefone_do_consultor: null,
          fabricante_modulo: null,
          potencia_do_modulo_w: null,
          numero_de_modulos: null,
          fabricante_inversor: null,
          potencia_do_inversor_kw: null,
          tipo_de_estrutura: null,
          tipo_de_monitoramento: null,
          preco_total_do_sistema_r: null,
          status_da_proposta: null,
          link_do_pdf: null,
          consumo_medio_mensal: null,
          condicoes_de_pagamento: null,
          quantidade_de_inversores: null,
        },
        link_da_proposta: null,
        link_do_contrato: null,
        subtotal_de_produtos: "0.0000000000",
        subtotal_de_servicos: "0.0000000000",
        comissao_fixa: null,
        comissao_esperada: null,
      },
    },
    webhookUrl: "http://72.61.219.156:5678/webhook/e8fa1d22",
    executionMode: "production",
  },
];

/** Negócio completo: proposta vinculada, indicação e valores preenchidos. */
const PAYLOAD_COMPLETO = {
  event: "deal_won",
  table_id: "b378a15_e431f4fa_a8c725a0_j1hon6d8x9td47wi9mp9a",
  data: {
    id_ab378a15_e431f4fa_a8c725a0_j1hon6d8x9td47wi9mp9a: 1500,
    name: "Haras BS Chica Doce",
    estagio: "Ganho",
    data_de_fechamento: "2026-08-14",
    email: "financeiro@chicadoce.com.br",
    telefone: "(85) 9 8888-7777",
    fonte: "Indicação",
    observacoes: "Cliente quer começar em setembro",
    valor_da_oportunidade: "R$ 87.500,00",
    comissao_esperada: "4.375,00",
    comissao_fixa: "1000.0000000000",
    link_da_proposta: "https://propostas.soloenergia.com.br/bs-chica-doce",
    link_do_contrato: "https://drive.google.com/contrato-123",
    responsavel: { email: "luiz@soloenergia.com.br", display_name: "Luiz Henrique" },
    lead: {
      id_ab378a15_e431f4fa_a8c725a0_vccj8t1_90haco9re6urh: 1600,
      email: "contato@chicadoce.com.br",
      telefone: "85 98888-7777",
      canal_de_captacao: "Indicação",
      quem_esta_indicando: "Gabriel Menezes",
      seu_telefone: "85 99928-9511",
      id_soloapp: "clt_9912",
    },
    oportunidade: {
      id_w13noi_k44se96www0fcz: 42,
      nome_do_cliente: "Haras BS Chica Doce LTDA",
      cpfcnpj: "12.345.678/0001-90",
      endereco_de_instalacao: "Rod. CE-065, km 12 — Caucaia/CE",
      concessionaria: "Enel CE",
      consumo_medio_mensal: "4.200",
      condicoes_de_pagamento: "Entrada 30% + 12x no boleto",
      nome_do_consultor: "Mateus Sombra",
      email_do_consultor: "mateus@soloenergia.com.br",
      telefone_do_consultor: "85 99815-3923",
      fabricante_modulo: "Canadian Solar",
      potencia_do_modulo_w: "585",
      numero_de_modulos: "90",
      fabricante_inversor: "Growatt",
      potencia_do_inversor_kw: "50",
      quantidade_de_inversores: "1",
      tipo_de_estrutura: "Solo",
      tipo_de_monitoramento: "Growatt ShineServer",
      preco_total_do_sistema_r: "90.000,00",
      link_do_pdf: "https://jestor.io/proposta.pdf",
    },
  },
};

describe("texto", () => {
  it("descarta os vazios que o Jestor manda no lugar de null", () => {
    expect(texto("")).toBeNull();
    expect(texto(null)).toBeNull();
    expect(texto(undefined)).toBeNull();
    expect(texto("[]")).toBeNull();
    expect(texto("{}")).toBeNull();
    expect(texto("null")).toBeNull();
    expect(texto("   ")).toBeNull();
  });
  it("descarta token não substituído de corpo montado à mão", () => {
    expect(texto("{{oportunidade.cpfcnpj}}")).toBeNull();
    expect(texto("{{name}}")).toBeNull();
  });
  it("mantém conteúdo real, sem as bordas", () => {
    expect(texto("  Enel CE  ")).toBe("Enel CE");
    expect(texto(1431)).toBe("1431");
  });
});

describe("numero", () => {
  it("lê o formato americano que o Jestor manda como string", () => {
    expect(numero("0.0000000000")).toBe(0);
    expect(numero("1000.0000000000")).toBe(1000);
  });
  it("lê o formato brasileiro, com ou sem símbolo de moeda", () => {
    expect(numero("R$ 87.500,00")).toBe(87500);
    expect(numero("4.375,00")).toBe(4375);
    expect(numero("1.234,56")).toBe(1234.56);
  });
  it("trata milhar brasileiro sem vírgula como milhar, não como decimal", () => {
    // Ler "4.200 kWh" como 4,2 erraria por mil — grupos de exatamente 3 dígitos
    // são milhar digitado à mão, nunca número nativo do Jestor.
    expect(numero("4.200")).toBe(4200);
    expect(numero("90.000")).toBe(90000);
    expect(numero("1.234.567")).toBe(1234567);
  });
  it("mantém o ponto como decimal quando não é grupo de milhar", () => {
    expect(numero("52.65")).toBe(52.65);
    expect(numero("5.5")).toBe(5.5);
    expect(numero("0.0000000000")).toBe(0);
  });
  it("devolve null para o que não é número", () => {
    expect(numero(null)).toBeNull();
    expect(numero("")).toBeNull();
    expect(numero("a combinar")).toBeNull();
    expect(numero("-")).toBeNull();
  });
  it("aceita número já tipado", () => {
    expect(numero(585)).toBe(585);
    expect(numero(Number.NaN)).toBeNull();
  });
});

describe("idDoRegistro", () => {
  it("acha a chave primária pelo prefixo, apesar do nome dinâmico", () => {
    expect(idDoRegistro({ id_ab378a15_e431f4fa: 1431, name: "x" })).toBe("1431");
    expect(idDoRegistro({ id_w13noi_k44se96www0fcz: 42 })).toBe("42");
  });
  it("ignora os id_* que são campo de negócio, não chave", () => {
    expect(idDoRegistro({ id_user: 18, id_org: 1, id_profile: 79001 })).toBeNull();
    expect(idDoRegistro({ id_soloapp: "clt_99" })).toBeNull();
  });
  it("devolve null quando a chave existe mas está vazia", () => {
    expect(idDoRegistro({ id_w13noi_k44se96www0fcz: null })).toBeNull();
    expect(idDoRegistro(null)).toBeNull();
  });
});

describe("desembrulhar", () => {
  it("atravessa o embrulho do n8n", () => {
    expect(desembrulhar(PAYLOAD_REAL).event).toBe("deal_won");
  });
  it("aceita o corpo direto do Jestor", () => {
    expect(desembrulhar(PAYLOAD_COMPLETO).event).toBe("deal_won");
  });
  it("aceita corpo dentro de body sem array", () => {
    expect(desembrulhar({ body: PAYLOAD_COMPLETO }).event).toBe("deal_won");
  });
  it("não quebra com lixo", () => {
    expect(desembrulhar(null)).toEqual({});
    expect(desembrulhar([])).toEqual({});
    expect(desembrulhar("texto")).toEqual({});
  });
});

describe("potenciaKwp", () => {
  it("deriva kWp de módulos × potência", () => {
    expect(potenciaKwp(585, 90)).toBe(52.65);
    expect(potenciaKwp(550, 20)).toBe(11);
  });
  it("null quando falta qualquer um dos dois", () => {
    expect(potenciaKwp(585, null)).toBeNull();
    expect(potenciaKwp(null, 90)).toBeNull();
    expect(potenciaKwp(585, 0)).toBeNull();
  });
});

describe("lerNegocioGanho — corpo real, oportunidade nula", () => {
  const r = lerNegocioGanho(PAYLOAD_REAL);
  if (!r.ok) throw new Error(r.motivo);
  const { negocio } = r;

  it("identifica o card apesar da chave dinâmica", () => {
    expect(negocio.dealId).toBe("1431");
    expect(negocio.evento).toBe("deal_won");
    expect(negocio.estagio).toBe("Ganho");
  });
  it("cai no lead quando o e-mail do card vem vazio", () => {
    expect(negocio.cliente.email).toBe("mateussmaia95@hotmail.com");
  });
  it("usa o nome do negócio quando a oportunidade não tem cliente", () => {
    expect(negocio.cliente.nome).toBe("mateus teste");
    expect(negocio.cliente.telefone).toBe("85 99815-3923");
    expect(negocio.cliente.canalCaptacao).toBe("Tráfego Pago");
  });
  it("sobrevive à oportunidade inteira nula", () => {
    expect(negocio.cliente.cpfCnpj).toBeNull();
    expect(negocio.instalacao.endereco).toBeNull();
    expect(negocio.sistema.potenciaKwp).toBeNull();
    expect(negocio.contrato.valor).toBeNull();
  });
  it("cai no responsável quando não há consultor na proposta", () => {
    expect(negocio.consultor.email).toBe("luizhenriqueteixeira@hotmail.com");
  });
  it("não inventa indicação nem observação vazia", () => {
    expect(negocio.indicacao).toBeNull();
    expect(negocio.contrato.observacoes).toBeNull();
  });
  it("não abre usina sem nenhuma ficha técnica", () => {
    expect(temFichaDeUsina(negocio)).toBe(false);
  });
});

describe("lerNegocioGanho — negócio completo", () => {
  const r = lerNegocioGanho(PAYLOAD_COMPLETO);
  if (!r.ok) throw new Error(r.motivo);
  const { negocio } = r;

  it("prefere o cliente da proposta ao nome do card", () => {
    expect(negocio.cliente.nome).toBe("Haras BS Chica Doce LTDA");
    expect(negocio.cliente.cpfCnpj).toBe("12.345.678/0001-90");
    expect(negocio.cliente.soloappId).toBe("clt_9912");
  });
  it("prefere o contato do card ao do lead", () => {
    expect(negocio.cliente.email).toBe("financeiro@chicadoce.com.br");
    expect(negocio.cliente.telefone).toBe("(85) 9 8888-7777");
  });
  it("lê a indicação — é o que alimenta a gestão de indicações", () => {
    expect(negocio.indicacao).toEqual({ nome: "Gabriel Menezes", telefone: "85 99928-9511" });
  });
  it("converte dinheiro em número, nos dois formatos", () => {
    expect(negocio.contrato.valor).toBe(87500);
    expect(negocio.contrato.comissaoEsperada).toBe(4375);
    expect(negocio.contrato.comissaoFixa).toBe(1000);
  });
  it("monta a ficha técnica e deriva o kWp", () => {
    expect(negocio.sistema).toMatchObject({
      moduloFabricante: "Canadian Solar",
      moduloPotenciaW: 585,
      moduloQuantidade: 90,
      inversorFabricante: "Growatt",
      inversorPotenciaKw: 50,
      inversorQuantidade: 1,
      tipoEstrutura: "Solo",
      tipoMonitoramento: "Growatt ShineServer",
      potenciaKwp: 52.65,
    });
    expect(temFichaDeUsina(negocio)).toBe(true);
  });
  it("guarda instalação, condições e links", () => {
    expect(negocio.instalacao.consumoMedioKwh).toBe(4200);
    expect(negocio.instalacao.concessionaria).toBe("Enel CE");
    expect(negocio.instalacao.endereco).toContain("Caucaia");
    expect(negocio.contrato.condicoesPagamento).toBe("Entrada 30% + 12x no boleto");
    expect(negocio.contrato.linkContrato).toBe("https://drive.google.com/contrato-123");
    expect(negocio.contrato.dataFechamento).toBe("2026-08-14");
  });
  it("prefere o consultor da proposta ao dono do card", () => {
    expect(negocio.consultor.nome).toBe("Mateus Sombra");
    expect(negocio.consultor.email).toBe("mateus@soloenergia.com.br");
  });
});

describe("lerNegocioGanho — corpos inválidos", () => {
  it("recusa corpo sem data", () => {
    const r = lerNegocioGanho({ event: "deal_won" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("data");
  });
  it("recusa registro sem ID identificável", () => {
    const r = lerNegocioGanho({ event: "deal_won", data: { name: "sem id" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain("ID");
  });
  it("usa o preço do sistema quando o valor do card vem vazio", () => {
    const r = lerNegocioGanho({
      event: "deal_won",
      data: {
        id_abc: 7,
        valor_da_oportunidade: null,
        oportunidade: { preco_total_do_sistema_r: "90.000,00" },
      },
    });
    if (!r.ok) throw new Error(r.motivo);
    expect(r.negocio.contrato.valor).toBe(90000);
  });
});
