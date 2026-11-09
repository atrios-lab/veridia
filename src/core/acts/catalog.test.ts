import assert from "node:assert/strict";
import { test } from "node:test";
import { ATTRIBUTIONS, type Tenant } from "../tenant/schema.ts";
import { tabelionatoAurora } from "../tenant/tenants/aurora.ts";
import { cartorioMarinho } from "../tenant/tenants/marinho.ts";
import {
  ACTS,
  ANEXO_I_ACT_OPTIONS,
  ATTRIBUTION_EXAMPLES,
  ATTRIBUTION_NAMES,
  ATTRIBUTION_SHORT_NAMES,
  actsOfAttribution,
  actsOfTenant,
  actVariantName,
  CERTIFICATE_TYPE_LABELS,
  CERTIFICATE_TYPES,
  FEE_EXEMPTION_ACKNOWLEDGEMENTS,
  FEE_EXEMPTION_DECLARATION,
  getAct,
  getActForTenant,
  IDENTIFICATION_ONLY_HINT,
  IDENTIFICATION_ONLY_LABEL,
  INTEIRO_TEOR_SIGNATURE_CAVEAT,
  PLATFORM_CHANNEL_RULE,
  PLATFORM_COUNTER_STATEMENT,
  PLATFORM_DATA_PROTECTION,
  PLATFORM_RECEIPT_STATEMENT,
  PLATFORM_SECURITY_STATEMENT,
  PLATFORM_STATEMENT,
  PROCESSING_MODE_HINTS,
  PROCESSING_MODE_LABELS,
  PROCESSING_MODES,
  PURPOSE_HINT,
  PURPOSE_LABEL,
  processingHintFor,
  REQUESTER_QUALIFICATION_NOTICE,
} from "./catalog.ts";

// A NOTAS-only office, built here instead of borrowed from a registered one.
// What these two tests guard is the filtering, not any serventia's setup, and
// which attributions a real office holds is its own configuration: it may
// legitimately change, and when it did, it broke tests that had nothing to do
// with it.
const notasOnly: Tenant = { ...tabelionatoAurora, attributions: ["NOTAS"] };

test("the catalog is filtered by the attributions the office holds", () => {
  const acts = actsOfTenant(notasOnly);
  assert.ok(acts.length > 0);
  assert.ok(acts.every((a) => a.attribution === "NOTAS"));
  assert.deepEqual(actsOfAttribution(notasOnly, "RI"), []);
  assert.ok(actsOfTenant(cartorioMarinho).length > acts.length);
});

test("the kinds an act groups are a fixed list, since requests store the ids", () => {
  const declared = Object.fromEntries(
    ACTS.filter((act) => act.variants).map((act) => [
      act.id,
      act.variants?.options.map((option) => option.id),
    ]),
  );
  assert.deepEqual(declared, {
    "rcpn-certidao": ["nascimento", "casamento", "obito", "outra"],
    "rcpn-certidao-inteiro-teor": ["nascimento", "casamento", "obito", "outra"],
    "rcpn-busca": ["nascimento", "casamento", "obito", "outro"],
    "notas-escritura": ["escritura", "procuracao"],
    "notas-certidao": ["ato-notarial", "testamento"],
    "ri-certidao-matricula": ["matricula", "inteiro-teor", "onus"],
    "ri-busca-indicador": ["pessoal", "real"],
    "ri-prenotacao": [
      "anotacao",
      "averbacao",
      "registro",
      "retificacao",
      "ratificacao",
    ],
    "ri-registro-titulo": ["registro", "averbacao"],
    "rtd-prenotacao": [
      "anotacao",
      "averbacao",
      "registro",
      "retificacao",
      "ratificacao",
    ],
    "rtd-registro-documento": ["documento", "contrato"],
    "rtd-certidao": ["breve-relato", "inteiro-teor"],
    "rcpj-prenotacao": [
      "anotacao",
      "averbacao",
      "registro",
      "retificacao",
      "ratificacao",
    ],
    "rcpj-registro-constituicao": ["registro", "averbacao", "misto"],
    "rcpj-certidao": ["breve-relato", "inteiro-teor"],
  });
});

test("only the catch-all option of the certificate demands a description", () => {
  const demanding = ACTS.flatMap((act) => act.variants?.options ?? []).filter(
    (option) => option.requiresDescription,
  );
  assert.deepEqual(
    demanding.map((option) => option.id),
    ["outra", "outra"],
  );
});

test("the generated entries group no kinds of their own", () => {
  for (const id of ["outros-rcpn", "gratuidade-rcpn"]) {
    assert.equal(getAct(id)?.variants, undefined, id);
  }
});

test("the kind's name stands in for the act's, and an unknown id for nothing", () => {
  const certificate = getAct("rcpn-certidao");
  assert.ok(certificate);
  assert.equal(
    actVariantName(certificate, "casamento"),
    "Certidão de casamento",
  );
  assert.equal(actVariantName(certificate, undefined), undefined);
  assert.equal(actVariantName(certificate, "retirado"), undefined);
});

test("attribution codes stay as the official acronyms", () => {
  for (const labels of [
    ATTRIBUTION_NAMES,
    ATTRIBUTION_SHORT_NAMES,
    ATTRIBUTION_EXAMPLES,
  ]) {
    assert.deepEqual(Object.keys(labels).sort(), [...ATTRIBUTIONS].sort());
  }
});

test("every attribution the office holds offers at least one act", () => {
  // The wizard prints a count on each attribution card, and a zero would be a
  // card that leads to an empty screen.
  for (const attribution of cartorioMarinho.attributions) {
    assert.ok(
      actsOfAttribution(cartorioMarinho, attribution).length > 0,
      attribution,
    );
  }
});

test("each attribution ends with the way out for an unlisted act", () => {
  for (const attribution of cartorioMarinho.attributions) {
    const acts = actsOfAttribution(cartorioMarinho, attribution);
    const other = acts.at(-1);
    assert.equal(other?.id, `outros-${attribution.toLowerCase()}`);
    // Without a description there is nothing to work from.
    assert.equal(other?.requiresDescription, true);
  }
});

test("a summary certificate never asks the citizen what it is for", () => {
  // Lei 6.015 art. 17 and Prov. 149 art. 123 caput. The exception exists for
  // the archived document and for the indicator search, both in RI, and for
  // every inteiro teor (LGPD; in the Registro Civil, Prov. 149 art. 117 § 3º).
  const asking = ACTS.filter((a) => a.requiresPurpose).map((a) => a.id);
  assert.deepEqual(asking.sort(), [
    "rcpn-busca",
    "rcpn-certidao-inteiro-teor",
    "ri-busca-indicador",
    "ri-certidao-arquivado",
    "ri-certidao-inteiro-teor-papel",
  ]);
  // Where the inteiro teor sits among summaries, only its option asks.
  const askingOptions = ACTS.flatMap((act) =>
    (act.variants?.options ?? [])
      .filter((option) => option.requiresPurpose)
      .map((option) => `${act.id}/${option.id}`),
  );
  assert.deepEqual(askingOptions.sort(), [
    "notas-certidao/testamento",
    "rcpj-certidao/inteiro-teor",
    "ri-certidao-matricula/inteiro-teor",
    "rtd-certidao/inteiro-teor",
  ]);
});

test("o campo do motivo fala de LGPD, sem prometer emissão", () => {
  assert.equal(PURPOSE_LABEL, "Motivo do pedido");
  assert.match(PURPOSE_HINT, /LGPD/);
  assert.match(PURPOSE_HINT, /analisa/);
});

test("every act declares a known processing mode", () => {
  for (const act of ACTS) {
    assert.ok(PROCESSING_MODES.includes(act.processingMode), act.id);
  }
});

test("an act finished at the counter tells the citizen what to bring", () => {
  for (const act of ACTS.filter((a) => a.processingMode !== "online")) {
    assert.ok(act.guidance, act.id);
  }
});

test("act ids are unique", () => {
  assert.equal(new Set(ACTS.map((a) => a.id)).size, ACTS.length);
});

test("an act is only reachable through an attribution the office holds", () => {
  // The act id arrives from the URL, so this is what stops one office from
  // opening an act another office performs.
  assert.ok(getAct("ri-retificacao"));
  assert.equal(getActForTenant(notasOnly, "ri-retificacao"), undefined);
  assert.ok(getActForTenant(cartorioMarinho, "ri-retificacao"));
  assert.equal(getActForTenant(cartorioMarinho, "nao-existe"), undefined);
});

test("the generated act resolves back from its id", () => {
  assert.equal(getAct("outros-rcpn")?.attribution, "RCPN");
  assert.equal(getAct("outros-xpto"), undefined);
});

test("as certidões e a busca pedem só a identificação, e resolvem on-line", () => {
  // As duas coisas ao mesmo tempo: era o que o campo único não deixava dizer,
  // e o que fazia a certidão anunciar só metade da verdade. A exceção é o
  // inteiro teor em papel, que só identifica, mas se retira no balcão.
  const soIdentificacao = ACTS.filter((act) => act.identificationOnly);
  assert.equal(soIdentificacao.length, 9);
  assert.deepEqual(
    soIdentificacao
      .filter((act) => act.processingMode !== "online")
      .map((act) => act.id),
    ["ri-certidao-inteiro-teor-papel"],
  );
  assert.ok(soIdentificacao.every((act) => /certid|busca/i.test(act.name)));
});

test("o inteiro teor de imóveis separa o digital do papel, sem valor na tela", () => {
  const digital = getAct("ri-certidao-matricula");
  // O id não muda: os pedidos antigos passam a aparecer como digital.
  assert.equal(
    actVariantName(digital as NonNullable<typeof digital>, "inteiro-teor"),
    "Certidão de inteiro teor digital",
  );
  assert.equal(digital?.processingMode, "online");

  const papel = getAct("ri-certidao-inteiro-teor-papel");
  assert.equal(papel?.processingMode, "presential");
  assert.equal(papel?.identificationOnly, true);
  assert.equal(papel?.legalDeadlineDays, 5);
  assert.match(papel?.legalDeadlineNote ?? "", /§ 10 III/);
  assert.match(papel?.guidance ?? "", /balcão/);
  assert.doesNotMatch(
    `${papel?.name} ${papel?.guidance} ${papel?.processingHint}`,
    /R\$|valor/i,
  );
});

test("a dica do próprio ato vem antes da de só identificação", () => {
  const papel = getAct("ri-certidao-inteiro-teor-papel");
  assert.match(
    processingHintFor(papel as NonNullable<typeof papel>),
    /balcão.*identificação/,
  );
  // Os atos de antes não mudam: nenhum outro tem as duas coisas ao mesmo tempo.
  const comAsDuas = ACTS.filter(
    (a) => a.identificationOnly && a.processingHint,
  );
  assert.deepEqual(
    comAsDuas.map((a) => a.id),
    ["rcpn-busca", "ri-certidao-inteiro-teor-papel"],
  );
  assert.equal(
    processingHintFor({ processingMode: "online", identificationOnly: true }),
    IDENTIFICATION_ONLY_HINT,
  );
  assert.equal(
    processingHintFor({ processingMode: "presential" }),
    PROCESSING_MODE_HINTS.presential,
  );
});

test("o inteiro teor do RCPN avisa sem citar e-Notariado nem decidir", () => {
  const act = getAct("rcpn-certidao-inteiro-teor");
  assert.ok(act);
  // Pelo site ou no balcão, quem pede escolhe.
  assert.equal(act.processingMode, "hybrid");
  assert.equal(act.deliveryChoice, true);
  assert.deepEqual(
    ACTS.filter((a) => a.deliveryChoice).map((a) => a.id),
    ["rcpn-certidao-inteiro-teor"],
  );
  assert.match(processingHintFor(act), /site/);
  assert.match(processingHintFor(act), /balcão/);
  assert.equal(act.identificationOnly, undefined);
  assert.equal(act.legalDeadlineDays, 5);
  // Fora da gratuidade: a marcação "Inteiro teor" de lá não ganha estas perguntas.
  assert.equal(act.feeExemption, undefined);
  assert.ok(act.documents?.some((document) => /mandato/i.test(document)));

  const textos = JSON.stringify(act) + INTEIRO_TEOR_SIGNATURE_CAVEAT;
  assert.doesNotMatch(textos, /e-Notariado/i);
  assert.equal(act.signatureCaveat, INTEIRO_TEOR_SIGNATURE_CAVEAT);
  assert.match(INTEIRO_TEOR_SIGNATURE_CAVEAT, /Gov\.br/);
  assert.match(INTEIRO_TEOR_SIGNATURE_CAVEAT, /ICP-Brasil/);
  assert.match(INTEIRO_TEOR_SIGNATURE_CAVEAT, /reconheça a firma/);
  // CNN art. 117 § 1º: assinado na frente do preposto, dispensa a firma.
  assert.match(INTEIRO_TEOR_SIGNATURE_CAVEAT, /balcão/);
  assert.doesNotMatch(INTEIRO_TEOR_SIGNATURE_CAVEAT, /vale só/);
  assert.match(
    REQUESTER_QUALIFICATION_NOTICE,
    /só sai com autorização judicial/,
  );
  assert.match(REQUESTER_QUALIFICATION_NOTICE, /depois do recebimento/);
  // CNN art. 114: o mandatário precisa de poderes especiais.
  assert.match(REQUESTER_QUALIFICATION_NOTICE, /poderes especiais/);
});

test("nenhum texto do catálogo promete ato sem requerimento", () => {
  // O SCRUM-9 nasceu de "o mais rápido: sem requerimento" num ato cuja tela de
  // sucesso pede o requerimento assinado como a de todos os outros. Enquanto o
  // fluxo pedir, nenhum texto daqui pode dizer que não pede.
  const textos = [
    ...Object.values(PROCESSING_MODE_LABELS),
    ...Object.values(PROCESSING_MODE_HINTS),
    IDENTIFICATION_ONLY_LABEL,
    IDENTIFICATION_ONLY_HINT,
  ];
  for (const texto of textos) {
    assert.doesNotMatch(texto, /sem requerimento/i, texto);
  }
  // A dica precisa dizer que o requerimento é pedido além da identificação:
  // calar sobre ele faz o aviso obrigatório do fim do pedido parecer novidade.
  assert.match(IDENTIFICATION_ONLY_HINT, /requerimento assinado/);
});

test("só os atos que a lei isenta trazem a gratuidade, com sua base", () => {
  const isentaveis = ACTS.filter((act) => act.feeExemption).map((a) => a.id);
  assert.deepEqual(isentaveis.sort(), [
    "rcpn-alteracao-prenome",
    "rcpn-certidao",
    "rcpn-habilitacao-casamento",
  ]);
  // A base é de cada ato porque são leis diferentes, e existe para ser
  // conferida em vez de acreditada.
  for (const act of ACTS.filter((a) => a.feeExemption)) {
    assert.match(act.feeExemption?.legalBasis ?? "", /art\./, act.id);
  }
});

test("só a habilitação de casamento pede duas declarações", () => {
  // Provimento CGJ/TJRN n. 7/2026, art. 4º: individual por pessoa
  // beneficiária. A habilitação é o único ato daqui com dois nubentes.
  for (const act of ACTS.filter((a) => a.feeExemption)) {
    const expected = act.id === "rcpn-habilitacao-casamento" ? 2 : 1;
    assert.equal(act.feeExemption?.beneficiaryCount, expected, act.id);
  }
});

test("só a certidão pergunta o tipo", () => {
  // O bloco 3 do Anexo I só pergunta sem busca/com busca/inteiro teor quando
  // o ato-alvo é a certidão; habilitação e alteração de prenome não têm tipo.
  for (const act of ACTS.filter((a) => a.feeExemption)) {
    const expected = act.id === "rcpn-certidao" ? true : undefined;
    assert.equal(act.feeExemption?.askCertificateType, expected, act.id);
  }
  assert.deepEqual([...CERTIFICATE_TYPES].sort(), [
    "com-busca",
    "inteiro-teor",
    "sem-busca",
  ]);
});

test("a declaração da gratuidade é a do Anexo I, sem programa social", () => {
  // Ela sai num documento que o cidadão assina: o Provimento manda a
  // declaração bastar por si (art. 5º) e proíbe presumir pobreza por
  // critério que não seja ela mesma (art. 6º): nada aqui pode voltar a
  // condicionar a gratuidade a um benefício federal específico.
  assert.match(FEE_EXEMPTION_DECLARATION, /não disponho de recursos/);
  assert.match(FEE_EXEMPTION_DECLARATION, /minha família/);
  assert.doesNotMatch(FEE_EXEMPTION_DECLARATION, /CadÚnico/);
  assert.doesNotMatch(FEE_EXEMPTION_DECLARATION, /programa social/);
});

test("as cinco ciências do bloco 4 estão todas presentes", () => {
  assert.equal(FEE_EXEMPTION_ACKNOWLEDGEMENTS.length, 5);
  assert.ok(
    FEE_EXEMPTION_ACKNOWLEDGEMENTS.some((a) => /juízo competente/.test(a)),
  );
  assert.ok(
    FEE_EXEMPTION_ACKNOWLEDGEMENTS.some((a) => /praticado de imediato/.test(a)),
  );
  assert.ok(
    FEE_EXEMPTION_ACKNOWLEDGEMENTS.some((a) =>
      /cobrança dos emolumentos/.test(a),
    ),
  );
  assert.ok(
    FEE_EXEMPTION_ACKNOWLEDGEMENTS.some((a) =>
      /responsabilidade civil e criminal/.test(a),
    ),
  );
  assert.ok(
    FEE_EXEMPTION_ACKNOWLEDGEMENTS.some((a) => /serviços postais/.test(a)),
  );
});

test("a gratuidade é uma entrada da lista, só onde algum ato é isentável", () => {
  const rcpn = actsOfAttribution(cartorioMarinho, "RCPN").map((a) => a.id);
  assert.ok(rcpn.includes("gratuidade-rcpn"));
  // Antes do "Outro ato desta área", que fecha a lista.
  assert.ok(
    rcpn.indexOf("gratuidade-rcpn") < rcpn.indexOf("outros-rcpn"),
    "a entrada da gratuidade vem antes da entrada aberta",
  );

  // Nenhum ato de Notas tem previsão legal de isenção: prometer gratuidade
  // ali seria oferecer o que a serventia não pode conceder.
  const notas = actsOfAttribution(tabelionatoAurora, "NOTAS").map((a) => a.id);
  assert.ok(!notas.some((id) => id.startsWith("gratuidade-")));
});

test("a entrada da gratuidade oferece exatamente os atos isentáveis", () => {
  const gratuidade = getAct("gratuidade-rcpn");
  assert.ok(gratuidade, "o id sintético precisa resolver de volta");
  assert.deepEqual(gratuidade.exemptionTargets?.map((a) => a.id).sort(), [
    "rcpn-alteracao-prenome",
    "rcpn-certidao",
    "rcpn-habilitacao-casamento",
  ]);
  // O ato em si não é isentável: quem carrega a base legal é o ato pedido.
  assert.equal(gratuidade.feeExemption, undefined);
});

test("a gratuidade não inventa prazo legal: ele é o do ato pedido", () => {
  // Sem isto, a certidão isenta nasceria com o prazo padrão da serventia e a
  // paga com os 5 dias da Lei 6.015 art. 19, pelo mesmo pedido.
  const gratuidade = getAct("gratuidade-rcpn");
  assert.equal(gratuidade?.legalDeadlineDays, undefined);
  assert.equal(getAct("rcpn-certidao")?.legalDeadlineDays, 5);
});

test("o selo diz onde o ato termina, nunca onde ele pode ser pedido", () => {
  // A serventia leu "100% on-line" como "só dá para pedir pela internet" e
  // reclamou que todos os atos são híbridos, porque pedir sempre dá pelos dois
  // lados. Quem trabalha no cartório leu errado; o cidadão leria também.
  for (const label of Object.values(PROCESSING_MODE_LABELS)) {
    assert.match(label, /^Termina /, label);
  }
  assert.match(PROCESSING_MODE_HINTS.presential, /comparecer/);
  assert.match(PROCESSING_MODE_HINTS.online, /não precisa ir/);
});

test("o Gov.br assina o requerimento; o ato notarial, só o e-Notariado", () => {
  // CNN, art. 286, III: as partes assinam o ato notarial eletrônico
  // exclusivamente no e-Notariado. Dizer só "você assina pelo Gov.br" fazia
  // parecer que aquela assinatura concluía a ata.
  assert.match(PROCESSING_MODE_HINTS.online, /requerimento pelo Gov\.br/);

  const ata = getAct("notas-ata-notarial");
  assert.match(ata?.processingHint ?? "", /e-Notariado/);
  assert.match(ata?.guidance ?? "", /e-Notariado/);

  // A regra é dos tabeliães de notas: registros e protesto não usam a
  // plataforma, e nenhum texto de lá pode mandar o cidadão para ela.
  const citamPlataforma = ACTS.filter((act) =>
    /e-Notariado/.test(`${act.processingHint} ${act.guidance}`),
  );
  assert.ok(citamPlataforma.every((act) => act.attribution === "NOTAS"));
});

test("escritura e procuração terminam no balcão ou no e-Notariado", () => {
  const escritura = getAct("notas-escritura");
  assert.equal(escritura?.processingMode, "hybrid");
  assert.match(escritura?.processingHint ?? "", /balcão ou no e-Notariado/);
  assert.match(escritura?.guidance ?? "", /balcão/);
  assert.match(escritura?.guidance ?? "", /e-Notariado/);
});

test("o protesto de títulos termina on-line e pede quem protesta e quem deve", () => {
  const protesto = getAct("protesto-titulos");
  assert.equal(protesto?.attribution, "PROTESTO");
  assert.equal(protesto?.processingMode, "online");
  assert.equal(protesto?.legalDeadlineDays, 3);
  const documentos = protesto?.documents?.join(" ") ?? "";
  assert.match(documentos, /Título ou documento de dívida/);
  assert.match(documentos, /protestante/);
  assert.match(documentos, /devedor/);
});

test("Pessoas Jurídicas pede o serviço e os detalhes do que se quer", () => {
  const registro = getAct("rcpj-registro-constituicao");
  assert.equal(registro?.requiresDescription, true);
  assert.deepEqual(
    registro?.variants?.options.map((option) => option.id),
    ["registro", "averbacao", "misto"],
  );
});

test("o ato aposentado sai da lista, mas o pedido antigo ainda o encontra", () => {
  const ids = actsOfTenant(cartorioMarinho).map((act) => act.id);
  assert.ok(!ids.includes("rcpj-averbacao"));
  assert.ok(ids.includes("rcpj-registro-constituicao"));
  assert.equal(getAct("rcpj-averbacao")?.name, "Averbação de alterações");
});

test("o bloco 3 do Anexo I tem os quatro itens oficiais, na ordem do DJe", () => {
  assert.deepEqual(
    ANEXO_I_ACT_OPTIONS.map((option) => option.label),
    [
      "Certidão de nascimento, casamento, óbito ou outra",
      "Habilitação, registro do casamento e primeira certidão",
      "Alteração extrajudicial de prenome e gênero (Retificação e " +
        "Averbação), inclusive certidões correspondentes",
      "Outro ato com previsão legal",
    ],
  );
  // "Outro ato" nunca marca: nenhum ato do catálogo tem esse id.
  const last = ANEXO_I_ACT_OPTIONS.at(-1);
  assert.equal(last?.actId, null);
  // Os três primeiros apontam para atos isentáveis de verdade.
  for (const option of ANEXO_I_ACT_OPTIONS.slice(0, 3)) {
    const act = ACTS.find((a) => a.id === option.actId);
    assert.ok(act?.feeExemption, option.actId ?? undefined);
  }
});

test("o tipo de certidão do Anexo I usa os rótulos oficiais", () => {
  assert.deepEqual(CERTIFICATE_TYPE_LABELS, {
    "sem-busca": "Sem busca",
    "com-busca": "Com busca",
    "inteiro-teor": "Inteiro teor",
  });
});

test("o texto da plataforma nunca diz que o Provimento 7 a autoriza", () => {
  for (const text of [
    PLATFORM_STATEMENT,
    PLATFORM_RECEIPT_STATEMENT,
    PLATFORM_COUNTER_STATEMENT,
    PLATFORM_CHANNEL_RULE,
    PLATFORM_SECURITY_STATEMENT,
    PLATFORM_DATA_PROTECTION,
  ]) {
    assert.doesNotMatch(text, /7\/2026.*(autoriza|permite|admite)/i);
  }
  // O que autoriza o canal é o Provimento 180/2024 (art. 208, II, "b"); o
  // 7/2026 só é citado como o que a declaração aceita.
  assert.match(PLATFORM_STATEMENT, /180\/2024/);
  assert.match(PLATFORM_RECEIPT_STATEMENT, /7\/2026/);
});

test('a regra de canal do site diz "exclusivamente" e cita o Provimento 180', () => {
  // É a frase que a serventia invoca para recusar pedido por WhatsApp ou
  // e-mail; sem o "exclusivamente" ela não recusa nada.
  assert.match(PLATFORM_CHANNEL_RULE, /exclusivamente/);
  assert.match(PLATFORM_CHANNEL_RULE, /Provimento n\. 180/);
  assert.match(PLATFORM_CHANNEL_RULE, /site institucional/);
});

test("a busca do RCPN é consulta, não certidão, e manda pedir no ato certo", () => {
  const busca = getAct("rcpn-busca");
  assert.ok(busca);
  assert.equal(busca.attribution, "RCPN");
  assert.equal(busca.processingMode, "online");
  // Não é certidão: nenhum prazo legal inventado.
  assert.equal(busca.legalDeadlineDays, undefined);
  assert.equal(busca.requiresDescription, true);
  assert.equal(busca.requiresPurpose, true);
  assert.match(busca.guidance ?? "", /não é a certidão/);
  assert.match(busca.guidance ?? "", /inteiro teor/);
  assert.match(busca.descriptionPlaceholder ?? "", /profissão/);
  assert.match(processingHintFor(busca), /consta aqui/);
});

test("só a busca do RCPN é consulta, sem requerimento nem CPF obrigatório", () => {
  assert.deepEqual(
    ACTS.filter((act) => act.consultation).map((act) => act.id),
    ["rcpn-busca"],
  );
  const busca = getAct("rcpn-busca");
  assert.match(
    processingHintFor(busca as NonNullable<typeof busca>),
    /não exige requerimento assinado nem CPF/,
  );
});

test("the prenotação of each registry is an act that charges the table's item", () => {
  const charging = ACTS.filter((act) => act.chargesPrenotation).map((act) => [
    act.id,
    act.attribution,
  ]);
  assert.deepEqual(charging, [
    ["ri-prenotacao", "RI"],
    ["rtd-prenotacao", "RTD"],
    ["rcpj-prenotacao", "RCPJ"],
  ]);
});
