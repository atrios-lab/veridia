import assert from "node:assert/strict";
import { test } from "node:test";
import { ATTRIBUTIONS, type Tenant } from "../tenant/schema.ts";
import { tabelionatoAurora } from "../tenant/tenants/aurora.ts";
import { cartorioMarinho } from "../tenant/tenants/marinho.ts";
import {
  ACTS,
  ATTRIBUTION_EXAMPLES,
  ATTRIBUTION_NAMES,
  ATTRIBUTION_SHORT_NAMES,
  actsOfAttribution,
  actsOfTenant,
  CERTIFICATE_TYPES,
  FEE_EXEMPTION_ACKNOWLEDGEMENTS,
  FEE_EXEMPTION_DECLARATION,
  getAct,
  getActForTenant,
  IDENTIFICATION_ONLY_HINT,
  IDENTIFICATION_ONLY_LABEL,
  PROCESSING_MODE_HINTS,
  PROCESSING_MODE_LABELS,
  PROCESSING_MODES,
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

test("a certificate never asks the citizen what it is for", () => {
  // Lei 6.015 art. 17 and Prov. 149 art. 123 caput. The exception exists only
  // for the archived document and for the indicator search, both in RI.
  const asking = ACTS.filter((a) => a.requiresPurpose).map((a) => a.id);
  assert.deepEqual(asking.sort(), [
    "ri-busca-indicador",
    "ri-certidao-arquivado",
  ]);
});

test("every act declares a known processing mode", () => {
  for (const act of ACTS) {
    assert.ok(PROCESSING_MODES.includes(act.processingMode), act.id);
  }
});

test("an act finished at the counter tells the citizen what to bring", () => {
  for (const act of ACTS.filter((a) => a.processingMode === "presential")) {
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
  // e o que fazia a certidão anunciar só metade da verdade.
  const soIdentificacao = ACTS.filter((act) => act.identificationOnly);
  assert.equal(soIdentificacao.length, 7);
  for (const act of soIdentificacao) {
    assert.equal(act.processingMode, "online", act.id);
  }
  assert.ok(soIdentificacao.every((act) => /certid|busca/i.test(act.name)));
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
