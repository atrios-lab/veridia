import assert from "node:assert/strict";
import { test } from "node:test";
import { TENANTS } from "@/core/tenant/resolve.ts";
import {
  buildIssDocument,
  competenceLabel,
  defaultIssSettings,
  formatRate,
  issOf,
  issOn,
} from "./declaration.ts";

const tenant = TENANTS["cartorio-marinho"];

test("ISS sobre os emolumentos, arredondado ao centavo", () => {
  assert.equal(issOn(209_937, 500), 10_497);
  assert.equal(issOn(100_000, 200), 2_000);
  assert.equal(formatRate(500), "5,00%");
  assert.equal(competenceLabel("2026-10"), "outubro de 2026");
});

test("o PDF declara os emolumentos, ratifica o livro e cita a lei", () => {
  const settings = {
    ...defaultIssSettings(tenant),
    cnpj: "00.000.000/0001-00",
    municipalLaw: "Lei Complementar Municipal nº 1/2000 (fictícia), art. 10",
  };
  const doc = buildIssDocument(tenant, {
    declaration: {
      competence: "2026-10",
      emolumentsCents: 1_234_567,
      rateBasisPoints: 500,
      damNumber: "0000123",
      dueDate: "2026-11-10",
      paidOn: "",
      notes: "",
      issCents: null,
    },
    settings,
    year: 2026,
    sequence: 3,
    issuedOn: "2026-11-11",
    attachments: 1,
  });
  assert.equal(doc.title, "Declaração de ISS nº 003/2026");
  assert.equal(doc.subtitle, "Competência: outubro de 2026");
  const all = JSON.stringify(doc);
  assert.match(all, /R\$ 12\.345,67/);
  // 5% of 12.345,67 = 617,28 (rounded).
  assert.match(all, /R\$ 617,28/);
  assert.match(
    all,
    /cuja cópia segue anexa e é por esta declaração ratificada/,
  );
  assert.match(all, /Livro Diário Auxiliar da Receita e da Despesa/);
  assert.match(all, /Provimento CN-CNJ nº 259\/2026/);
  assert.match(all, /REsp 1\.328\.384\/RS/);
  assert.match(all, /FDJ, FRMP, FCRCPN e FUNAF\/FPGE/);
  assert.match(all, /Lei Complementar Municipal nº 1\/2000/);
  assert.match(all, /00\.000\.000\/0001-00/);
  // No en/em dashes in what the fisco reads.
  const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
  assert.doesNotMatch(all, dashes);
});

test("ISS apurado ato a ato no relatório: menor que a alíquota sobre o total", () => {
  const declaration = {
    competence: "2026-09",
    emolumentsCents: 200_000,
    rateBasisPoints: 500,
    damNumber: "",
    dueDate: "",
    paidOn: "",
    notes: "",
    // Fictitious: 10.000 would be 5% of the total; acts without ISS lower it.
    issCents: 9_000,
  };
  assert.equal(issOf(declaration), 9_000);
  assert.equal(issOf({ ...declaration, issCents: null }), 10_000);
  const all = JSON.stringify(
    buildIssDocument(tenant, {
      declaration,
      settings: defaultIssSettings(tenant),
      year: 2026,
      sequence: 4,
      issuedOn: "2026-10-05",
      attachments: 3,
    }),
  );
  assert.match(all, /ISS devido \(apurado ato a ato\)/);
  assert.match(all, /R\$ 90,00/);
  assert.match(all, /sobre os emolumentos de cada ato/);
  assert.match(all, /atos sem incidência/);
  assert.match(
    all,
    /cujas cópias seguem anexas e são por esta declaração ratificadas/,
  );
});
