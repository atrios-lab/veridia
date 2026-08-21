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
  checkUploadedAttachments,
  displayFileName,
  isGeneratedAttachmentPath,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS,
  resolveMimeType,
  storedFileName,
} from "./attachment.ts";
import {
  formatCpf,
  formatPhone,
  isEmailContact,
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

test("only an e-mail contact can be written to", () => {
  // The gate every notice passes through: the office answers a requerimento or
  // a manifestação and the citizen is written to only if there is a mailbox.
  // A telephone is a valid contact and not somewhere to send mail, and an
  // anonymous manifestação has no contact at all: both are ordinary states of
  // the channels, never a delivery that failed.
  assert.ok(isEmailContact("maria@example.com"));
  assert.ok(isEmailContact("  maria@example.com  "), "espaços são aparados");

  assert.equal(isEmailContact("(84) 99999-0000"), false);
  assert.equal(isEmailContact("8440420940"), false);
  assert.equal(isEmailContact(""), false);
  // Conservative on purpose: anything that does not clearly match is treated
  // as "not an e-mail", so a notice never fires at a malformed address.
  assert.equal(isEmailContact("maria@"), false);
  assert.equal(isEmailContact("maria arroba exemplo.com"), false);
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

function heicHeader(brand: string): Uint8Array {
  const bytes = new Uint8Array(12);
  bytes.set([0, 0, 0, 0x18], 0);
  for (const [index, char] of [...`ftyp${brand}`].entries()) {
    bytes[4 + index] = char.charCodeAt(0);
  }
  return bytes;
}

test("a silent browser is answered by the file's own header", () => {
  // Chrome on Windows hands a .heic file over with no type at all.
  assert.equal(
    resolveMimeType("foto.HEIC", "", heicHeader("heic")),
    "image/heic",
  );
  assert.equal(
    resolveMimeType("foto.heif", "", heicHeader("mif1")),
    "image/heic",
  );
  // No bytes to read: the client rejects early on the extension alone, and
  // the server still gets the last word.
  assert.equal(resolveMimeType("foto.heic", ""), "image/heic");
  // A renamed executable has the extension but never the brand.
  assert.equal(resolveMimeType("virus.heic", "", heicHeader("exe!")), "");
  assert.equal(resolveMimeType("virus.heic", "", new Uint8Array(4)), "");
  assert.equal(resolveMimeType("documento.zip", ""), "");
  // A browser that names the type is believed; the allowlist judges it next.
  assert.equal(resolveMimeType("foto.heic", "image/png"), "image/png");
});

test("uploaded references are held to the limits and to our own store", () => {
  const host = "blob.example.com";
  const ok = {
    url: `https://${host}/anexos/abc.pdf`,
    mimeType: "application/pdf",
    size: 1024,
  };
  assert.equal(checkUploadedAttachments([ok, ok], host), undefined);
  assert.equal(
    checkUploadedAttachments(
      [{ ...ok, url: "https://attacker.example/anexos/abc.pdf" }],
      host,
    )?.kind,
    "origin",
  );
  assert.equal(
    checkUploadedAttachments([{ ...ok, url: "nao-e-url" }], host)?.kind,
    "origin",
  );
  // No store configured is not a reason to trust whatever arrives.
  assert.equal(checkUploadedAttachments([ok], "")?.kind, "origin");
  // The batch limits still apply before the URL is even looked at.
  assert.equal(
    checkUploadedAttachments([{ ...ok, size: MAX_ATTACHMENT_BYTES + 1 }], host)
      ?.kind,
    "size",
  );
  assert.equal(
    checkUploadedAttachments([ok, ok, ok], host, 2)?.kind,
    "too-many",
  );
});

test("only a name this system would have generated for this tenant may be uploaded", () => {
  const generated = `anexos/${storedFileName("application/pdf", "0f8fad5b-d9cb-469f-a165-70867728950e", "cartorio-marinho")}`;
  assert.ok(isGeneratedAttachmentPath(generated, "cartorio-marinho"));
  // Another tenant's site may never write into this one's folder.
  assert.equal(isGeneratedAttachmentPath(generated, "1o-tabelionato"), false);
  // The citizen's own file name is exactly what must never be stored.
  assert.equal(
    isGeneratedAttachmentPath(
      "anexos/cartorio-marinho/maria-jose-rg.pdf",
      "cartorio-marinho",
    ),
    false,
  );
  // Nor may an upload land outside the attachments folder.
  assert.equal(
    isGeneratedAttachmentPath(
      "marca/cartorio-marinho/0f8fad5b-d9cb-469f-a165-70867728950e.pdf",
      "cartorio-marinho",
    ),
    false,
  );
  // Nor the old, flat shape from before tenants had their own folder.
  assert.equal(
    isGeneratedAttachmentPath(
      "anexos/0f8fad5b-d9cb-469f-a165-70867728950e.pdf",
      "cartorio-marinho",
    ),
    false,
  );
  assert.equal(
    isGeneratedAttachmentPath(
      "anexos/cartorio-marinho/../../marca/0f8fad5b-d9cb-469f-a165-70867728950e.pdf",
      "cartorio-marinho",
    ),
    false,
  );
  assert.equal(
    isGeneratedAttachmentPath(
      "anexos/cartorio-marinho/0f8fad5b-d9cb-469f-a165-70867728950e.exe",
      "cartorio-marinho",
    ),
    false,
  );
  // A malformed slug never gets interpolated into the check.
  assert.equal(
    isGeneratedAttachmentPath(generated, "cartorio-marinho/../marca"),
    false,
  );
});

test("stored and displayed names carry nothing from the sender", () => {
  assert.equal(
    storedFileName("application/pdf", "abc123", "cartorio-marinho"),
    "cartorio-marinho/abc123.pdf",
  );
  assert.equal(
    storedFileName("image/jpeg", "abc123", "cartorio-marinho"),
    "cartorio-marinho/abc123.jpg",
  );
  assert.equal(
    storedFileName("text/x-weird", "abc123", "cartorio-marinho"),
    "cartorio-marinho/abc123.bin",
  );
  assert.equal(displayFileName(0), "anexo-1");
});
