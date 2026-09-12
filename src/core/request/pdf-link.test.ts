import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type PdfLink,
  pdfLinkFileName,
  signPdfLink,
  verifyPdfLink,
} from "./pdf-link.ts";

const KEY = Buffer.from("chave-de-teste-sem-valor-nenhum-0123456789");
const OTHER_KEY = Buffer.from("outra-chave-de-teste-sem-valor-nenhum-0123");
const NOW = 1_800_000_000;

const link: PdfLink = {
  tenantSlug: "ielmo-marinho",
  protocolNumber: "REQ.2026.000295",
  documento: "declaracao",
  expiresAt: NOW + 3600,
};

test("a signed link verifies back to the same fields", () => {
  const token = signPdfLink(link, KEY);
  assert.deepEqual(verifyPdfLink(token, KEY, NOW), link);
});

test("the token has the shape the route puts in a query string", () => {
  const token = signPdfLink(link, KEY);
  // base64url on both sides of a single dot: nothing to percent-encode, so
  // the URL the browser refetches is byte for byte the one it was given.
  assert.match(token, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
});

test("a tampered signature is refused", () => {
  const token = signPdfLink(link, KEY);
  const [payload, signature] = token.split(".");
  const flipped = (signature[0] === "A" ? "B" : "A") + signature.slice(1);
  assert.equal(verifyPdfLink(`${payload}.${flipped}`, KEY, NOW), null);
});

test("a tampered payload is refused even with the old signature", () => {
  const token = signPdfLink(link, KEY);
  const [, signature] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({ ...link, p: "REQ.2026.000001" }),
  ).toString("base64url");
  assert.equal(verifyPdfLink(`${forged}.${signature}`, KEY, NOW), null);
});

test("a token signed with another key is refused", () => {
  const token = signPdfLink(link, OTHER_KEY);
  assert.equal(verifyPdfLink(token, KEY, NOW), null);
});

test("an expired link is refused, on the second it expires", () => {
  const token = signPdfLink(link, KEY);
  assert.notEqual(verifyPdfLink(token, KEY, link.expiresAt - 1), null);
  assert.equal(verifyPdfLink(token, KEY, link.expiresAt), null);
  assert.equal(verifyPdfLink(token, KEY, link.expiresAt + 1), null);
});

test("the fields travel intact: tenant, protocol and document are bound", () => {
  // The route compares these against the host's tenant and the requested
  // document; what this pins down is that the token cannot be read as
  // anything but what it was signed for.
  const token = signPdfLink(link, KEY);
  const verified = verifyPdfLink(token, KEY, NOW);
  assert.equal(verified?.tenantSlug, "ielmo-marinho");
  assert.equal(verified?.protocolNumber, "REQ.2026.000295");
  assert.equal(verified?.documento, "declaracao");
});

test("a payload naming a document that cannot be linked is refused", () => {
  // Signed with the right key, so only the document check can reject it:
  // the receipt carries the access key and must never be reachable by link.
  const payload = Buffer.from(
    JSON.stringify({
      t: link.tenantSlug,
      p: link.protocolNumber,
      d: "comprovante",
      e: link.expiresAt,
    }),
  ).toString("base64url");
  const [, signature] = signPdfLink(link, KEY).split(".");
  // Re-sign the forged payload honestly, to isolate the document check.
  const honest = signPdfLink(
    { ...link, documento: "comprovante" as PdfLink["documento"] },
    KEY,
  );
  assert.equal(verifyPdfLink(honest, KEY, NOW), null);
  assert.equal(verifyPdfLink(`${payload}.${signature}`, KEY, NOW), null);
});

test("malformed input returns null instead of throwing", () => {
  for (const bad of [
    "",
    ".",
    "abc",
    "abc.",
    ".abc",
    "not-base64!.sig",
    `${Buffer.from("not json").toString("base64url")}.sig`,
    `${Buffer.from("null").toString("base64url")}.sig`,
    `${Buffer.from("[]").toString("base64url")}.sig`,
  ]) {
    assert.doesNotThrow(() => verifyPdfLink(bad, KEY, NOW));
    assert.equal(verifyPdfLink(bad, KEY, NOW), null);
  }
});

test("the file name is the document and the protocol", () => {
  assert.equal(
    pdfLinkFileName("declaracao", "REQ.2026.000295"),
    "declaracao-REQ.2026.000295.pdf",
  );
  assert.equal(
    pdfLinkFileName("requerimento", "REQ.2026.000295"),
    "requerimento-REQ.2026.000295.pdf",
  );
});
