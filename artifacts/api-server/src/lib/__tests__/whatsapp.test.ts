import { describe, it, expect } from "vitest";
import { buildGroupSubject, buildGroupSubjectFull, pontuarGrupo } from "../whatsapp-subject";
import {
  NOTIFICATION_TEMPLATES,
  TEMPLATE_BY_CODE,
  renderTemplate,
  initialValues,
} from "../whatsapp-templates";
import { isPlausibleBrazilianPhone, normalizePhone, normalizeGroupJid } from "../whatsmiau";

const MAX = 25;

describe("buildGroupSubject", () => {
  it("mantém o nome inteiro quando cabe nos 25 caracteres", () => {
    expect(buildGroupSubject("Chica Doce", 75, "cliente", MAX)).toBe("Solo | Chica Doce 75 kWp");
  });

  it("nunca ultrapassa o limite do gateway", () => {
    const nomes = [
      "Chica Doce",
      "José Carlos da Silva Neto",
      "Condomínio Residencial Parque das Flores Ltda",
      "Ana",
      "Maria Aparecida",
    ];
    for (const nome of nomes) {
      for (const kind of ["cliente", "instalacao", "homologacao"] as const) {
        for (const potencia of [null, 8, 12.5, 145.6]) {
          const s = buildGroupSubject(nome, potencia, kind, MAX);
          expect(s.length, `${nome} / ${kind} / ${potencia} → "${s}"`).toBeLessThanOrEqual(MAX);
          expect(s.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("encurta o nome antes de abrir mão da potência", () => {
    const s = buildGroupSubject("José Carlos da Silva Neto", 12.5, "cliente", MAX);
    expect(s).toContain("12,5 kWp");
    expect(s.startsWith("Solo | José")).toBe(true);
  });

  it("formata a potência em pt-BR, sem decimal inútil", () => {
    expect(buildGroupSubject("Ana", 12, "cliente", MAX)).toBe("Solo | Ana 12 kWp");
    expect(buildGroupSubject("Ana", 12.5, "cliente", MAX)).toBe("Solo | Ana 12,5 kWp");
  });

  it("omite a potência quando o projeto não tem", () => {
    expect(buildGroupSubject("Ana Paula", null, "cliente", MAX)).toBe("Solo | Ana Paula");
    expect(buildGroupSubject("Ana Paula", 0, "cliente", MAX)).toBe("Solo | Ana Paula");
  });

  it("distingue os três públicos no prefixo", () => {
    expect(buildGroupSubject("Ana", 10, "instalacao", MAX)).toContain("Obra");
    expect(buildGroupSubject("Ana", 10, "homologacao", MAX)).toContain("Hml");
  });

  it("não deixa separador solto na ponta ao cortar", () => {
    const s = buildGroupSubject("Wenceslau", 100, "homologacao", MAX);
    expect(s).not.toMatch(/[\s|\-]$/);
  });

  it("usa o limite maior quando o gateway permitir", () => {
    expect(buildGroupSubject("José Carlos da Silva Neto", 12.5, "cliente", 100)).toBe(
      "Solo | José Carlos da Silva Neto 12,5 kWp",
    );
  });

  it("a descrição carrega o nome completo pretendido", () => {
    expect(buildGroupSubjectFull("José Carlos da Silva Neto", 12.5, "cliente")).toBe(
      "Solo | Usina - José Carlos da Silva Neto (12,5 kWp)",
    );
    expect(buildGroupSubjectFull("Chica Doce", 75, "instalacao")).toBe(
      "Solo | Usina - Chica Doce (75 kWp) — Equipe de Instalação",
    );
  });
});

describe("catálogo de templates", () => {
  it("não tem código repetido", () => {
    const codes = NOTIFICATION_TEMPLATES.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("declara toda variável que o corpo usa (fora as do contexto)", () => {
    const doContexto = new Set(["concessionaria"]);
    for (const t of NOTIFICATION_TEMPLATES) {
      const usadas = [...t.body.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
      const declaradas = new Set(t.vars.map((v) => v.key));
      for (const u of usadas) {
        if (doContexto.has(u)) continue;
        expect(declaradas.has(u), `${t.code} usa {{${u}}} sem declarar`).toBe(true);
      }
    }
  });

  it("não declara variável que o corpo ignora", () => {
    for (const t of NOTIFICATION_TEMPLATES) {
      for (const v of t.vars) {
        expect(t.body.includes(`{{${v.key}}}`), `${t.code} declara ${v.key} sem usar`).toBe(true);
      }
    }
  });

  it("usa negrito de WhatsApp (*), nunca de markdown (**)", () => {
    for (const t of NOTIFICATION_TEMPLATES) {
      expect(t.body.includes("**"), `${t.code} tem ** no corpo`).toBe(false);
    }
  });

  it("indexa por código", () => {
    expect(TEMPLATE_BY_CODE.get("HML-04")?.nome).toBe("Homologação aprovada");
    expect(TEMPLATE_BY_CODE.size).toBe(NOTIFICATION_TEMPLATES.length);
  });
});

describe("renderTemplate", () => {
  it("substitui as variáveis preenchidas", () => {
    expect(renderTemplate("Olá, {{nome}}! ☀️", { nome: "Mateus" })).toBe("Olá, Mateus! ☀️");
  });

  it("deixa o buraco visível quando falta valor", () => {
    expect(renderTemplate("Valor: {{valor}}", {})).toBe("Valor: [valor]");
    expect(renderTemplate("Valor: {{valor}}", { valor: "   " })).toBe("Valor: [valor]");
  });

  it("preenche as variáveis automáticas a partir do contexto do projeto", () => {
    const t = TEMPLATE_BY_CODE.get("COM-01")!;
    const iniciais = initialValues(t, { primeiroNome: "Mateus", potencia: "75 kWp" });
    expect(iniciais.nome).toBe("Mateus");
    expect(iniciais.potencia).toBe("75 kWp");
    expect(iniciais.linkFormulario).toBe(""); // sem auto: o operador digita
  });
});

describe("normalização de número", () => {
  it("aceita as formas que aparecem no cadastro", () => {
    for (const entrada of ["+55 85 99648-7923", "85996487923", "5585996487923", "(85) 9 9648-7923"]) {
      expect(normalizePhone(entrada)).toBe("5585996487923");
    }
  });

  it("descarta o 00 de DDI", () => {
    expect(normalizePhone("005585996487923")).toBe("5585996487923");
  });

  it("aceita as duas formas reais do celular — com e sem o nono dígito", () => {
    // O WhatsApp guarda contas antigas com 8 dígitos no JID: o mesmo Gabriel é
    // 5585999289511 discado e 558599289511 no JID. Rejeitar a forma curta
    // barraria número que funciona (conferido na API, os dois existem).
    expect(isPlausibleBrazilianPhone("+55 85 9928-9511")).toBe(true);
    expect(isPlausibleBrazilianPhone("5585999289511")).toBe(true);
    expect(isPlausibleBrazilianPhone("+5585996487923")).toBe(true);
    expect(isPlausibleBrazilianPhone("85996487923")).toBe(true);
    expect(isPlausibleBrazilianPhone("558533334444")).toBe(true);
  });

  it("reprova o que não tem cara de telefone", () => {
    expect(isPlausibleBrazilianPhone("123")).toBe(false);
    expect(isPlausibleBrazilianPhone("55859999999999")).toBe(false); // longo demais
    expect(isPlausibleBrazilianPhone("550199999999")).toBe(false); // DDD inexistente
  });
});

describe("pontuarGrupo", () => {
  // Nomes reais dos grupos da Solo (GET /v1/group/fetchAllGroups).
  it("acha o grupo do cliente pelo primeiro nome", () => {
    expect(pontuarGrupo("Solo | Usina - Tiago (6,30 kWp)", "Tiago Maciel")).toBeGreaterThan(0.6);
    expect(pontuarGrupo("Solo | Usina - Ricardo Mendes (8.5 kWp)", "Ricardo Mendes")).toBe(1);
  });

  it("ignora acento e caixa", () => {
    expect(pontuarGrupo("Solo | Usina - Sávio (7 kWp)", "SAVIO ARAUJO")).toBeGreaterThan(0.6);
    expect(pontuarGrupo("Solo | Usina - Virgínia (9.8 kWp)", "Virginia Costa")).toBeGreaterThan(0.6);
  });

  it("não confunde clientes diferentes", () => {
    expect(pontuarGrupo("Solo | Usina - Tiago (6,30 kWp)", "Ricardo Mendes")).toBe(0);
    expect(pontuarGrupo("Ecos News", "Tiago Maciel")).toBe(0);
  });

  it("não casa por palavrinha curta", () => {
    // "de"/"da" apareceriam em meio mundo de grupo — não podem pontuar.
    expect(pontuarGrupo("Solo | Usina - Bene (22.3 kWp)", "Ana de Souza")).toBe(0);
  });

  it("prefere o grupo no padrão da casa quando dois batem", () => {
    const padrao = pontuarGrupo("Solo | Usina - Clairton (3,51kWp)", "Clairton");
    const antigo = pontuarGrupo("Solar Clairton", "Clairton");
    expect(padrao).toBeGreaterThan(antigo);
  });
});

describe("normalizeGroupJid", () => {
  it("aceita as duas formas de resposta do gateway", () => {
    expect(normalizeGroupJid({ id: "120363012345678901@g.us" })).toBe("120363012345678901@g.us");
    expect(normalizeGroupJid({ JID: "120363012345678901@g.us" })).toBe("120363012345678901@g.us");
    expect(normalizeGroupJid({ id: "120363012345678901" })).toBe("120363012345678901@g.us");
    expect(normalizeGroupJid({})).toBeNull();
  });
});
