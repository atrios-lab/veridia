import assert from "node:assert/strict";
import { test } from "node:test";
import { getAct } from "../acts/catalog.ts";
import { cartorioMarinho } from "../tenant/tenants/marinho.ts";
import {
  buildAccessReceipt,
  buildDataRightsReceipt,
  buildRequerimento,
  HANDWRITTEN_SIGNATURE_CAVEAT,
  SIGNED_FORM_CONFIRMATIONS,
} from "./requerimento.ts";

test("a confirmação do envio nomeia o documento que está sendo enviado", () => {
  assert.match(SIGNED_FORM_CONFIRMATIONS.requerimento, /requerimento/);
  assert.doesNotMatch(SIGNED_FORM_CONFIRMATIONS.requerimento, /declaração/);
  assert.match(SIGNED_FORM_CONFIRMATIONS.declaracao, /declaração/);
  assert.doesNotMatch(SIGNED_FORM_CONFIRMATIONS.declaracao, /requerimento/);
});

const marriage = getAct("rcpn-habilitacao-casamento");
const nameChange = getAct("rcpn-alteracao-prenome");
if (!marriage || !nameChange) throw new Error("catalogo incompleto");

const certificate = getAct("rcpn-certidao");
const gratuidade = getAct("gratuidade-rcpn");
if (!certificate || !gratuidade) throw new Error("catalogo incompleto");

const ACCESS_KEY = "BBM8-6XVB-8PUK";

const data = {
  protocolNumber: "REQ.2026.000148",
  applicantName: "Maria José da Silva",
  contact: "(84) 99999-0000",
  cpf: "52998224725",
  description: "Queremos casar em outubro.",
  purpose: null,
  parameterValue: null,
  createdAt: new Date("2026-08-04T12:00:00Z"),
};

function flatten(sections: ReturnType<typeof buildRequerimento>["sections"]) {
  return sections
    .flatMap((s) => [
      s.heading,
      ...(s.rows ?? []).map((r) => `${r.label}: ${r.value}`),
      ...(s.paragraphs ?? []),
    ])
    .join("\n");
}

test("o ato requerido sai com o nome do tipo escolhido", () => {
  const { sections } = buildRequerimento(cartorioMarinho, certificate, {
    ...data,
    actVariant: "casamento",
  });
  const text = flatten(sections);
  assert.match(text, /Ato requerido: Certidão de casamento/);
  assert.doesNotMatch(text, /Certidão \(nascimento/);
});

test("o pedido sem tipo conhecido mantém o nome do ato, sem expor o id", () => {
  for (const actVariant of [undefined, "retirado"]) {
    const { sections } = buildRequerimento(cartorioMarinho, certificate, {
      ...data,
      actVariant,
    });
    const text = flatten(sections);
    assert.match(
      text,
      /Ato requerido: Certidão \(nascimento, casamento, óbito\)/,
    );
    assert.doesNotMatch(text, /retirado/);
  }
});

test("a gratuidade cita o tipo do ato pedido", () => {
  const { sections } = buildRequerimento(cartorioMarinho, gratuidade, {
    ...data,
    actVariant: "obito",
    exemption: { actId: "rcpn-certidao" },
  });
  assert.match(flatten(sections), /Pede a gratuidade de "Certidão de óbito"/);
});

const receipt = {
  protocolNumber: data.protocolNumber,
  accessKey: ACCESS_KEY,
  createdAt: data.createdAt,
};

/** Every string the document puts on paper, credentials block included. */
function everything(document: ReturnType<typeof buildRequerimento>): string {
  return [
    document.eyebrow,
    document.title,
    document.subtitle,
    ...document.office,
    flatten(document.sections),
    document.signee ?? "",
    ...document.signature,
    document.footer,
    document.credentials?.heading ?? "",
    ...(document.credentials?.rows ?? []).map((r) => `${r.label}: ${r.value}`),
    document.credentials?.note ?? "",
  ].join("\n");
}

test("the receipt carries the pair that opens the request", () => {
  // The screen shows the key once, and this file is the copy the citizen
  // keeps.
  const document = buildAccessReceipt(cartorioMarinho, receipt);
  const text = (document.credentials?.rows ?? [])
    .map((row) => `${row.label}: ${row.value}`)
    .join("\n");
  assert.match(text, /REQ\.2026\.000148/);
  assert.match(text, new RegExp(ACCESS_KEY));
});

test("the key is nowhere in the file that gets signed", () => {
  // The whole point of the split: signing at Gov.br signs the entire PDF, and
  // that PDF comes back to the office. It must not carry the credential: not
  // on any page, not in any block.
  const document = buildRequerimento(cartorioMarinho, marriage, data);
  const signed = everything(document);
  assert.equal(document.credentials, undefined);
  assert.equal(signed.includes(ACCESS_KEY), false);
  assert.equal(signed.includes("Chave de acesso"), false);
  // The protocol stays: without it the office cannot find the request.
  assert.match(signed, /REQ\.2026\.000148/);
});

test("the access receipt is a document nobody signs", () => {
  const document = buildAccessReceipt(cartorioMarinho, receipt);
  assert.equal(document.signee, undefined);
  assert.deepEqual(document.sections, []);
  assert.match(document.title, /Comprovante de acesso/);
  // It has to say what the two codes are for, and that it travels alone.
  assert.ok(document.credentials);
  assert.match(document.credentials.note, /consulta de protocolo/);
  assert.match(document.credentials.note, /não deve ser enviado/);
});

test("the form identifies the office and the act it is for", () => {
  const document = buildRequerimento(cartorioMarinho, marriage, data);
  assert.ok(document.office.includes(cartorioMarinho.name));
  // The CNS identifies the serventia to the corregedoria, not to the citizen
  // signing this: the office asked for it out of everything it hands over.
  // It stays on the tenant, for the panel to show whoever is logged in.
  assert.doesNotMatch(document.office.join("\n"), /CNS/);
  assert.equal(cartorioMarinho.cns, "094615");
  const text = flatten(document.sections);
  assert.match(text, /Habilitação de casamento/);
  assert.match(text, /Lei 6\.015 art\. 67/);
});

test("the CPF is printed the way it is written", () => {
  const text = flatten(
    buildRequerimento(cartorioMarinho, marriage, data).sections,
  );
  assert.match(text, /529\.982\.247-25/);
});

test("another document is printed in full where the CPF would be", () => {
  const text = flatten(
    buildRequerimento(cartorioMarinho, marriage, {
      ...data,
      cpf: null,
      alternateDocument: { type: "rne", number: "V123456-7" },
    }).sections,
  );
  assert.match(text, /RNE/);
  assert.match(text, /V123456-7/);
  assert.equal(text.includes("CPF"), false);
});

test("what the citizen did not fill in does not become an empty line", () => {
  const document = buildRequerimento(cartorioMarinho, marriage, {
    ...data,
    cpf: null,
    description: null,
  });
  const text = flatten(document.sections);
  assert.equal(text.includes("CPF"), false);
  assert.equal(text.includes("Descrição do pedido"), false);
});

test("both declarations are on the paper that gets signed", () => {
  const text = flatten(
    buildRequerimento(cartorioMarinho, marriage, data).sections,
  );
  assert.match(text, /Lei 13\.709\/2018/);
  assert.match(text, /sob as penas da lei/);
});

test("the act's own documents and guidance travel with it", () => {
  const withDocuments = flatten(
    buildRequerimento(cartorioMarinho, marriage, data).sections,
  );
  assert.match(withDocuments, /Certidões de nascimento/);

  const atCounter = flatten(
    buildRequerimento(cartorioMarinho, nameChange, data).sections,
  );
  assert.match(atCounter, /Comparecimento pessoal/);
});

test("the data rights receipt keeps its key in the body", () => {
  // Nobody signs a receipt and sends it back, so there is no sheet to detach
  // the key from: separating it would only cost the holder a page.
  const document = buildDataRightsReceipt(cartorioMarinho, {
    protocolNumber: "LGPD.2026.000021",
    accessKey: "K4TP-2W9C-QJ7M",
    applicantName: "João Batista",
    email: "joao@exemplo.com",
    cpf: null,
    right: "access",
    description: "Quero saber quais dados a serventia guarda sobre mim.",
    createdAt: new Date("2026-08-04T12:00:00Z"),
    deadline: "19/08/2026",
  });
  assert.equal(document.credentials, undefined);
  assert.match(flatten(document.sections), /K4TP-2W9C-QJ7M/);
});

test("o recibo só cita a lei no prazo quando o direito é o acesso", () => {
  // LGPD art. 19, II fixa os 15 dias para a declaração completa de acesso;
  // para os demais direitos o prazo é regra da serventia, e o recibo diz isso.
  const base = {
    protocolNumber: "SOL.2026.000021",
    accessKey: "K4TP-2W9C-QJ7M",
    applicantName: "João Batista",
    email: "joao@exemplo.com",
    cpf: null,
    description: "Pedido do titular.",
    createdAt: new Date("2026-08-04T12:00:00Z"),
    deadline: "19/08/2026",
  };
  const acesso = flatten(
    buildDataRightsReceipt(cartorioMarinho, { ...base, right: "access" })
      .sections,
  );
  assert.match(acesso, /Prazo legal para resposta/);
  assert.match(
    acesso,
    /19\/08\/2026 \(15 dias, Lei 13\.709\/2018, art\. 19, II\)/,
  );

  const correcao = flatten(
    buildDataRightsReceipt(cartorioMarinho, { ...base, right: "rectification" })
      .sections,
  );
  assert.match(correcao, /Prazo de resposta/);
  assert.match(correcao, /19\/08\/2026 \(15 dias, prazo da serventia\)/);
  assert.doesNotMatch(correcao, /13\.709/);
  assert.doesNotMatch(correcao, /Prazo legal/);
});

test("the signature block says how to sign it, and who signs", () => {
  const document = buildRequerimento(cartorioMarinho, marriage, data);
  assert.match(document.signature.join("\n"), /Gov\.br/);
  // Assinar em papel não dispensa reconhecer a firma; o PDF precisa dizer.
  assert.match(document.signature.join("\n"), /reconheça a firma/);
  assert.equal(document.signee, "Maria José da Silva");
});

test("a gratuidade pedida entra no papel que o cidadão assina, sem repetir o Anexo I", () => {
  // Escolher o ato é registro; a declaração de hipossuficiência assinada,
  // que prova a hipossuficiência, é um documento à parte (declaracao.ts),
  // então o requerimento só remete a ela, não repete seu texto.
  const gratuidade = getAct("gratuidade-rcpn");
  if (!gratuidade) throw new Error("catalogo incompleto");
  const comIsencao = buildRequerimento(cartorioMarinho, gratuidade, {
    ...data,
    exemption: { actId: "rcpn-habilitacao-casamento" },
  });
  const texto = flatten(comIsencao.sections);
  assert.match(texto, /Habilitação de casamento/);
  assert.match(texto, /CC art\. 1\.512/);
  assert.match(texto, /declaração de hipossuficiência que acompanha/);
  // O texto do Anexo I mora só na declaração; repeti-lo aqui duplicaria o
  // que a pessoa já assina no outro papel.
  assert.doesNotMatch(texto, /não disponho de recursos/);

  // Sem pedir, nada disso aparece: quem paga não assina declaração de pobreza.
  const semIsencao = buildRequerimento(cartorioMarinho, marriage, data);
  assert.doesNotMatch(
    flatten(semIsencao.sections),
    /declaração de hipossuficiência/,
  );
});

test("pedido antigo sem ato-alvo ainda imprime a remissão à declaração", () => {
  // Os pedidos anteriores à gratuidade virar ato próprio não têm `actId`: a
  // remissão sai assim mesmo, sem fundamento que o papel não sabe.
  const antigo = buildRequerimento(cartorioMarinho, marriage, {
    ...data,
    exemption: {},
  });
  const texto = flatten(antigo.sections);
  assert.match(texto, /declaração de hipossuficiência que acompanha/);
  assert.doesNotMatch(texto, /fundamento:/);
});

function inUtc(run: () => void): void {
  const zone = process.env.TZ;
  process.env.TZ = "UTC";
  try {
    run();
  } finally {
    if (zone === undefined) delete process.env.TZ;
    else process.env.TZ = zone;
  }
}

test("a request filed at night carries that day, with the server in UTC", () => {
  inUtc(() => {
    const document = buildRequerimento(cartorioMarinho, marriage, {
      ...data,
      // 22:30 on 3 November at the office, already the 4th in UTC.
      createdAt: new Date("2026-11-04T01:30:00Z"),
    });
    assert.match(document.subtitle, /03\/11\/2026$/);
  });
});

const inteiroTeor = getAct("rcpn-certidao-inteiro-teor");
if (!inteiroTeor) throw new Error("catalogo incompleto");

const byAttorney = {
  role: "attorney",
  representedName: "João da Silva",
  kinship: "Filho",
  registrantDeceased: true,
} as const;

test("o inteiro teor do RCPN traz as respostas e a própria assinatura", () => {
  const { sections, signature } = buildRequerimento(
    cartorioMarinho,
    inteiroTeor,
    {
      ...data,
      actVariant: "nascimento",
      purpose: "Aposentadoria rural",
      requesterQualification: byAttorney,
      deliveryFormat: "paper",
    },
  );
  const text = flatten(sections);
  assert.match(text, /Entrega: Impressa em papel, retirada no balcão/);
  assert.match(text, /Ato requerido: Certidão de nascimento em inteiro teor/);
  assert.match(text, /Finalidade: Aposentadoria rural/);
  assert.match(text, /Quem pede: Advogado ou procurador/);
  assert.match(text, /Representado: João da Silva/);
  assert.match(text, /Parentesco: Filho/);
  assert.match(text, /Registrado falecido: Sim/);

  const assinatura = signature.join(" ");
  assert.match(assinatura, /Gov\.br/);
  assert.match(assinatura, /ICP-Brasil/);
  assert.match(assinatura, /reconheça a firma/);
  assert.doesNotMatch(`${assinatura} ${text}`, /e-Notariado/);
});

test("o óbito do inteiro teor não imprime respostas, mesmo se sobrarem", () => {
  const { sections } = buildRequerimento(cartorioMarinho, inteiroTeor, {
    ...data,
    actVariant: "obito",
    requesterQualification: byAttorney,
  });
  assert.doesNotMatch(flatten(sections), /Quem pede|Representado/);
});

test("um ato sem a escolha não imprime a entrega, mesmo se sobrar", () => {
  const { sections } = buildRequerimento(cartorioMarinho, certificate, {
    ...data,
    actVariant: "casamento",
    deliveryFormat: "digital",
  });
  assert.doesNotMatch(flatten(sections), /Entrega/);
});

test("os demais atos mantêm o aviso geral de assinatura", () => {
  const { signature } = buildRequerimento(cartorioMarinho, certificate, {
    ...data,
    actVariant: "casamento",
  });
  assert.ok(signature.includes(HANDWRITTEN_SIGNATURE_CAVEAT));
});
