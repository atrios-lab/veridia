import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { before, test } from "node:test";
import forge from "node-forge";
import {
  type CertificateDocument,
  readSigningCertificate,
  renderCertificatePdf,
  type SigningCertificate,
  SigningUnavailableError,
} from "./certificate-pdf.ts";

// The certificate PDF, signed with a throwaway A1 made here: the same shape
// as an ICP-Brasil e-CNPJ (CN "RAZÃO SOCIAL:CNPJ"), self-signed. What is
// checked is what a reader checks: the signature covers every byte but its
// own, and the digest it carries is the digest of those bytes.

const DOC: CertificateDocument = {
  fullName: "Maria da Silva",
  cpf: "52998224725",
  roleTitle: "Escrevente",
  tenantName: "Cartório de Serra Verde/RN",
  courseTitle: "LGPD no cartório",
  workloadHours: 2,
  score: 80,
  issuedAt: new Date("2026-11-07T15:00:00Z"),
  code: "AB12-CD34-EF56",
  validationUrl: "https://demo.atrioss.com/certificado/AB12-CD34-EF56",
  instructorName: "Joelison Alves Marinho",
};

let signer: SigningCertificate;

function testP12(passphrase: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date("2026-01-01T00:00:00Z");
  cert.validity.notAfter = new Date("2027-01-01T00:00:00Z");
  const subject = [
    { name: "commonName", value: "ATRIOS TESTE LTDA:12345678000190" },
  ];
  cert.setSubject(subject);
  cert.setIssuer(subject);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], passphrase, {
    algorithm: "3des",
  });
  return Buffer.from(forge.asn1.toDer(asn1).getBytes(), "binary");
}

before(() => {
  signer = readSigningCertificate(testP12("senha-teste"), "senha-teste");
});

test("the holder is read from the certificate, CNPJ apart", () => {
  assert.equal(signer.holder.name, "ATRIOS TESTE LTDA");
  assert.equal(signer.holder.cnpj, "12345678000190");
  assert.equal(signer.holder.validUntil.getUTCFullYear(), 2027);
});

/** The two signed byte ranges and the signature's own hex contents. */
function signatureParts(pdf: Buffer) {
  const text = pdf.toString("latin1");
  const range = /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/.exec(
    text,
  );
  assert.ok(range, "a /ByteRange");
  const [a, b, c, d] = range.slice(1).map(Number);
  const signed = Buffer.concat([
    pdf.subarray(a, a + b),
    pdf.subarray(c, c + d),
  ]);
  const hex = pdf
    .subarray(a + b + 1, c - 1)
    .toString("latin1")
    .replace(/0+$/, "");
  return { signed, hex };
}

/** The message digest the PKCS#7 signature carries, as hex. */
function signedDigest(hex: string): string {
  const der = forge.util.hexToBytes(hex.length % 2 ? `${hex}0` : hex);
  const message = forge.pkcs7.messageFromAsn1(
    forge.asn1.fromDer(der),
  ) as unknown as {
    rawCapture: { authenticatedAttributes: forge.asn1.Asn1[] };
  };
  for (const attribute of message.rawCapture.authenticatedAttributes) {
    const [oid, values] = attribute.value as forge.asn1.Asn1[];
    if (
      forge.asn1.derToOid(oid.value as string) === forge.pki.oids.messageDigest
    ) {
      const digest = (values.value as forge.asn1.Asn1[])[0].value as string;
      return forge.util.bytesToHex(digest);
    }
  }
  throw new Error("no messageDigest");
}

test("a signed certificate's digest is the digest of every other byte", async () => {
  const pdf = await renderCertificatePdf(DOC, signer, { production: true });
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.match(pdf.toString("latin1"), /\/SubFilter\s*\/adbe\.pkcs7\.detached/);
  const { signed, hex } = signatureParts(pdf);
  const expected = createHash("sha256").update(signed).digest("hex");
  assert.equal(signedDigest(hex), expected);

  // One byte changed in the signed part: the digest no longer matches.
  // A byte in the page content, well inside the first signed range (the
  // header is %PDF-1.x and a comment line; 200 is past it).
  const tampered = Buffer.from(pdf);
  tampered[200] = tampered[200] ^ 0xff;
  const after = signatureParts(tampered);
  assert.notEqual(
    createHash("sha256").update(after.signed).digest("hex"),
    signedDigest(after.hex),
  );
});

/** How many pages the document says it has. */
function pageCount(pdf: Buffer): number {
  const counts = [...pdf.toString("latin1").matchAll(/\/Count\s+(\d+)/g)];
  assert.ok(counts.length > 0, "a /Count");
  return Math.max(...counts.map((m) => Number(m[1])));
}

test("the syllabus becomes a back page; without it, the front alone", async () => {
  const front = await renderCertificatePdf(DOC, null, { production: false });
  assert.equal(pageCount(front), 1);
  const both = await renderCertificatePdf(
    {
      ...DOC,
      syllabus: [
        {
          label: "Apresentação",
          title: "Apresentação do curso",
          description: "",
        },
        {
          label: "Aula 1",
          title: "O que é a LGPD",
          description: "A lei e os **quatro papéis**.\n\nSegundo parágrafo.",
        },
        {
          label: "Encerramento",
          title: "Conclusão e certificado",
          description: "",
        },
      ],
      passingScore: 70,
    },
    signer,
    { production: true },
  );
  assert.equal(pageCount(both), 2);
});

test("without a signing certificate: a test document outside production, nothing in it", async () => {
  const draft = await renderCertificatePdf(DOC, null, { production: false });
  assert.equal(draft.subarray(0, 5).toString(), "%PDF-");
  assert.doesNotMatch(draft.toString("latin1"), /\/ByteRange/);
  await assert.rejects(
    renderCertificatePdf(DOC, null, { production: true }),
    SigningUnavailableError,
  );
});
