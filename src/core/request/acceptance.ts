import { createHash } from "node:crypto";
import type { CertificateType } from "../acts/catalog.ts";
import {
  FEE_EXEMPTION_ACKNOWLEDGEMENTS,
  FEE_EXEMPTION_DECLARATION,
} from "../acts/catalog.ts";
import type { ExemptionBeneficiary } from "./kinds.ts";

export interface AcceptanceHashInput {
  tenantSlug: string;
  protocolNumber: string;
  declaredAt: string;
  actId?: string;
  certificateType?: CertificateType;
  beneficiaries: ExemptionBeneficiary[];
}

/** Deterministic JSON: object keys sorted, no whitespace. `JSON.stringify`
 * alone is not enough because it keeps insertion order, and the same
 * beneficiary built by two different code paths (site, balcão) could insert
 * its fields in a different order and hash differently for identical data. */
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/**
 * The fields of one beneficiary's declaração that belong to what was
 * *accepted*, not to what happened to it afterward: `witnesses` are
 * collected at the counter, after the aceite (Provimento CGJ/TJRN
 * n. 7/2026, art. 7º III), so two identical declarações printed before and
 * after the balcão adds testemunhas still hash the same, which is correct:
 * the person did not re-accept anything by signing in front of witnesses.
 */
function canonicalBeneficiary(beneficiary: ExemptionBeneficiary) {
  return {
    name: beneficiary.name,
    cpfOrId: beneficiary.cpfOrId ?? null,
    birthDate: beneficiary.birthDate ?? null,
    occupation: beneficiary.occupation ?? null,
    address: beneficiary.address ?? null,
    cityState: beneficiary.cityState ?? null,
    zip: beneficiary.zip ?? null,
    contact: beneficiary.contact ?? null,
    signedBy: beneficiary.signedBy,
    signer: beneficiary.signer
      ? {
          name: beneficiary.signer.name,
          cpfOrId: beneficiary.signer.cpfOrId ?? null,
          contact: beneficiary.signer.contact ?? null,
          capacity: beneficiary.signer.capacity ?? null,
          proofDocument: beneficiary.signer.proofDocument ?? null,
        }
      : null,
  };
}

/**
 * SHA-256 hex of the content a beneficiary accepted: the serventia, the
 * protocol, when it was accepted, which ato and which beneficiaries, and the
 * declaração's own text in the wording it carried at that moment. Not a
 * hash of any PDF's bytes: a PDF is redrawn on every download (the seal or
 * the palette can change) and cannot contain a hash of itself. This is
 * deterministic and needs no secret: anyone holding the pedido's data can
 * recompute it and compare it to what a printed declaração shows, which is
 * the point of printing it on the carimbo at all (`buildStamp`).
 *
 * `beneficiaries` is the request's own list; `witnesses` and the office's
 * `decision` are deliberately not part of what is hashed (see
 * `canonicalBeneficiary` and the omitted `decision` parameter): they are
 * collected or decided after the aceite, not part of it. Two pedidos with
 * the same beneficiaries but different protocols or instants hash
 * differently, because `protocolNumber` and `declaredAt` are part of the
 * input; and because `FEE_EXEMPTION_DECLARATION` and
 * `FEE_EXEMPTION_ACKNOWLEDGEMENTS` are part of it too, a change to that
 * wording changes every hash computed from that point on (see the comment
 * on `FEE_EXEMPTION_DECLARATION`).
 */
export function acceptanceHash(input: AcceptanceHashInput): string {
  const canonical = canonicalJson({
    tenantSlug: input.tenantSlug,
    protocolNumber: input.protocolNumber,
    declaredAt: input.declaredAt,
    actId: input.actId ?? null,
    certificateType: input.certificateType ?? null,
    beneficiaries: input.beneficiaries.map(canonicalBeneficiary),
    declaration: FEE_EXEMPTION_DECLARATION,
    acknowledgements: FEE_EXEMPTION_ACKNOWLEDGEMENTS,
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}
