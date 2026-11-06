import assert from "node:assert/strict";
import { test } from "node:test";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { buildRequestDocuments } from "./request-documents.ts";

const TENANT = TENANTS["cartorio-marinho"];

const stored = (details: unknown) =>
  ({
    actId: "rcpn-certidao",
    protocolNumber: "REQ.2026.000148",
    applicantName: "Maria",
    contact: "maria@exemplo.com",
    cpf: null,
    description: null,
    purpose: null,
    parameterValue: null,
    createdAt: new Date("2026-08-04T12:00:00Z"),
    details,
  }) as unknown as Parameters<typeof buildRequestDocuments>[1];

function actRow(details: unknown): string | undefined {
  const [document] =
    buildRequestDocuments(TENANT, stored(details), "requerimento") ?? [];
  assert.ok(document && "sections" in document);
  return document.sections
    .flatMap((section) => ("rows" in section ? (section.rows ?? []) : []))
    .find((row) => row.label === "Ato requerido")?.value;
}

test("the requerimento reads the kind of act off the stored request", () => {
  assert.equal(actRow({ actVariant: "casamento" }), "Certidão de casamento");
});

test("a request with no kind stored keeps the act's own name", () => {
  assert.equal(actRow({}), "Certidão (nascimento, casamento, óbito)");
});
