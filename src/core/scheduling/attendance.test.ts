import assert from "node:assert/strict";
import { test } from "node:test";
import type { Tenant } from "../tenant/schema.ts";
import {
  ATTENDANCE_SIGNEE,
  buildAttendanceDeclaration,
  writtenDate,
} from "./attendance.ts";

const tenant = {
  name: "Cartório Exemplo",
  subtitle: "Ofício Único",
  cns: "123456",
  address: "Rua das Flores, 10, Centro",
  contacts: { phone: "(84) 3000-0000", email: "cartorio@exemplo.com" },
  location: { city: "Ielmo Marinho", state: "RN" },
  legalFooter: "Serventia extrajudicial",
} as unknown as Tenant;

test("the declaration states who came, when, free, and who signs", () => {
  const declaration = buildAttendanceDeclaration(tenant, {
    citizenName: "Maria Souza",
    cpf: "12345678909",
    date: "2026-11-06",
    slotTime: "09:00",
    protocolNumber: "AGD.2026.000007",
    issuedOn: "2026-11-09",
    siteDomain: "cartorio.exemplo",
    validationCode: "XYZ",
  });
  // The letterhead carries "República Federativa do Brasil"; the eyebrow
  // does not repeat it.
  assert.equal(declaration.eyebrow, "Atendimento na serventia");
  assert.equal(declaration.title, "Declaração de Comparecimento");
  assert.match(declaration.subtitle, /Código de validação XYZ/);
  // The CNS is published nowhere.
  assert.doesNotMatch(JSON.stringify(declaration), /CNS|123456/);
  const text = declaration.sections
    .flatMap((section) => section.paragraphs ?? [])
    .join("\n");
  assert.match(
    text,
    /Maria Souza, inscrito\(a\) no CPF sob o nº 123\.456\.789-09, compareceu a esta serventia, Cartório Exemplo, situada em Rua das Flores, 10, Centro, no dia 06\/11\/2026, no horário das 09:00 às 10:00/,
  );
  assert.match(text, /Lei nº 8\.935\/1994, arts\. 3º e 20/);
  assert.match(text, /sem cobrança de emolumentos/);
  assert.match(
    text,
    /leia o QR Code no alto desta folha, acesse o site da serventia \(cartorio\.exemplo\) ou ligue para \(84\) 3000-0000, informando o código de validação XYZ/,
  );
  assert.doesNotMatch(text, /localhost/);
  assert.match(text, /Ielmo Marinho\/RN, 9 de novembro de 2026\./);
  assert.equal(declaration.signee, ATTENDANCE_SIGNEE);
  assert.deepEqual(declaration.signature, ["(assinatura e carimbo)"]);
});

test("the purpose of the visit stays off the declaration", () => {
  const declaration = buildAttendanceDeclaration(tenant, {
    citizenName: "João",
    cpf: null,
    date: "2026-11-06",
    slotTime: "14:00",
    protocolNumber: null,
    issuedOn: "2026-11-06",
    siteDomain: "cartorio.exemplo",
    validationCode: "c",
  });
  const text = JSON.stringify(declaration);
  assert.doesNotMatch(text, /divórcio|testamento|inventário|serviço/i);
  assert.equal(writtenDate("2026-03-01"), "1 de março de 2026");
});
