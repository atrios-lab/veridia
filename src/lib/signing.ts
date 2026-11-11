import "server-only";
import { createHash, randomBytes } from "node:crypto";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
} from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { PANEL_ROLES } from "@/core/auth/roles.ts";
import { ICP_POLICY } from "@/core/signature/policy.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { user } from "@/db/auth-schema.ts";
import type { Database } from "@/db/index.ts";
import {
  serviceRequestAttachments,
  signedDocumentSignatures,
  signedDocuments,
  signingCertificateSigners,
  signingCertificates,
} from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import {
  type CertificateInfo,
  type ExternalCertificate,
  externalCertificate,
  type OpenedCertificate,
  openCertificate,
} from "./signature/certificate.ts";
import {
  assembleSignedData,
  attributesToSign,
  signatureMatches,
} from "./signature/cms.ts";
import {
  addSignaturePlaceholder,
  embedSignature,
  hasSignature,
  preparedDigest,
  prepareSignature,
  signPdf,
  signPlaceholder,
} from "./signature/pades.ts";
import { stampForSignature } from "./signature/stamp.ts";
import {
  openSealedCertificate,
  openToken,
  sealCertificate,
  sealToken,
} from "./signature/vault.ts";
import {
  deleteStoredFile,
  readStoredFile,
  storeOfficePdf,
  storeSignedPdf,
} from "./uploads.ts";

/** Six months for the signed file; the record stays for good. */
export const SIGNED_FILE_MONTHS = 6;
/** What a platform function can take in one request, with room to spare. */
export const MAX_PDF_BYTES = 4 * 1024 * 1024;

export class SigningError extends Error {}

/* ------------------------------------------------------------ certificates */

export interface CertificateRow {
  id: string;
  label: string;
  holderName: string;
  holderDocument: string;
  kind: string;
  issuerName: string;
  serialHex: string;
  notBefore: Date;
  notAfter: Date;
  disabledAt: Date | null;
  signers: { userId: string; name: string }[];
}

export async function listCertificatesWith(
  database: Database,
  tenantSlug: string,
): Promise<CertificateRow[]> {
  const rows = await database
    .select({
      id: signingCertificates.id,
      label: signingCertificates.label,
      holderName: signingCertificates.holderName,
      holderDocument: signingCertificates.holderDocument,
      kind: signingCertificates.kind,
      issuerName: signingCertificates.issuerName,
      serialHex: signingCertificates.serialHex,
      notBefore: signingCertificates.notBefore,
      notAfter: signingCertificates.notAfter,
      disabledAt: signingCertificates.disabledAt,
    })
    .from(signingCertificates)
    .where(eq(signingCertificates.tenantSlug, tenantSlug))
    .orderBy(
      asc(signingCertificates.disabledAt),
      asc(signingCertificates.label),
    );
  const ids = rows.map((row) => row.id);
  const grants = ids.length
    ? await database
        .select({
          certificateId: signingCertificateSigners.certificateId,
          userId: signingCertificateSigners.userId,
          name: user.name,
        })
        .from(signingCertificateSigners)
        .innerJoin(user, eq(user.id, signingCertificateSigners.userId))
        .where(
          and(
            eq(signingCertificateSigners.tenantSlug, tenantSlug),
            inArray(signingCertificateSigners.certificateId, ids),
            isNull(signingCertificateSigners.revokedAt),
          ),
        )
    : [];
  return rows.map((row) => ({
    ...row,
    signers: grants
      .filter((grant) => grant.certificateId === row.id)
      .map(({ userId, name }) => ({ userId, name })),
  }));
}

/**
 * Takes an A1 in: opened with its password to prove it opens and to read
 * the holder, then sealed. The password is not kept.
 */
export async function addCertificateWith(
  database: Database,
  tenantSlug: string,
  input: { label: string; pfx: Buffer; password: string },
  actorId: string,
  now = new Date(),
): Promise<CertificateInfo> {
  const opened = openCertificate(input.pfx, input.password);
  if (opened.info.notAfter <= now) {
    throw new SigningError("Este certificado já venceu.");
  }
  const [row] = await database
    .insert(signingCertificates)
    .values({
      tenantSlug,
      label: input.label.trim() || opened.info.holderName,
      holderName: opened.info.holderName,
      holderDocument: opened.info.holderDocument,
      kind: opened.info.kind,
      issuerName: opened.info.issuerName,
      serialHex: opened.info.serialHex,
      fingerprint: opened.info.fingerprint,
      notBefore: opened.info.notBefore,
      notAfter: opened.info.notAfter,
      encryptedPfx: sealCertificate(input.pfx),
      createdBy: actorId,
    })
    .onConflictDoNothing()
    .returning({ id: signingCertificates.id });
  if (!row) throw new SigningError("Este certificado já está cadastrado.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "signing-certificate.add",
    targetType: "signing-certificate",
    targetId: `${row.id} · ${opened.info.holderName}`,
  });
  return opened.info;
}

/** Out of use for good: kept for the record, never signs again. */
export async function disableCertificateWith(
  database: Database,
  tenantSlug: string,
  id: string,
  actorId: string,
): Promise<boolean> {
  const [row] = await database
    .update(signingCertificates)
    .set({ disabledAt: new Date() })
    .where(
      and(
        eq(signingCertificates.tenantSlug, tenantSlug),
        eq(signingCertificates.id, id),
        isNull(signingCertificates.disabledAt),
      ),
    )
    .returning({ id: signingCertificates.id });
  if (!row) return false;
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "signing-certificate.disable",
    targetType: "signing-certificate",
    targetId: id,
  });
  return true;
}

/**
 * Who may sign with the certificate: the panel users of the office the
 * administrator ticked. Grants not ticked any more are revoked (the row
 * stays as the history); new ones are added.
 */
export async function setCertificateSignersWith(
  database: Database,
  tenantSlug: string,
  certificateId: string,
  userIds: string[],
  actorId: string,
): Promise<void> {
  const [certificate] = await database
    .select({ id: signingCertificates.id })
    .from(signingCertificates)
    .where(
      and(
        eq(signingCertificates.tenantSlug, tenantSlug),
        eq(signingCertificates.id, certificateId),
      ),
    )
    .limit(1);
  if (!certificate) throw new SigningError("Certificado não encontrado.");
  // Only people of this office.
  const allowed = userIds.length
    ? (
        await database
          .select({ id: user.id })
          .from(user)
          .where(
            and(eq(user.tenantSlug, tenantSlug), inArray(user.id, userIds)),
          )
      ).map((row) => row.id)
    : [];
  const current = await database
    .select({ userId: signingCertificateSigners.userId })
    .from(signingCertificateSigners)
    .where(
      and(
        eq(signingCertificateSigners.certificateId, certificateId),
        isNull(signingCertificateSigners.revokedAt),
      ),
    );
  const had = new Set(current.map((row) => row.userId));
  const want = new Set(allowed);
  const revoke = [...had].filter((id) => !want.has(id));
  const grant = [...want].filter((id) => !had.has(id));
  if (revoke.length) {
    await database
      .update(signingCertificateSigners)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(signingCertificateSigners.certificateId, certificateId),
          inArray(signingCertificateSigners.userId, revoke),
          isNull(signingCertificateSigners.revokedAt),
        ),
      );
  }
  if (grant.length) {
    await database.insert(signingCertificateSigners).values(
      grant.map((userId) => ({
        certificateId,
        tenantSlug,
        userId,
        grantedBy: actorId,
      })),
    );
  }
  await recordAuditWith(database, {
    tenantSlug,
    actorId,
    action: "signing-certificate.signers",
    targetType: "signing-certificate",
    targetId: `${certificateId} · ${allowed.length} autorizados`,
  });
}

/** The office's active panel accounts: who may be allowed to sign. */
export async function officeSignerCandidatesWith(
  database: Database,
  tenantSlug: string,
): Promise<{ id: string; name: string; role: string }[]> {
  return database
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(
      and(
        eq(user.tenantSlug, tenantSlug),
        inArray(user.role, [...PANEL_ROLES]),
        isNull(user.disabledAt),
      ),
    )
    .orderBy(asc(user.name));
}

/** The certificates this person may sign with now. */
export async function certificatesForSignerWith(
  database: Database,
  tenantSlug: string,
  userId: string,
  now = new Date(),
): Promise<CertificateRow[]> {
  const all = await listCertificatesWith(database, tenantSlug);
  return all.filter(
    (row) =>
      !row.disabledAt &&
      row.notAfter > now &&
      row.signers.some((signer) => signer.userId === userId),
  );
}

async function openForSigning(
  database: Database,
  tenantSlug: string,
  certificateId: string,
  userId: string,
  password: string,
  now: Date,
): Promise<{ opened: OpenedCertificate; id: string }> {
  const [row] = await database
    .select({
      id: signingCertificates.id,
      sealed: signingCertificates.encryptedPfx,
      notAfter: signingCertificates.notAfter,
    })
    .from(signingCertificates)
    .innerJoin(
      signingCertificateSigners,
      and(
        eq(signingCertificateSigners.certificateId, signingCertificates.id),
        eq(signingCertificateSigners.userId, userId),
        isNull(signingCertificateSigners.revokedAt),
      ),
    )
    .where(
      and(
        eq(signingCertificates.tenantSlug, tenantSlug),
        eq(signingCertificates.id, certificateId),
        isNull(signingCertificates.disabledAt),
      ),
    )
    .limit(1);
  if (!row) {
    throw new SigningError(
      "Você não está autorizado a assinar com este certificado.",
    );
  }
  if (row.notAfter <= now) throw new SigningError("Este certificado venceu.");
  return {
    opened: openCertificate(openSealedCertificate(row.sealed), password),
    id: row.id,
  };
}

/* ------------------------------------------------------ signed documents */

/** "AB12CD34EF56": twelve characters with no look-alikes (0/O, 1/I). */
export function newVerificationCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  return [...randomBytes(12)]
    .map((b) => alphabet[b % alphabet.length])
    .join("");
}

const sha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");

function sixMonthsFrom(instant: Date): Date {
  const next = new Date(instant);
  next.setUTCMonth(next.getUTCMonth() + SIGNED_FILE_MONTHS);
  return next;
}

/** Who signed and when, as the band prints it. */
const signerOf = (name: string, at: Date) => ({
  name,
  at: formatOfficeDateTime(at),
});

export interface SignInput {
  certificateId: string;
  password: string;
  pdf: Buffer;
  title: string;
  originalName: string;
  /** Builds the manifest pages to append, given the code; none to skip. */
  manifest?: (
    code: string,
    info: CertificateInfo,
    at: Date,
    original: { sha256: string; pageCount: number },
  ) => Promise<Buffer>;
  verifyUrl: (code: string) => string;
  location: string;
  /**
   * The office as registered on the platform (its official name): printed
   * in capitals on the signature band, beside the signer's full name.
   */
  officeName: string;
}

/**
 * Signs a PDF sent to the assinador: stamps the band and the QR on every
 * page (unless it already carries a signature, which a stamp would break),
 * signs, stores the file for six months and records the signature.
 */
export async function signNewDocumentWith(
  database: Database,
  tenantSlug: string,
  input: SignInput,
  userId: string,
  now = new Date(),
): Promise<{ id: string; code: string }> {
  checkPdf(input.pdf);
  const { opened, id: certificateId } = await openForSigning(
    database,
    tenantSlug,
    input.certificateId,
    userId,
    input.password,
    now,
  );
  const placed = await placeSignature(input, opened.info, now);
  const signed = signPlaceholder(placed.withPlaceholder, opened);
  return saveNewDocument(database, tenantSlug, {
    input: { ...input, originalSha256: sha256(input.pdf) },
    placed,
    signed,
    certificateId,
    info: opened.info,
    userId,
    now,
  });
}

function checkPdf(pdf: Buffer): void {
  if (pdf.length > MAX_PDF_BYTES) {
    throw new SigningError(
      "O PDF passa de 4 MB. Reduza o arquivo e tente de novo.",
    );
  }
  if (pdf.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new SigningError("O arquivo enviado não é um PDF.");
  }
}

interface Placed {
  code: string;
  pageCount: number;
  withPlaceholder: Buffer;
}

/**
 * The band, the QR and the manifest on every page (unless the PDF already
 * carries a signature, which a stamp would break), then the empty
 * signature field: everything but the signature itself, the same for a
 * key kept here (A1) and one kept in a token (A3).
 */
async function placeSignature(
  input: Omit<SignInput, "certificateId" | "password">,
  info: CertificateInfo,
  now: Date,
): Promise<Placed> {
  const code = newVerificationCode();
  const verifyUrl = input.verifyUrl(code);
  let toSign = input.pdf;
  let pageCount = 0;
  const signedElsewhere = hasSignature(input.pdf);
  if (signedElsewhere) {
    pageCount = (await PDFDocument.load(input.pdf)).getPageCount();
  } else {
    const original = {
      sha256: sha256(input.pdf),
      pageCount: (await PDFDocument.load(input.pdf)).getPageCount(),
    };
    const stamped = await stampForSignature(input.pdf, {
      code,
      verifyUrl,
      signer: signerOf(info.holderName, now),
      office: input.officeName,
      manifest: input.manifest
        ? await input.manifest(code, info, now, original)
        : undefined,
    });
    toSign = stamped.pdf;
    pageCount = stamped.pageCount;
  }
  const withPlaceholder = await addSignaturePlaceholder(toSign, {
    signerName: info.holderName,
    reason: `Assinatura digital ICP-Brasil · verificação ${code}`,
    location: input.location,
    signingTime: now,
    // Already signed elsewhere (a CNH, a certidão from another office):
    // its pages cannot take the band, so this signature carries it on the
    // first page, as its visible appearance.
    visible: signedElsewhere
      ? {
          code,
          verifyUrl,
          signer: signerOf(info.holderName, now),
          office: input.officeName,
        }
      : undefined,
  });
  return { code, pageCount, withPlaceholder };
}

async function saveNewDocument(
  database: Database,
  tenantSlug: string,
  args: {
    input: Pick<SignInput, "title" | "originalName"> & {
      originalSha256: string;
    };
    placed: Pick<Placed, "code" | "pageCount">;
    signed: Buffer;
    certificateId: string | null;
    info: CertificateInfo;
    userId: string;
    now: Date;
  },
): Promise<{ id: string; code: string }> {
  const { input, placed, signed, now } = args;
  const path = await storeSignedPdf(tenantSlug, signed);
  const [document] = await database
    .insert(signedDocuments)
    .values({
      tenantSlug,
      code: placed.code,
      title: input.title.trim() || input.originalName,
      originalName: input.originalName,
      originalSha256: input.originalSha256,
      pageCount: placed.pageCount,
      filePath: path,
      fileExpiresAt: sixMonthsFrom(now),
      createdBy: args.userId,
      createdAt: now,
    })
    .returning({ id: signedDocuments.id });
  await recordSignature(database, tenantSlug, {
    documentId: document.id,
    certificateId: args.certificateId,
    info: args.info,
    resultSha256: sha256(signed),
    userId: args.userId,
    at: now,
  });
  return { id: document.id, code: placed.code };
}

async function recordSignature(
  database: Database,
  tenantSlug: string,
  input: {
    documentId: string;
    /** None for an A3: its key never came to the platform. */
    certificateId: string | null;
    info: CertificateInfo;
    resultSha256: string;
    userId: string;
    at: Date;
  },
): Promise<void> {
  await database.insert(signedDocumentSignatures).values({
    documentId: input.documentId,
    tenantSlug,
    certificateId: input.certificateId,
    holderName: input.info.holderName,
    holderDocument: input.info.holderDocument,
    issuerName: input.info.issuerName,
    serialHex: input.info.serialHex,
    policyOid: ICP_POLICY.oid,
    resultSha256: input.resultSha256,
    signedBy: input.userId,
    signedAt: input.at,
  });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: input.userId,
    action: "signed-document.sign",
    targetType: "signed-document",
    targetId: `${input.documentId} · ${input.info.holderName}`,
  });
}

/**
 * One more signature on a document signed here: an incremental update on
 * the stored file, which keeps the earlier signatures valid.
 */
export async function coSignDocumentWith(
  database: Database,
  tenantSlug: string,
  documentId: string,
  input: { certificateId: string; password: string; location: string },
  userId: string,
  now = new Date(),
): Promise<void> {
  const document = await findSignedDocumentWith(database, tenantSlug, {
    id: documentId,
  });
  if (!document) throw new SigningError("Documento não encontrado.");
  if (!document.filePath) {
    throw new SigningError(
      "O arquivo deste documento já saiu do sistema (prazo de 6 meses).",
    );
  }
  const { opened, id: certificateId } = await openForSigning(
    database,
    tenantSlug,
    input.certificateId,
    userId,
    input.password,
    now,
  );
  const current = await readStoredFile(document.filePath);
  const signed = await signPdf(current, opened, {
    signerName: opened.info.holderName,
    reason: `Assinatura digital ICP-Brasil · verificação ${document.code}`,
    location: input.location,
    signingTime: now,
  });
  const path = await storeSignedPdf(tenantSlug, signed);
  await database
    .update(signedDocuments)
    .set({ filePath: path, fileExpiresAt: sixMonthsFrom(now) })
    .where(eq(signedDocuments.id, document.id));
  // The superseded file is the same document with one signature less.
  await deleteStoredFile(document.filePath);
  await recordSignature(database, tenantSlug, {
    documentId: document.id,
    certificateId,
    info: opened.info,
    resultSha256: sha256(signed),
    userId,
    at: now,
  });
}

/* ------------------------------------------- A3: the key stays in the token */

/**
 * An A3 signature in two steps (decision of 11/11/2026). The platform
 * prepares the PDF (band, QR, empty field), keeps it aside and hands the
 * browser the bytes to sign; the assinador local on the office's computer
 * signs them with the token (the driver asks for the PIN); the platform
 * checks the signature against the certificate and finishes the PDF. The
 * private key never leaves the token, and nothing about it is stored.
 */
export const A3_PREPARED_MINUTES = 15;

interface A3Token {
  v: 1;
  tenant: string;
  user: string;
  /** The prepared PDF, kept aside until the signature comes back. */
  path: string;
  /** SHA-256 of the holder's certificate the bytes were prepared for. */
  print: string;
  exp: number;
  mode: "novo" | "coassinatura";
  code: string;
  pageCount: number;
  title: string;
  originalName: string;
  originalSha256: string;
  documentId?: string;
  /** The stored file a co-signature was prepared over. */
  basePath?: string;
}

export interface A3Prepared {
  token: string;
  /** What the token signs: SHA-256 with RSA (PKCS#1 v1.5). */
  toBeSigned: Buffer;
}

export interface A3CertificateInput {
  holderDer: Buffer;
  chainDer: Buffer[];
}

function a3Certificate(
  input: A3CertificateInput,
  now: Date,
): ExternalCertificate {
  const certificate = externalCertificate(input.holderDer, input.chainDer);
  if (!certificate.info.holderDocument) {
    throw new SigningError(
      "Este certificado não traz CPF ou CNPJ: use um certificado ICP-Brasil.",
    );
  }
  if (certificate.info.notAfter <= now) {
    throw new SigningError("Este certificado venceu.");
  }
  if (certificate.info.notBefore > now) {
    throw new SigningError("Este certificado ainda não está valendo.");
  }
  return certificate;
}

async function prepareA3(
  tenantSlug: string,
  userId: string,
  certificate: ExternalCertificate,
  withPlaceholder: Buffer,
  record: Omit<A3Token, "v" | "tenant" | "user" | "path" | "print" | "exp">,
  now: Date,
): Promise<A3Prepared> {
  const { pdf, digest } = prepareSignature(withPlaceholder);
  const path = await storeSignedPdf(tenantSlug, pdf);
  const token: A3Token = {
    v: 1,
    tenant: tenantSlug,
    user: userId,
    path,
    print: certificate.info.fingerprint,
    exp: now.getTime() + A3_PREPARED_MINUTES * 60_000,
    ...record,
  };
  return {
    token: sealToken(token),
    toBeSigned: attributesToSign(digest, certificate.holderDer),
  };
}

/** Step one for a new document: everything but the token's signature. */
export async function prepareA3SignWith(
  tenantSlug: string,
  input: Omit<SignInput, "certificateId" | "password"> & A3CertificateInput,
  userId: string,
  now = new Date(),
): Promise<A3Prepared> {
  checkPdf(input.pdf);
  const certificate = a3Certificate(input, now);
  const placed = await placeSignature(input, certificate.info, now);
  return prepareA3(
    tenantSlug,
    userId,
    certificate,
    placed.withPlaceholder,
    {
      mode: "novo",
      code: placed.code,
      pageCount: placed.pageCount,
      title: input.title.trim() || input.originalName,
      originalName: input.originalName,
      originalSha256: sha256(input.pdf),
    },
    now,
  );
}

/** Step one for one more signature on a document signed here. */
export async function prepareA3CoSignWith(
  database: Database,
  tenantSlug: string,
  documentId: string,
  input: A3CertificateInput & { location: string },
  userId: string,
  now = new Date(),
): Promise<A3Prepared> {
  const document = await findSignedDocumentWith(database, tenantSlug, {
    id: documentId,
  });
  if (!document) throw new SigningError("Documento não encontrado.");
  if (!document.filePath) {
    throw new SigningError(
      "O arquivo deste documento já saiu do sistema (prazo de 6 meses).",
    );
  }
  const certificate = a3Certificate(input, now);
  const current = await readStoredFile(document.filePath);
  const withPlaceholder = await addSignaturePlaceholder(current, {
    signerName: certificate.info.holderName,
    reason: `Assinatura digital ICP-Brasil · verificação ${document.code}`,
    location: input.location,
    signingTime: now,
  });
  return prepareA3(
    tenantSlug,
    userId,
    certificate,
    withPlaceholder,
    {
      mode: "coassinatura",
      code: document.code,
      pageCount: document.pageCount,
      title: document.title,
      originalName: document.originalName,
      originalSha256: document.originalSha256,
      documentId: document.id,
      basePath: document.filePath,
    },
    now,
  );
}

/**
 * Step two: the token's signature comes back. Checked against the
 * certificate before anything is saved; the prepared file is used once.
 */
export async function finishA3SignWith(
  database: Database,
  tenantSlug: string,
  input: A3CertificateInput & { token: string; signature: Buffer },
  userId: string,
  now = new Date(),
): Promise<{ id: string; code: string }> {
  const token = openToken<A3Token>(input.token);
  if (
    !token ||
    token.v !== 1 ||
    token.tenant !== tenantSlug ||
    token.user !== userId
  ) {
    throw new SigningError("Assinatura não reconhecida. Tente de novo.");
  }
  if (token.exp <= now.getTime()) {
    throw new SigningError(
      "A preparação venceu. Assine de novo (vale por 15 minutos).",
    );
  }
  const certificate = a3Certificate(input, now);
  if (certificate.info.fingerprint !== token.print) {
    throw new SigningError(
      "O certificado mudou no meio da assinatura. Tente de novo.",
    );
  }
  let prepared: Buffer;
  try {
    prepared = await readStoredFile(token.path);
  } catch {
    throw new SigningError("Esta assinatura já foi concluída ou cancelada.");
  }
  const digest = preparedDigest(prepared);
  const toBeSigned = attributesToSign(digest, certificate.holderDer);
  if (!signatureMatches(toBeSigned, input.signature, certificate.holderDer)) {
    throw new SigningError(
      "A assinatura do token não confere com o certificado. Nada foi salvo.",
    );
  }
  const signed = embedSignature(
    prepared,
    assembleSignedData(
      digest,
      certificate.holderDer,
      certificate.chainDer,
      input.signature,
    ),
  );
  // The prepared copy is spent: a second "finish" finds nothing.
  await deleteStoredFile(token.path);

  if (token.mode === "novo") {
    return saveNewDocument(database, tenantSlug, {
      input: token,
      placed: token,
      signed,
      certificateId: null,
      info: certificate.info,
      userId,
      now,
    });
  }
  const document = await findSignedDocumentWith(database, tenantSlug, {
    id: token.documentId ?? "",
  });
  if (!document || document.filePath !== token.basePath) {
    throw new SigningError(
      "O documento mudou enquanto você assinava. Assine de novo.",
    );
  }
  const path = await storeSignedPdf(tenantSlug, signed);
  await database
    .update(signedDocuments)
    .set({ filePath: path, fileExpiresAt: sixMonthsFrom(now) })
    .where(eq(signedDocuments.id, document.id));
  if (token.basePath) await deleteStoredFile(token.basePath);
  await recordSignature(database, tenantSlug, {
    documentId: document.id,
    certificateId: null,
    info: certificate.info,
    resultSha256: sha256(signed),
    userId,
    at: now,
  });
  return { id: document.id, code: document.code };
}

export interface SignedDocumentView {
  id: string;
  code: string;
  title: string;
  originalName: string;
  originalSha256: string;
  pageCount: number;
  filePath: string | null;
  fileExpiresAt: Date;
  filePurgedAt: Date | null;
  /** Taken off the office's list; its file is no longer served. */
  removedAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  signatures: {
    holderName: string;
    holderDocument: string;
    issuerName: string;
    serialHex: string;
    resultSha256: string;
    signedAt: Date;
  }[];
}

/**
 * By id (the panel), by code (the QR, the typed code) or by the hash of a
 * file someone sent (the original's or any signed version's). Always within
 * the office whose site asks. Files past their six months are let go first.
 */
export async function findSignedDocumentWith(
  database: Database,
  tenantSlug: string,
  by: { id: string } | { code: string } | { sha256: string },
  now = new Date(),
): Promise<SignedDocumentView | undefined> {
  await purgeExpiredSignedFilesWith(database, tenantSlug, now);
  let documentId: string | undefined;
  if ("sha256" in by) {
    const hash = by.sha256.toLowerCase();
    const [hit] = await database
      .select({ id: signedDocuments.id })
      .from(signedDocuments)
      .leftJoin(
        signedDocumentSignatures,
        eq(signedDocumentSignatures.documentId, signedDocuments.id),
      )
      .where(
        and(
          eq(signedDocuments.tenantSlug, tenantSlug),
          or(
            eq(signedDocuments.originalSha256, hash),
            eq(signedDocumentSignatures.resultSha256, hash),
          ),
        ),
      )
      .limit(1);
    documentId = hit?.id;
    if (!documentId) return undefined;
  }
  const [document] = await database
    .select()
    .from(signedDocuments)
    .where(
      and(
        eq(signedDocuments.tenantSlug, tenantSlug),
        documentId
          ? eq(signedDocuments.id, documentId)
          : "id" in by
            ? eq(signedDocuments.id, by.id)
            : eq(
                signedDocuments.code,
                (by as { code: string }).code
                  .replace(/[^0-9A-Z]/gi, "")
                  .toUpperCase(),
              ),
      ),
    )
    .limit(1);
  if (!document) return undefined;
  const signatures = await database
    .select({
      holderName: signedDocumentSignatures.holderName,
      holderDocument: signedDocumentSignatures.holderDocument,
      issuerName: signedDocumentSignatures.issuerName,
      serialHex: signedDocumentSignatures.serialHex,
      resultSha256: signedDocumentSignatures.resultSha256,
      signedAt: signedDocumentSignatures.signedAt,
    })
    .from(signedDocumentSignatures)
    .where(eq(signedDocumentSignatures.documentId, document.id))
    .orderBy(asc(signedDocumentSignatures.signedAt));
  return {
    id: document.id,
    code: document.code,
    title: document.title,
    originalName: document.originalName,
    originalSha256: document.originalSha256,
    pageCount: document.pageCount,
    // A document taken off the list serves no file, anywhere.
    filePath: document.removedAt ? null : document.filePath,
    fileExpiresAt: document.fileExpiresAt,
    filePurgedAt: document.filePurgedAt,
    removedAt: document.removedAt,
    createdBy: document.createdBy,
    createdAt: document.createdAt,
    signatures,
  };
}

/** The office's signed documents, newest first. */
export async function listSignedDocumentsWith(
  database: Database,
  tenantSlug: string,
  now = new Date(),
  options: { removed?: boolean } = {},
): Promise<SignedDocumentView[]> {
  await purgeExpiredSignedFilesWith(database, tenantSlug, now);
  const documents = await database
    .select({ id: signedDocuments.id })
    .from(signedDocuments)
    .where(
      and(
        eq(signedDocuments.tenantSlug, tenantSlug),
        options.removed
          ? isNotNull(signedDocuments.removedAt)
          : isNull(signedDocuments.removedAt),
      ),
    )
    .orderBy(desc(signedDocuments.createdAt))
    .limit(200);
  const views = await Promise.all(
    documents.map((row) =>
      findSignedDocumentWith(database, tenantSlug, { id: row.id }, now),
    ),
  );
  return views.filter((view): view is SignedDocumentView => Boolean(view));
}

/**
 * Takes a document off the office's list, or puts it back. Nothing is
 * erased: the file stops being served (panel and public page) and the
 * record keeps answering the verification. Audited both ways.
 */
export async function setSignedDocumentRemovedWith(
  database: Database,
  tenantSlug: string,
  id: string,
  removed: boolean,
  userId: string,
  now = new Date(),
): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return false;
  const [row] = await database
    .update(signedDocuments)
    .set(
      removed
        ? { removedAt: now, removedBy: userId }
        : { removedAt: null, removedBy: null },
    )
    .where(
      and(
        eq(signedDocuments.tenantSlug, tenantSlug),
        eq(signedDocuments.id, id),
      ),
    )
    .returning({ code: signedDocuments.code });
  if (!row) return false;
  await recordAuditWith(database, {
    tenantSlug,
    actorId: userId,
    action: removed ? "signed-document.remove" : "signed-document.restore",
    targetType: "signed-document",
    targetId: row.code,
  });
  return true;
}

/**
 * The six months' rule: the file goes, the record stays (decision of
 * 10/11/2026). Run on read, like the request attachments' purge.
 */
export async function purgeExpiredSignedFilesWith(
  database: Database,
  tenantSlug: string,
  now = new Date(),
): Promise<number> {
  const expired = await database
    .select({ id: signedDocuments.id, filePath: signedDocuments.filePath })
    .from(signedDocuments)
    .where(
      and(
        eq(signedDocuments.tenantSlug, tenantSlug),
        isNull(signedDocuments.filePurgedAt),
        lte(signedDocuments.fileExpiresAt, now),
      ),
    );
  for (const row of expired) {
    if (row.filePath) await deleteStoredFile(row.filePath);
    await database
      .update(signedDocuments)
      .set({ filePath: null, filePurgedAt: now })
      .where(eq(signedDocuments.id, row.id));
    await recordAuditWith(database, {
      tenantSlug,
      actorId: null,
      action: "signed-document.file-purge",
      targetType: "signed-document",
      targetId: row.id,
    });
  }
  return expired.length;
}

/* ------------------------------------------------- delivery to the citizen */

/** Biggest delivered file read to tell whether it is signed. */
const CHECK_LIMIT = 15 * 1024 * 1024;

/** Whether a stored PDF already carries a digital signature. */
export async function storedPdfIsSigned(path: string): Promise<boolean> {
  return hasSignature(await readStoredFile(path));
}

/**
 * Which of the office's delivered PDFs carry no digital signature: the ones
 * the panel reminds the clerk to sign before the citizen downloads them.
 */
export async function unsignedDeliveries(
  attachments: {
    id: string;
    kind: string;
    mimeType: string;
    path: string | null;
    sizeBytes: number;
    physicalSignatureAt?: Date | null;
  }[],
): Promise<Set<string>> {
  const pdfs = attachments.filter(
    (a) =>
      a.kind === "office" &&
      // Confirmed as signed by hand and scanned: nothing to remind.
      !a.physicalSignatureAt &&
      a.mimeType === "application/pdf" &&
      a.path &&
      a.sizeBytes <= CHECK_LIMIT,
  );
  const checked = await Promise.all(
    pdfs.map(async (a) => ({
      id: a.id,
      signed: await storedPdfIsSigned(a.path ?? "").catch(() => true),
    })),
  );
  return new Set(checked.filter((c) => !c.signed).map((c) => c.id));
}

/**
 * Signs a document already delivered to the citizen: the assinador signs it
 * (band, QR, record, six months), and the delivered file becomes the signed
 * version, so the citizen downloads the paper with legal value. The row is
 * updated, not replaced; the unsigned file it pointed to goes.
 */
export async function signDeliveredDocumentWith(
  database: Database,
  tenantSlug: string,
  input: {
    requestId: string;
    attachmentId: string;
    protocolNumber: string;
    certificateId: string;
    password: string;
    verifyUrl: (code: string) => string;
    location: string;
    officeName: string;
  },
  userId: string,
  now = new Date(),
): Promise<{ id: string; code: string }> {
  const [attachment] = await database
    .select()
    .from(serviceRequestAttachments)
    .where(
      and(
        eq(serviceRequestAttachments.tenantSlug, tenantSlug),
        eq(serviceRequestAttachments.requestId, input.requestId),
        eq(serviceRequestAttachments.id, input.attachmentId),
        eq(serviceRequestAttachments.kind, "office"),
      ),
    )
    .limit(1);
  if (!attachment?.path || attachment.mimeType !== "application/pdf") {
    throw new SigningError("Documento entregue não encontrado.");
  }
  const original = await readStoredFile(attachment.path);
  if (hasSignature(original)) {
    throw new SigningError("Este documento já está assinado digitalmente.");
  }
  const signedDocument = await signNewDocumentWith(
    database,
    tenantSlug,
    {
      certificateId: input.certificateId,
      password: input.password,
      pdf: original,
      title: `Documento do pedido ${input.protocolNumber}`,
      originalName: `${attachment.displayName}.pdf`,
      verifyUrl: input.verifyUrl,
      location: input.location,
      officeName: input.officeName,
    },
    userId,
    now,
  );
  const view = await findSignedDocumentWith(
    database,
    tenantSlug,
    { id: signedDocument.id },
    now,
  );
  if (!view?.filePath) throw new SigningError("Assinatura sem arquivo.");
  const signed = await readStoredFile(view.filePath);
  const stored = await storeOfficePdf(tenantSlug, signed);
  await database
    .update(serviceRequestAttachments)
    .set({
      path: stored.path,
      storedName: stored.storedName,
      sizeBytes: signed.length,
    })
    .where(eq(serviceRequestAttachments.id, attachment.id));
  await deleteStoredFile(attachment.path);
  await recordAuditWith(database, {
    tenantSlug,
    actorId: userId,
    action: "service-request.delivery-signed",
    targetType: "service-request",
    targetId: `${input.requestId} · ${signedDocument.code}`,
  });
  return signedDocument;
}

/**
 * Does a file sent to the client carry a digital signature? Only a PDF
 * can (decision of 11/11/2026): an image never does.
 */
export function fileHasDigitalSignature(
  bytes: Buffer,
  mimeType: string,
): boolean {
  return mimeType === "application/pdf" && hasSignature(bytes);
}

/**
 * The clerk confirms that files sent with no digital signature are
 * dematerialized documents, signed by hand and scanned (decision of
 * 11/11/2026). Recorded on each file and in the audit.
 */
export async function confirmPhysicalSignatureWith(
  database: Database,
  tenantSlug: string,
  requestId: string,
  storedNames: string[],
  who: { id: string; name: string },
  now = new Date(),
): Promise<void> {
  if (!storedNames.length) return;
  const rows = await database
    .update(serviceRequestAttachments)
    .set({ physicalSignatureAt: now, physicalSignatureBy: who.name })
    .where(
      and(
        eq(serviceRequestAttachments.tenantSlug, tenantSlug),
        eq(serviceRequestAttachments.requestId, requestId),
        eq(serviceRequestAttachments.kind, "office"),
        inArray(serviceRequestAttachments.storedName, storedNames),
      ),
    )
    .returning({ displayName: serviceRequestAttachments.displayName });
  for (const row of rows) {
    await recordAuditWith(database, {
      tenantSlug,
      actorId: who.id,
      action: "service-request.delivery-physical",
      targetType: "service-request",
      targetId: `${requestId} · ${row.displayName}`,
      reason:
        "Confirmou que é documento desmaterializado: assinado à mão e digitalizado, sem assinatura digital.",
    });
  }
}
