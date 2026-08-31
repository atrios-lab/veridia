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
  isTenantAttachmentPath,
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
  publicServiceRequestSchema,
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

// What the site sends, as opposed to what the counter sends: the two
// identification fields instead of the either/or one.
const validOnline = {
  ...valid,
  contact: undefined,
  email: "maria@exemplo.com",
  phone: "(84) 99999-0000",
  exemptionRequested: "",
  exemptionDeclaration: "",
};

test("a request filed on the site is refused without an e-mail", () => {
  // The whole point of the split: a request with nowhere to write to is a
  // request the citizen never hears back about.
  for (const email of ["", "maria@", "84999990000"]) {
    const result = publicServiceRequestSchema(certificate).safeParse({
      ...validOnline,
      email,
    });
    assert.equal(result.success, false, email);
    assert.equal(result.error?.issues[0].path[0], "email");
  }
});

test("the telephone is optional on the site, and checked when given", () => {
  const absent = publicServiceRequestSchema(certificate).safeParse({
    ...validOnline,
    phone: "",
  });
  assert.ok(absent.success);
  assert.equal(absent.data.phone, undefined);

  // Punctuation is presentation: the office types it either way.
  const bare = publicServiceRequestSchema(certificate).safeParse({
    ...validOnline,
    phone: "84999990000",
  });
  assert.ok(bare.success);
  assert.equal(bare.data.phone, "84999990000");

  const tooShort = publicServiceRequestSchema(certificate).safeParse({
    ...validOnline,
    phone: "9999-0000",
  });
  assert.equal(tooShort.success, false);
  assert.equal(tooShort.error?.issues[0].path[0], "phone");
});

test("the act's own rules hold on both filings", () => {
  // One copy of the rules, two schemas: an act outside the catalogue cannot
  // be read without a description, whichever counter it came through.
  const online = publicServiceRequestSchema(other).safeParse({
    ...validOnline,
    description: "",
  });
  assert.equal(online.success, false);
  assert.equal(online.error?.issues[0].path[0], "description");

  const counter = serviceRequestSchema(other).safeParse({
    ...valid,
    description: "",
  });
  assert.equal(counter.success, false);
  assert.equal(counter.error?.issues[0].path[0], "description");
});

test("the counter keeps the either/or contact", () => {
  // The way out for whoever has no e-mail: the operator files it with a
  // telephone, which the public form no longer accepts.
  assert.ok(serviceRequestSchema(certificate).safeParse(valid).success);
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

test("a blob read back from the store is accepted despite its random suffix", () => {
  // What the store actually names the blob: the generated name plus the
  // suffix it appends itself. Checking this against the shape the upload
  // route enforces would refuse every real upload.
  const stored =
    "anexos/cartorio-bom-jesus/0f8fad5b-d9cb-469f-a165-70867728950e-Xy9Ab2Cd3Ef.pdf";
  assert.ok(isTenantAttachmentPath(stored, "cartorio-bom-jesus"));
  assert.equal(isGeneratedAttachmentPath(stored, "cartorio-bom-jesus"), false);
  // The folder is still the boundary: another tenant's blob is refused.
  assert.equal(isTenantAttachmentPath(stored, "cartorio-marinho"), false);
  assert.equal(
    isTenantAttachmentPath(
      "marca/cartorio-bom-jesus/0f8fad5b-x.pdf",
      "cartorio-bom-jesus",
    ),
    false,
  );
  // Nor may a nested path smuggle another tenant's folder past the check.
  assert.equal(
    isTenantAttachmentPath(
      "anexos/cartorio-bom-jesus/../cartorio-marinho/x.pdf",
      "cartorio-bom-jesus",
    ),
    false,
  );
  assert.equal(
    isTenantAttachmentPath(stored, "cartorio-bom-jesus/../marca"),
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

test("a gratuidade exige a declaração que a acompanha", () => {
  // Marcar a caixa não basta: o que tem valor é a declaração, que autoriza a
  // conferência no sistema de benefício e nomeia as penas.
  const semDeclaracao = publicServiceRequestSchema(certificate).safeParse({
    ...validOnline,
    exemptionRequested: "on",
  });
  assert.equal(semDeclaracao.success, false);
  assert.equal(semDeclaracao.error?.issues[0].path[0], "exemptionDeclaration");

  const completo = publicServiceRequestSchema(certificate).safeParse({
    ...validOnline,
    exemptionRequested: "on",
    exemptionDeclaration: "on",
  });
  assert.ok(completo.success);
});

test("gratuidade em ato sem previsão legal é recusada no servidor", () => {
  // Esconder a caixa é cortesia; isto é o controle. `search` (busca por
  // indicador) não tem `feeExemption`, e nem tudo marcado a faz passar.
  assert.equal(search.feeExemption, undefined);
  const result = publicServiceRequestSchema(search).safeParse({
    ...validOnline,
    purpose: "Levantamento de bens",
    exemptionRequested: "on",
    exemptionDeclaration: "on",
  });
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0].path[0], "exemptionRequested");
});

test("um pedido sem gratuidade não ganha exigência nenhuma", () => {
  const result = publicServiceRequestSchema(certificate).safeParse(validOnline);
  assert.ok(result.success);
  assert.equal(result.data.exemptionRequested, false);
});

test("o aceite faltante é acusado mesmo no ato que não oferece gratuidade", () => {
  // Regressão cara: os campos de isenção só são registrados no formulário dos
  // atos isentáveis, então nos demais o react-hook-form não os manda. Com
  // `z.coerce.boolean()` puro, o objeto base falhava neles ("expected
  // nonoptional"), o superRefine nunca rodava e os erros de aceite sumiam da
  // tela. O envio travava sem dizer nada, em qualquer ato.
  const semIsencao = { ...validOnline };
  delete (semIsencao as { exemptionRequested?: string }).exemptionRequested;
  delete (semIsencao as { exemptionDeclaration?: string }).exemptionDeclaration;
  assert.equal(search.feeExemption, undefined);

  const result = publicServiceRequestSchema(search).safeParse({
    ...semIsencao,
    purpose: "Levantamento de bens",
    lgpdConsent: "",
  });
  assert.equal(result.success, false);
  assert.equal(result.error?.issues[0].path[0], "lgpdConsent");
});
