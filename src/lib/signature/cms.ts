import "server-only";
import {
  createHash,
  sign as rsaSign,
  verify as rsaVerify,
  X509Certificate,
} from "node:crypto";
import forge from "node-forge";
import { ICP_POLICY } from "@/core/signature/policy.ts";
import type { OpenedCertificate } from "./certificate.ts";

/**
 * The CMS SignedData (RFC 5652) a PAdES signature carries in /Contents,
 * detached, with the four signed attributes the ICP-Brasil policy AD-RB
 * v1.1 asks for (core/signature/policy.ts). Written byte by byte (DER) so
 * the certificates go in exactly as they came, never decoded and re-encoded.
 */

const OID = {
  data: "1.2.840.113549.1.7.1",
  signedData: "1.2.840.113549.1.7.2",
  sha256: "2.16.840.1.101.3.4.2.1",
  sha256WithRSA: "1.2.840.113549.1.1.11",
  contentType: "1.2.840.113549.1.9.3",
  messageDigest: "1.2.840.113549.1.9.4",
  signingCertificateV2: "1.2.840.113549.1.9.16.2.47",
  sigPolicyId: "1.2.840.113549.1.9.16.2.15",
  spqEtsUri: "1.2.840.113549.1.9.16.5.1",
} as const;

/* ------------------------------------------------------------ DER writer */

function length(n: number): Buffer {
  if (n < 0x80) return Buffer.from([n]);
  const bytes: number[] = [];
  for (let rest = n; rest > 0; rest >>= 8) bytes.unshift(rest & 0xff);
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}
const tlv = (tag: number, ...parts: Buffer[]): Buffer => {
  const body = Buffer.concat(parts);
  return Buffer.concat([Buffer.from([tag]), length(body.length), body]);
};
const seq = (...parts: Buffer[]) => tlv(0x30, ...parts);
const set = (...parts: Buffer[]) => tlv(0x31, ...parts);
/** DER sorts a SET OF by its members' encodings. */
const setOf = (tag: number, members: Buffer[]) =>
  tlv(tag, ...[...members].sort(Buffer.compare));
const oid = (value: string) =>
  tlv(0x06, Buffer.from(forge.asn1.oidToDer(value).getBytes(), "binary"));
const octets = (bytes: Buffer) => tlv(0x04, bytes);
const ia5 = (text: string) => tlv(0x16, Buffer.from(text, "ascii"));
const int1 = tlv(0x02, Buffer.from([1]));
const nullValue = Buffer.from([0x05, 0x00]);
const algorithm = (id: string) => seq(oid(id), nullValue);
const contextConstructed = (n: number, ...parts: Buffer[]) =>
  tlv(0xa0 | n, ...parts);

/* ------------------------------------------------------------ DER reader */

interface Element {
  start: number;
  contentStart: number;
  end: number;
}

function readElement(buf: Buffer, start: number): Element {
  let len = buf[start + 1];
  let contentStart = start + 2;
  if (len & 0x80) {
    const count = len & 0x7f;
    len = 0;
    for (let i = 0; i < count; i++) len = len * 256 + buf[start + 2 + i];
    contentStart += count;
  }
  return { start, contentStart, end: contentStart + len };
}

function children(buf: Buffer, parent: Element): Element[] {
  const out: Element[] = [];
  for (let at = parent.contentStart; at < parent.end; ) {
    const child = readElement(buf, at);
    out.push(child);
    at = child.end;
  }
  return out;
}

/** issuer and serialNumber, the bytes as the certificate encodes them. */
export function issuerAndSerial(certDer: Buffer): {
  issuer: Buffer;
  serial: Buffer;
} {
  const cert = readElement(certDer, 0);
  const tbs = children(certDer, cert)[0];
  const fields = children(certDer, tbs);
  // A v3 certificate opens with the explicit [0] version.
  const offset = certDer[fields[0].start] === 0xa0 ? 1 : 0;
  const slice = (e: Element) => certDer.subarray(e.start, e.end);
  return { serial: slice(fields[offset]), issuer: slice(fields[offset + 2]) };
}

/* ------------------------------------------------------------- SignedData */

/** The four attributes, each one DER on its own. */
function signedAttributes(contentDigest: Buffer, holderDer: Buffer): Buffer[] {
  const { issuer, serial } = issuerAndSerial(holderDer);
  // ESSCertIDv2 with the default algorithm (SHA-256) leaves it out.
  const essCertIdV2 = seq(
    octets(createHash("sha256").update(holderDer).digest()),
    // IssuerSerial: GeneralNames with the directoryName [4], then serial.
    seq(seq(contextConstructed(4, issuer)), serial),
  );
  const policy = seq(
    oid(ICP_POLICY.oid),
    seq(
      algorithm(OID.sha256),
      octets(Buffer.from(ICP_POLICY.sha256Hex, "hex")),
    ),
    seq(seq(oid(OID.spqEtsUri), ia5(ICP_POLICY.uri))),
  );
  const attribute = (type: string, value: Buffer) => seq(oid(type), set(value));
  return [
    attribute(OID.contentType, oid(OID.data)),
    attribute(OID.messageDigest, octets(contentDigest)),
    attribute(OID.signingCertificateV2, seq(seq(essCertIdV2))),
    attribute(OID.sigPolicyId, policy),
  ];
}

/**
 * The bytes the holder's key signs (SHA-256 with RSA): the signed
 * attributes as a SET OF with its universal tag. Same input, same bytes,
 * so a key kept elsewhere (an A3 token) can sign them and the platform
 * rebuild them to assemble the SignedData.
 */
export function attributesToSign(
  contentDigest: Buffer,
  holderDer: Buffer,
): Buffer {
  return setOf(0x31, signedAttributes(contentDigest, holderDer));
}

/** True when `signature` is the holder's key over `toBeSigned`. */
export function signatureMatches(
  toBeSigned: Buffer,
  signature: Buffer,
  holderDer: Buffer,
): boolean {
  try {
    const key = new X509Certificate(holderDer).publicKey;
    return rsaVerify("sha256", toBeSigned, key, signature);
  } catch {
    return false;
  }
}

/**
 * The detached SignedData over `contentDigest` (the SHA-256 of the PDF's
 * byte ranges), DER.
 */
export function buildSignedData(
  contentDigest: Buffer,
  certificate: OpenedCertificate,
): Buffer {
  const signature = rsaSign(
    "sha256",
    attributesToSign(contentDigest, certificate.holderDer),
    forge.pki.privateKeyToPem(certificate.privateKey),
  );
  return assembleSignedData(
    contentDigest,
    certificate.holderDer,
    certificate.chainDer,
    signature,
  );
}

/** The SignedData with a signature made elsewhere (A3) or here (A1). */
export function assembleSignedData(
  contentDigest: Buffer,
  holderDer: Buffer,
  chainDer: Buffer[],
  signature: Buffer,
): Buffer {
  const attributes = signedAttributes(contentDigest, holderDer);
  const { issuer, serial } = issuerAndSerial(holderDer);
  const signerInfo = seq(
    int1,
    seq(issuer, serial),
    algorithm(OID.sha256),
    setOf(0xa0, attributes),
    algorithm(OID.sha256WithRSA),
    octets(signature),
  );
  const signedData = seq(
    int1,
    set(algorithm(OID.sha256)),
    seq(oid(OID.data)),
    setOf(0xa0, chainDer),
    set(signerInfo),
  );
  return seq(oid(OID.signedData), contextConstructed(0, signedData));
}
