import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addressParts,
  ctpJson,
  ctpTxt,
  ctpXml,
  doiDeclaration,
  doiJson,
  doiPgd,
  shareOf,
} from "./exports.ts";
import layout from "./layout-doiweb.json" with { type: "json" };
import {
  emptyTransfer,
  type TitleTransfer,
  transferFromGuide,
} from "./titularidade.ts";

// Fictitious parties only (LGPD).
const CPF = "529.982.247-25";
const OFFICE = {
  name: "Cartório Fictício",
  city: "Cidade Fictícia",
  state: "RN",
  cns: "000000",
};

function act(): TitleTransfer {
  return {
    ...emptyTransfer("notas"),
    actDate: "2026-10-10",
    book: "12",
    page: "34/35",
    operation: "11",
    destination: "urbano",
    matricula: "1.234",
    fiscalRegistration: "01.02.003.0004",
    address: "Rua das Flores Fictícias, nº 10, Centro",
    valueCents: 15000000,
    taxBaseCents: null,
    transmitentes: [{ name: "Maria & Filhos", taxId: CPF, share: "100%" }],
    adquirentes: [
      { name: "João Modelo", taxId: "", share: "1/2" },
      { name: "Espólio de Ana Modelo", taxId: "", share: "" },
    ],
    doi: {
      mne: "123456202611140000000123",
      paymentForm: "5",
      exchange: false,
      cash: true,
      cashCents: 1000000,
      partType: "1",
      partValue: "100",
      propertyType: "67",
      area: "200,50",
      builtArea: "80",
      cep: "59490000",
      ibge: "2400000",
    },
  };
}

// ------------------------------------------------ the RFB's own schema

type Schema = Record<string, unknown>;
const LAYOUT = layout as Schema;

/**
 * The parts of JSON Schema the DOI-Web's layout uses: $ref, type,
 * required, additionalProperties false, sizes, pattern, oneOf of consts,
 * date format, items. Returns every violation found.
 */
function validate(node: unknown, schema: Schema, path = "$"): string[] {
  if (typeof schema.$ref === "string") {
    const name = schema.$ref.replace("#/$defs/", "");
    return validate(
      node,
      (LAYOUT.$defs as Record<string, Schema>)[name] ?? {},
      path,
    );
  }
  const errors: string[] = [];
  if (Array.isArray(schema.oneOf)) {
    const ok = (schema.oneOf as Schema[]).some((alt) => alt.const === node);
    if (!ok) errors.push(`${path}: ${JSON.stringify(node)} fora da tabela`);
    return errors;
  }
  const type = schema.type;
  if (type === "object") {
    if (typeof node !== "object" || node === null || Array.isArray(node)) {
      return [`${path}: não é objeto`];
    }
    const props = (schema.properties ?? {}) as Record<string, Schema>;
    for (const key of (schema.required ?? []) as string[]) {
      if (!(key in node)) errors.push(`${path}.${key}: obrigatório`);
    }
    for (const [key, value] of Object.entries(node)) {
      const sub = props[key];
      if (!sub) {
        if (schema.additionalProperties === false) {
          errors.push(`${path}.${key}: campo fora do leiaute`);
        }
        continue;
      }
      errors.push(...validate(value, sub, `${path}.${key}`));
    }
  } else if (type === "array") {
    if (!Array.isArray(node)) return [`${path}: não é lista`];
    node.forEach((item, i) => {
      errors.push(...validate(item, schema.items as Schema, `${path}[${i}]`));
    });
  } else if (type === "string") {
    if (typeof node !== "string") return [`${path}: não é texto`];
    if (
      typeof schema.maxLength === "number" &&
      node.length > schema.maxLength
    ) {
      errors.push(`${path}: mais de ${schema.maxLength} caracteres`);
    }
    if (
      typeof schema.minLength === "number" &&
      node.length < schema.minLength
    ) {
      errors.push(`${path}: menos de ${schema.minLength} caracteres`);
    }
    if (
      typeof schema.pattern === "string" &&
      !new RegExp(`^${schema.pattern}$`).test(node)
    ) {
      errors.push(`${path}: formato`);
    }
    if (schema.format === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(node)) {
      errors.push(`${path}: data`);
    }
  } else if (type === "number" || type === "integer") {
    if (typeof node !== "number") errors.push(`${path}: não é número`);
  } else if (type === "boolean") {
    if (typeof node !== "boolean")
      errors.push(`${path}: não é verdadeiro/falso`);
  }
  return errors;
}

test("a DOI gerada passa no esquema oficial da DOI-Web (layout-doiweb.json)", () => {
  const ri = {
    ...act(),
    service: "ri" as const,
    act: "registro",
    entry: "R-3",
  };
  const rural: TitleTransfer = {
    ...act(),
    destination: "rural",
    description: "Sítio Fictício",
    doi: {
      ...act().doi,
      cib: "12345678",
      incra: "1234567890123",
      paymentForm: "9",
    },
  };
  for (const transfers of [[act()], [ri], [rural], []]) {
    assert.deepEqual(validate(JSON.parse(doiJson(transfers)), LAYOUT), []);
  }
  // A month of acts without the extra fields still has the required ones
  // the title can give; the DOI-Web lists what is missing.
  const bare = { ...act(), doi: undefined };
  const errors = validate(JSON.parse(doiJson([bare])), LAYOUT);
  assert.ok(
    errors.every((e) => e.endsWith("obrigatório")),
    errors.join("\n"),
  );
});

test("DOI com os códigos e campos do leiaute, sem nome e sem inventar", () => {
  const d = doiDeclaration(act());
  assert.equal(d.tipoDeclaracao, "0");
  assert.equal(d.tipoServico, "1");
  assert.equal(d.tipoAto, "1");
  assert.equal(d.numeroLivro, "12");
  assert.equal(d.folha, "34/35");
  assert.equal(d.matriculaNotarialEletronica, "123456202611140000000123");
  assert.equal(d.matricula, "1234");
  assert.equal(d.tipoOperacaoImobiliaria, "11");
  assert.equal(d.valorOperacaoImobiliaria, 150000);
  assert.equal(d.indicadorNaoConstaValorBaseCalculoItbiItcmd, true);
  assert.equal(d.formaPagamento, "5");
  assert.equal(d.indicadorPagamentoDinheiro, true);
  assert.equal(d.valorPagoMoedaCorrenteDataAto, 10000);
  assert.equal(d.tipoParteTransacionada, "1");
  assert.equal(d.valorParteTransacionada, 100);
  assert.equal(d.destinacao, "1");
  assert.equal(d.indicadorImovelPublicoUniao, false);
  assert.equal(d.tipoImovel, "67");
  assert.equal(d.areaImovel, 200.5);
  assert.equal(d.nomeLogradouro, "das Flores Fictícias");
  assert.deepEqual(d.municipiosUF, [{ codigoIbge: "2400000" }]);
  assert.equal(d.alienantes[0]?.ni, "52998224725");
  assert.ok(
    !("nome" in (d.alienantes[0] ?? {})),
    "a DOI identifica pelo CPF/CNPJ",
  );
  assert.equal(d.adquirentes[0]?.indicadorNiIdentificado, false);
  assert.equal(d.adquirentes[0]?.motivoNaoIdentificacaoNi, "2");
  assert.equal(d.adquirentes[0]?.participacao, 50);
  assert.equal(d.adquirentes[1]?.indicadorEspolio, true);
  assert.equal(d.adquirentes[1]?.indicadorNaoConstaParticipacaoOperacao, true);
});

test("DOI no formato PGD: DOI.TXT com linhas de 365 posições", () => {
  const lines = doiPgd([act()], "Cidade Fictícia", "RN")
    .split("\r\n")
    .filter(Boolean);
  assert.deepEqual(
    lines.map((l) => l[0]),
    ["1", "2", "3", "3", "9"],
  );
  assert.ok(
    lines.every((l) => l.length === 365),
    "registro fixo de 365",
  );
  const one = lines[0] ?? "";
  assert.equal(one.slice(11, 21), "10/10/2026", "data da lavratura (12 a 21)");
  assert.equal(one.slice(21, 28), "     12", "livro à direita (22 a 28)");
  assert.equal(one.slice(64, 65), "1", "atribuição: notas");
  assert.equal(one.slice(65, 67), "11", "compra e venda");
  assert.equal(one.slice(108, 109), "5", "à vista");
  assert.equal(one.slice(110, 125), "000000150000,00", "valor (111 a 125)");
  assert.equal(
    one.slice(125, 140),
    "               ",
    "base de cálculo que não consta",
  );
  assert.equal(one.slice(334, 335), "1", "ITBI não consta");
  assert.equal(one.slice(287, 317).trim(), "CIDADE FICTICIA");
  assert.equal(
    (lines[1] ?? "").slice(11, 25),
    "   52998224725",
    "CPF à direita (12 a 25)",
  );
  assert.equal((lines[1] ?? "").slice(140, 146), "100,00");
  assert.equal((lines[4] ?? "").slice(17, 23), "000005", "total de registros");
  const donation = doiPgd([{ ...act(), operation: "67" }], "X", "RN");
  assert.equal(donation.slice(65, 67), "53", "doação no código do PGD");
});

test("participação e endereço em partes", () => {
  assert.equal(shareOf("50%"), 50);
  assert.equal(shareOf("1/2"), 50);
  assert.equal(shareOf("0,5"), 50);
  assert.equal(shareOf(""), undefined);
  assert.deepEqual(addressParts("Rua das Flores Fictícias, nº 10, Centro"), {
    tipoLogradouro: "Rua",
    nomeLogradouro: "das Flores Fictícias",
    numeroImovel: "10",
    bairro: "Centro",
  });
});

test("Carga CTP para o CENSEC no leiaute da DOI, a relação em TXT e o mês negativo", () => {
  const json = JSON.parse(ctpJson(OFFICE, "2026-10", [act()]));
  assert.deepEqual(validate(json, LAYOUT), []);
  const xml = ctpXml(OFFICE, "2026-10", [act()]);
  assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(xml, /<declaracoes>\s*<declaracao>/);
  const txt = ctpTxt(OFFICE, "2026-10", [act()]).trim().split("\r\n");
  assert.equal(
    txt[0],
    "H|Cartório Fictício|000000|Cidade Fictícia/RN|2026-10|1",
  );
  assert.equal(txt.filter((l) => l.startsWith("D|")).length, 2);
  assert.deepEqual(JSON.parse(ctpJson(OFFICE, "2026-09", [])), {
    declaracoes: [],
  });
});

test("da guia de ITIV sai a comunicação, sem data nem livro", () => {
  const t = transferFromGuide({
    kind: "itiv",
    nature: "compra e venda",
    declaredValueCents: 15000000,
    property: {
      type: "urbano",
      description: "Casa situada na Rua A, nº 1, Centro, com área de 200 m²",
      fiscalRegistration: "01.02",
      registration: "Matrícula nº 1.234 do Registro de Imóveis fictício",
    },
    parties: [
      { role: "transmitente", name: "Maria Fictícia", taxId: CPF },
      { role: "adquirente", name: "João Modelo", taxId: "" },
    ],
  });
  assert.equal(t.operation, "11");
  assert.equal(t.matricula, "1.234");
  assert.equal(t.address, "Rua A, nº 1, Centro");
  assert.equal(t.actDate, "");
  assert.deepEqual(
    t.transmitentes.map((p) => p.name),
    ["Maria Fictícia"],
  );
});
