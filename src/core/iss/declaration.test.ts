import assert from "node:assert/strict";
import { test } from "node:test";
import { TENANTS } from "@/core/tenant/resolve.ts";
import {
  buildIssDocument,
  competenceLabel,
  defaultIssSettings,
  formatRate,
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
    },
    settings,
    year: 2026,
    sequence: 3,
    issuedOn: "2026-11-11",
    withAttachment: true,
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
  assert.match(all, /FDJ, FRMP, FCRCPN e FUNAF/);
  assert.match(all, /Lei Complementar Municipal nº 1\/2000/);
  assert.match(all, /00\.000\.000\/0001-00/);
  // No en/em dashes in what the fisco reads.
  const dashes = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);
  assert.doesNotMatch(all, dashes);
});
