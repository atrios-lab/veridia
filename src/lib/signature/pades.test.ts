import assert from "node:assert/strict";
import { createHash, verify } from "node:crypto";
import { test } from "node:test";
import forge from "node-forge";
import PDFDocument from "pdfkit";
import { ICP_POLICY } from "@/core/signature/policy.ts";
import {
  CertificatePasswordError,
  holderOf,
  openCertificate,
} from "./certificate.ts";
import { hasSignature, signPdf } from "./pades.ts";
import { createTestPki } from "./test-pki.ts";

// A made-up chain and made-up people only (LGPD).
const pki = createTestPki();
const maria = pki.issue(
  "MARIA EXEMPLO DA SILVA:52998224725",
  "senha-teste",
  "0a",
);
const office = pki.issue(
  "CARTORIO EXEMPLO LTDA:11222333000181",
  "outra-senha",
  "0b",
);

function samplePdf(): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.text("Documento de teste, com dados fictícios.");
    doc.addPage().text("Segunda página.");
    doc.end();
  });
}

/** The whole first TLV: the CMS without the zero padding after it. */
function derLength(buf: Buffer): number {
  const first = buf[1];
  if (!(first & 0x80)) return 2 + first;
  const count = first & 0x7f;
  let len = 0;
  for (let i = 0; i < count; i++) len = len * 256 + buf[2 + i];
  return 2 + count + len;
}

interface Extracted {
  byteRange: number[];
  covered: Buffer;
  cms: Buffer;
}

function signatures(pdf: Buffer): Extracted[] {
  const latin = pdf.toString("latin1");
  const out: Extracted[] = [];
  const re = /\/ByteRange \[(\d+) (\d+) (\d+) (\d+)\s*\]/g;
  for (let m = re.exec(latin); m; m = re.exec(latin)) {
    const r = m.slice(1).map(Number);
    const all = Buffer.from(latin.slice(r[1] + 1, r[2] - 1), "hex");
    out.push({
      byteRange: r,
      covered: Buffer.concat([
        pdf.subarray(r[0], r[0] + r[1]),
        pdf.subarray(r[2], r[2] + r[3]),
      ]),
      cms: all.subarray(0, derLength(all)),
    });
  }
  return out;
}

/** Reads the signer's attributes and checks the RSA signature over them. */
function check(sig: Extracted, publicKeyPem: string) {
  const asn1 = forge.asn1.fromDer(sig.cms.toString("binary"));
  const signedData = (asn1.value[1] as forge.asn1.Asn1)
    .value[0] as forge.asn1.Asn1;
  const parts = signedData.value as forge.asn1.Asn1[];
  const signerInfo = (parts[parts.length - 1].value as forge.asn1.Asn1[])[0];
  const fields = signerInfo.value as forge.asn1.Asn1[];
  const attrs = fields[3];
  const signature = Buffer.from(fields[5].value as string, "binary");
  // Signed as a universal SET: swap the [0] tag back.
  const attrsDer = Buffer.from(forge.asn1.toDer(attrs).getBytes(), "binary");
  attrsDer[0] = 0x31;
  const oids = (attrs.value as forge.asn1.Asn1[]).map((a) =>
    forge.asn1.derToOid((a.value as forge.asn1.Asn1[])[0].value as string),
  );
  const digestAttr = (attrs.value as forge.asn1.Asn1[]).find(
    (a) =>
      forge.asn1.derToOid((a.value as forge.asn1.Asn1[])[0].value as string) ===
      "1.2.840.113549.1.9.4",
  );
  const digest = Buffer.from(
    ((digestAttr?.value as forge.asn1.Asn1[])[1].value as forge.asn1.Asn1[])[0]
      .value as string,
    "binary",
  );
  return {
    oids,
    digestMatches: digest.equals(
      createHash("sha256").update(sig.covered).digest(),
    ),
    signatureValid: verify("sha256", attrsDer, publicKeyPem, signature),
  };
}

function publicKeyOf(pfx: Buffer, password: string): string {
  const opened = openCertificate(pfx, password);
  const cert = forge.pki.certificateFromAsn1(
    forge.asn1.fromDer(opened.holderDer.toString("binary")),
  );
  return forge.pki.publicKeyToPem(cert.publicKey);
}

test("o certificado A1 diz quem é o titular e recusa a senha errada", () => {
  const opened = openCertificate(maria, "senha-teste");
  assert.equal(opened.info.holderName, "MARIA EXEMPLO DA SILVA");
  assert.equal(opened.info.holderDocument, "52998224725");
  assert.equal(opened.info.kind, "cpf");
  assert.equal(opened.info.issuerName, "AC Teste Veridia");
  assert.equal(opened.chainDer.length, 2);
  assert.throws(
    () => openCertificate(maria, "errada"),
    CertificatePasswordError,
  );
  assert.deepEqual(holderOf("CARTORIO EXEMPLO LTDA:11222333000181"), {
    name: "CARTORIO EXEMPLO LTDA",
    document: "11222333000181",
    kind: "cnpj",
  });
});

test("a assinatura segue a política AD-RB da ICP-Brasil e cobre o documento todo", async () => {
  const original = await samplePdf();
  assert.equal(hasSignature(original), false);
  const signed = await signPdf(
    original,
    openCertificate(maria, "senha-teste"),
    {
      signerName: "MARIA EXEMPLO DA SILVA",
      reason: "Assinatura de teste",
      location: "Natal/RN",
      signingTime: new Date("2026-11-10T12:00:00Z"),
    },
  );
  assert.ok(signed.subarray(0, original.length).equals(original));
  assert.ok(hasSignature(signed));
  assert.match(
    signed.toString("latin1"),
    /\/SubFilter \/ETSI\.CAdES\.detached/,
  );

  const [sig] = signatures(signed);
  // Everything but the signature value itself.
  assert.equal(sig.byteRange[0], 0);
  assert.equal(sig.byteRange[2] + sig.byteRange[3], signed.length);
  const result = check(sig, publicKeyOf(maria, "senha-teste"));
  assert.ok(result.digestMatches);
  assert.ok(result.signatureValid);
  assert.deepEqual(
    new Set(result.oids),
    new Set([
      "1.2.840.113549.1.9.3",
      "1.2.840.113549.1.9.4",
      "1.2.840.113549.1.9.16.2.47",
      "1.2.840.113549.1.9.16.2.15",
    ]),
  );
  // The policy's identifier and hash travel inside.
  const der = sig.cms.toString("binary");
  assert.ok(der.includes(forge.asn1.oidToDer(ICP_POLICY.oid).getBytes()));
  assert.ok(sig.cms.includes(Buffer.from(ICP_POLICY.sha256Hex, "hex")));
});

test("um segundo assinante não invalida a primeira assinatura", async () => {
  const first = await signPdf(
    await samplePdf(),
    openCertificate(maria, "senha-teste"),
    {
      signerName: "MARIA EXEMPLO DA SILVA",
      reason: "Primeira",
      location: "Natal/RN",
      signingTime: new Date("2026-11-10T12:00:00Z"),
    },
  );
  const second = await signPdf(first, openCertificate(office, "outra-senha"), {
    signerName: "CARTORIO EXEMPLO LTDA",
    reason: "Segunda",
    location: "Natal/RN",
    signingTime: new Date("2026-11-10T12:05:00Z"),
  });
  assert.ok(second.subarray(0, first.length).equals(first));
  const [one, two] = signatures(second);
  assert.ok(check(one, publicKeyOf(maria, "senha-teste")).signatureValid);
  assert.ok(check(one, publicKeyOf(maria, "senha-teste")).digestMatches);
  assert.ok(check(two, publicKeyOf(office, "outra-senha")).signatureValid);
  assert.ok(check(two, publicKeyOf(office, "outra-senha")).digestMatches);
  // Both fields in the form.
  assert.match(second.toString("latin1"), /Assinatura 2/);
});

test("PDF já assinado em outro lugar recebe a assinatura visível (faixa e QR) sem invalidar a anterior", async () => {
  const elsewhere = await signPdf(
    await samplePdf(),
    openCertificate(office, "outra-senha"),
    {
      signerName: "CARTORIO EXEMPLO LTDA",
      reason: "Emitido em outro lugar",
      location: "Natal/RN",
      signingTime: new Date("2026-11-10T12:00:00Z"),
    },
  );
  const ours = await signPdf(elsewhere, openCertificate(maria, "senha-teste"), {
    signerName: "MARIA EXEMPLO DA SILVA",
    reason: "Assinatura visível",
    location: "Natal/RN",
    signingTime: new Date("2026-11-10T12:05:00Z"),
    visible: {
      code: "AB12CD34EF56",
      verifyUrl: "https://cartorio.exemplo/verificar/AB12CD34EF56",
      signer: { name: "MARIA EXEMPLO DA SILVA", at: "10/11/2026, 09:05" },
    },
  });
  assert.ok(ours.subarray(0, elsewhere.length).equals(elsewhere));
  const [one, two] = signatures(ours);
  assert.ok(check(one, publicKeyOf(office, "outra-senha")).digestMatches);
  assert.ok(check(two, publicKeyOf(maria, "senha-teste")).digestMatches);
  assert.ok(check(two, publicKeyOf(maria, "senha-teste")).signatureValid);
  // The second widget has a size and an appearance on the first page.
  const latin = ours.subarray(elsewhere.length).toString("latin1");
  assert.match(latin, /\/AP <<\s*\/N \d+ 0 R\s*>>/);
  assert.doesNotMatch(latin, /\/T \(Assinatura 2\)[\s\S]*\/Rect \[ 0 0 0 0 \]/);
  // pdf-lib still opens it.
  const { PDFDocument: Reader } = await import("pdf-lib");
  assert.equal((await Reader.load(ours)).getPageCount(), 2);
});
