import assert from "node:assert/strict";
import { test } from "node:test";
import { getAct } from "../acts/catalog.ts";
import {
  generateAccessKey,
  hashAccessKey,
  normalizeAccessKey,
  verifyAccessKey,
} from "./access-key.ts";
import {
  checkAttachments,
  displayFileName,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  storedFileName,
} from "./attachment.ts";
import {
  formatCpf,
  formatPhone,
  isValidContact,
  isValidCpf,
  looksLikeBot,
  maskCpf,
  serviceRequestSchema,
} from "./form.ts";
import { formatProtocolNumber, parseProtocolNumber } from "./protocol.ts";

const certificate = getAct("rcpn-certidao");
const other = getAct("outros-rcpn");
const search = getAct("ri-busca-indicador");
if (!certificate || !other || !search) throw new Error("catalogo incompleto");

const valid = {
  applicantName: "Maria José da Silva",
  contact: "(84) 99999-0000",
  cpf: "",
  description: "Certidão de nascimento em inteiro teor.",
  purpose: "",
  parameterValue: "",
  lgpdConsent: "on",
  truthDeclaration: "on",
};

test("protocol number is formatted for a human to dictate", () => {
  assert.equal(formatProtocolNumber("REQ", 2026, 148), "REQ.2026.000148");
  assert.equal(formatProtocolNumber("AGD", 2026, 1), "AGD.2026.000001");
});

test("protocol number refuses what it cannot represent", () => {
  assert.throws(() => formatProtocolNumber("REQ", 2026, 0));
  assert.throws(() => formatProtocolNumber("REQ", 2026, 1_000_000));
  assert.throws(() => formatProtocolNumber("REQ", 1999, 1));
});

test("protocol number survives the way people type it back", () => {
  for (const typed of [
    "REQ.2026.000148",
    "  req.2026.000148 ",
    "REQ. 2026. 000148",
  ]) {
    assert.deepEqual(parseProtocolNumber(typed), {
      prefix: "REQ",
      year: 2026,
      sequence: 148,
    });
  }
  for (const wrong of ["REQ.2026.148", "2026.000148", "REQUERIMENTO", ""]) {
    assert.equal(parseProtocolNumber(wrong), undefined, wrong);
  }
});

test("access key avoids the characters people misread", () => {
  for (let i = 0; i < 200; i++) {
    const key = generateAccessKey();
    assert.match(key, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.equal(/[ILOU01]/.test(key), false, key);
  }
});

test("access keys do not repeat", () => {
  const keys = new Set(Array.from({ length: 500 }, () => generateAccessKey()));
  assert.equal(keys.size, 500);
});

test("the key verifies through the punctuation a person adds", () => {
  const key = generateAccessKey();
  const hash = hashAccessKey(key);
  assert.ok(verifyAccessKey(key, hash));
  assert.ok(verifyAccessKey(key.toLowerCase(), hash));
  assert.ok(verifyAccessKey(key.replace(/-/g, " "), hash));
  assert.ok(verifyAccessKey(normalizeAccessKey(key), hash));
});

test("a wrong key never verifies", () => {
  const hash = hashAccessKey(generateAccessKey());
  assert.equal(verifyAccessKey(generateAccessKey(), hash), false);
  assert.equal(verifyAccessKey("", hash), false);
  // A hash of the wrong length must be refused, not thrown at.
  assert.equal(verifyAccessKey("ABCD-EFGH-JKMN", "abcd"), false);
});

test("the stored key is never the key itself", () => {
  const key = generateAccessKey();
  const hash = hashAccessKey(key);
  assert.equal(hash.length, 64);
  assert.equal(hash.includes(normalizeAccessKey(key)), false);
});

test("CPF is checked by its own check digits", () => {
  assert.ok(isValidCpf("529.982.247-25"));
  assert.equal(isValidCpf("529.982.247-24"), false);
  assert.equal(isValidCpf("111.111.111-11"), false);
  assert.equal(isValidCpf("1234567890"), false);
});

test("contact accepts an e-mail or a phone with area code", () => {
  assert.ok(isValidContact("maria@example.com"));
  assert.ok(isValidContact("(84) 99999-0000"));
  assert.ok(isValidContact("8440420940"));
  assert.equal(isValidContact("maria"), false);
  assert.equal(isValidContact("99999-0000"), false);
});

test("a complete request is accepted and trimmed", () => {
  const parsed = serviceRequestSchema(certificate).parse({
    ...valid,
    applicantName: "  Maria   José  ",
  });
  assert.equal(parsed.applicantName, "Maria José");
  assert.equal(parsed.cpf, undefined);
});

test("fields the act does not render may be absent entirely", () => {
  // react-hook-form only registers what is on the screen: purpose and
  // parameterValue arrive as undefined for the acts that do not ask them.
  const { purpose: _p, parameterValue: _v, ...rest } = valid;
  const parsed = serviceRequestSchema(certificate).safeParse(rest);
  assert.ok(parsed.success);
});

test("both acceptances are required to submit", () => {
  for (const missing of ["lgpdConsent", "truthDeclaration"]) {
    const result = serviceRequestSchema(certificate).safeParse({
      ...valid,
      [missing]: "",
    });
    assert.equal(result.success, false, missing);
    assert.equal(result.error?.issues[0].path[0], missing);
  }
});

test("an act outside the catalog cannot be sent without a description", () => {
  const result = serviceRequestSchema(other).safeParse({
    ...valid,
    description: "",
  });
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0].path[0], "description");
  assert.ok(serviceRequestSchema(other).safeParse(valid).success);
});

test("purpose is demanded only by the acts the law allows to ask", () => {
  // A certificate may never require it (Lei 6.015 art. 17).
  assert.ok(serviceRequestSchema(certificate).safeParse(valid).success);
  const result = serviceRequestSchema(search).safeParse(valid);
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0].path[0], "purpose");
});

test("CPF mask grows with the typing and caps at eleven digits", () => {
  assert.equal(formatCpf("123"), "123");
  assert.equal(formatCpf("1234"), "123.4");
  assert.equal(formatCpf("1234567"), "123.456.7");
  assert.equal(formatCpf("12345678909"), "123.456.789-09");
  assert.equal(formatCpf("123456789091"), "123.456.789-09");
  assert.equal(formatCpf("123.456.789-09"), "123.456.789-09");
});

test("phone mask covers mobile, landline and the typing in between", () => {
  assert.equal(formatPhone("8"), "(8");
  assert.equal(formatPhone("849"), "(84) 9");
  assert.equal(formatPhone("8499000000"), "(84) 9900-0000");
  assert.equal(formatPhone("84990000000"), "(84) 99000-0000");
  assert.equal(formatPhone("(84) 99000-0000"), "(84) 99000-0000");
});

test("CPF shown to an operator hides everything but the ends", () => {
  assert.equal(maskCpf("529.982.247-25"), "529.***.***-25");
  assert.equal(maskCpf("52998224725"), "529.***.***-25");
});

test("phone mask leaves an e-mail alone", () => {
  assert.equal(formatPhone("voce@exemplo.com"), "voce@exemplo.com");
  assert.equal(formatPhone("v"), "v");
  assert.equal(formatPhone(""), "");
});

test("the honeypot only reacts to something being typed into it", () => {
  assert.equal(looksLikeBot(null), false);
  assert.equal(looksLikeBot(""), false);
  assert.equal(looksLikeBot("   "), false);
  assert.ok(looksLikeBot("http://spam.example"));
});

test("attachments are held to type, size and count", () => {
  const ok = { mimeType: "image/jpeg", size: 1024 };
  assert.equal(checkAttachments([]), undefined);
  assert.equal(checkAttachments([ok, ok]), undefined);
  assert.equal(
    checkAttachments(Array(MAX_ATTACHMENTS + 1).fill(ok))?.kind,
    "too-many",
  );
  assert.equal(
    checkAttachments([{ mimeType: "application/zip", size: 10 }])?.kind,
    "type",
  );
  assert.equal(
    checkAttachments([
      { mimeType: "image/png", size: MAX_ATTACHMENT_BYTES + 1 },
    ])?.kind,
    "size",
  );
});

test("stored and displayed names carry nothing from the sender", () => {
  assert.equal(storedFileName("application/pdf", "abc123"), "abc123.pdf");
  assert.equal(storedFileName("image/jpeg", "abc123"), "abc123.jpg");
  assert.equal(storedFileName("text/x-weird", "abc123"), "abc123.bin");
  assert.equal(displayFileName(0), "anexo-1");
});
