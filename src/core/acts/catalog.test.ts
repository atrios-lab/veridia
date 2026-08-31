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
  FEE_EXEMPTION_DECLARATION,
  FEE_EXEMPTION_DOCUMENTS,
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
    "rcpn-certidao",
    "rcpn-habilitacao-casamento",
  ]);
  // A base é de cada ato porque são leis diferentes, e existe para ser
  // conferida em vez de acreditada.
  for (const act of ACTS.filter((a) => a.feeExemption)) {
    assert.match(act.feeExemption?.legalBasis ?? "", /art\./, act.id);
  }
});

test("a declaração da gratuidade nomeia as penas e a conferência", () => {
  // Ela sai num documento que o cidadão assina: o que promete e o que avisa
  // não pode se perder numa reescrita distraída.
  assert.match(FEE_EXEMPTION_DECLARATION, /Código Penal art\. 299/);
  assert.match(FEE_EXEMPTION_DECLARATION, /Código Civil arts\. 186 e 927/);
  assert.match(FEE_EXEMPTION_DECLARATION, /benefício social/);
  assert.match(FEE_EXEMPTION_DECLARATION, /CadÚnico/);
});

test("a gratuidade diz qual documento anexar, sem fechar a lista", () => {
  // "Anexe a documentação" não é instrução: quem nunca fez isso não sabe o
  // que a serventia aceita, chuta, e o chute volta como exigência.
  assert.ok(FEE_EXEMPTION_DOCUMENTS.some((d) => /CadÚnico/.test(d)));
  assert.ok(FEE_EXEMPTION_DOCUMENTS.some((d) => /CRAS/.test(d)));

  // E a lista tem de continuar aberta. O cartório pediu: são muitos programas
  // sociais, e uma lista que se lê como exaustiva barra justamente quem tem o
  // benefício mas fora dos exemplos, que é a pessoa para quem isto existe.
  assert.ok(
    FEE_EXEMPTION_DOCUMENTS.some((d) => /^Outro comprovante/.test(d)),
    "a lista precisa terminar com uma entrada aberta",
  );
});
