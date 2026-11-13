import assert from "node:assert/strict";
import { test } from "node:test";
import {
  certificateCheckUrl,
  certificateCode,
  certificateOfficeName,
  certificateRequestSchema,
  certificateSentence,
  normalizeCertificateCode,
  publicCertificate,
  publicCpf,
} from "./certificate.ts";

// A valid CPF made up for tests (check digits right, never issued to
// anyone we know of).
const CPF = "52998224725";

test("a code is 12 Crockford characters in three groups", () => {
  const code = certificateCode(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
  assert.match(
    code,
    /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
  );
  assert.notEqual(
    code,
    certificateCode(new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1])),
  );
});

test("a typed code is normalised; anything else is null", () => {
  assert.equal(normalizeCertificateCode("ab12cd34ef56"), "AB12-CD34-EF56");
  assert.equal(normalizeCertificateCode("AB12-CD34-EF56"), "AB12-CD34-EF56");
  assert.equal(normalizeCertificateCode("AB12-CD34-EF5"), null);
  // I, L, O and U are not in the alphabet.
  assert.equal(normalizeCertificateCode("IL0U-CD34-EF56"), null);
});

test("the public CPF hides the first three and the last two digits", () => {
  assert.equal(publicCpf(CPF), "***.982.247-**");
  assert.equal(publicCpf("123"), "***.***.***-**");
});

test("the request needs a full name, a valid CPF and a role", () => {
  const ok = certificateRequestSchema.safeParse({
    fullName: "  Maria   da Silva ",
    cpf: "529.982.247-25",
    roleTitle: "Escrevente",
  });
  assert.ok(ok.success);
  assert.deepEqual(ok.data, {
    fullName: "Maria da Silva",
    cpf: CPF,
    roleTitle: "Escrevente",
  });
  for (const bad of [
    { fullName: "Maria", cpf: CPF, roleTitle: "Escrevente" },
    { fullName: "Maria Silva", cpf: "52998224724", roleTitle: "Escrevente" },
    { fullName: "Maria Silva", cpf: CPF, roleTitle: "E" },
  ]) {
    assert.equal(certificateRequestSchema.safeParse(bad).success, false);
  }
});

test("the sentence carries the facts, with the CPF full or masked", () => {
  const facts = {
    fullName: "Maria da Silva",
    cpf: CPF,
    roleTitle: "Escrevente",
    tenantName: "Cartório de Serra Verde/RN",
    courseTitle: "LGPD no cartório",
    workloadHours: 2,
    score: 80,
    issuedAt: new Date("2026-11-07T15:00:00Z"),
  };
  assert.equal(
    certificateSentence(facts, "full"),
    'Certificamos que Maria da Silva, CPF 529.982.247-25, Escrevente do Cartório de Serra Verde/RN, concluiu o curso "LGPD no cartório", com carga horária de 2 horas e aproveitamento de 80%, em 07/11/2026.',
  );
  assert.match(
    certificateSentence(facts, "public"),
    /CPF \*\*\*\.982\.247-\*\*/,
  );
});

test("a participation certificate says the person took part, with no score", () => {
  const facts = {
    fullName: "Maria da Silva",
    cpf: CPF,
    roleTitle: "Escrevente",
    tenantName: "Ofício Único de Serra Verde / RN",
    courseTitle: "Segurança da informação no cartório",
    workloadHours: 1,
    score: null,
    issuedAt: new Date("2026-11-07T15:00:00Z"),
  };
  assert.equal(
    certificateSentence(facts, "full"),
    'Certificamos que Maria da Silva, CPF 529.982.247-25, Escrevente do Ofício Único de Serra Verde / RN, participou do curso "Segurança da informação no cartório", com carga horária de 1 hora, em 07/11/2026.',
  );
  const view = publicCertificate({ ...facts, code: "AB12-CD34-EF56" });
  assert.equal(view.kind, "participation");
  assert.equal(view.score, null);
});

test("the check address is the Átrios site, overridable", () => {
  assert.equal(
    certificateCheckUrl("AB12-CD34-EF56"),
    "https://atrioss.com/certificado/AB12-CD34-EF56",
  );
  assert.equal(
    certificateCheckUrl("AB12-CD34-EF56", "https://teste.example/certificado/"),
    "https://teste.example/certificado/AB12-CD34-EF56",
  );
});

test("the public view masks the CPF and carries nothing else of the row", () => {
  const view = publicCertificate({
    code: "AB12-CD34-EF56",
    fullName: "Maria da Silva",
    cpf: CPF,
    roleTitle: "Escrevente",
    tenantName: "Cartório de Serra Verde/RN",
    courseTitle: "LGPD no cartório",
    workloadHours: 2,
    score: 80,
    // 23h in Natal on 07/11 is already 08/11 in UTC: the date is Natal's.
    issuedAt: new Date("2026-11-08T02:00:00Z"),
  });
  assert.equal(view.cpf, "***.982.247-**");
  assert.equal(view.issuedOn, "2026-11-07");
  assert.equal(view.issuedOnText, "07/11/2026");
  assert.deepEqual(Object.keys(view).sort(), [
    "code",
    "courseTitle",
    "cpf",
    "fullName",
    "issuedOn",
    "issuedOnText",
    "kind",
    "roleTitle",
    "score",
    "signedBy",
    "tenantName",
    "valid",
    "workloadHours",
  ]);
});

test("outside a cohort, the certificate names the office by its official name", () => {
  assert.equal(
    certificateOfficeName({ subtitle: "Ofício Único de Ielmo Marinho / RN" }),
    "Ofício Único de Ielmo Marinho / RN",
  );
});
