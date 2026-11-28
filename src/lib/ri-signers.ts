import "server-only";
import { and, eq } from "drizzle-orm";
import type { Tenant } from "@/core/tenant/schema.ts";
import type { Database } from "@/db/index.ts";
import { officeStaff, riSettings } from "@/db/schema.ts";
import { recordAuditWith } from "./audit.ts";
import { type Actor, RiError } from "./ri.ts";
import { riSignerFor } from "./ri-docs.ts";
import {
  foldName,
  rawSignatureSettingsWith,
  signerImagesWith,
} from "./ri-files.ts";
import { cleanSignature } from "./ri-tiff.ts";

/**
 * Who signs and rubricates the books, termos and índices of the Registro de
 * Imóveis (decision of 28/11/2026): any person of "Quem assina", each with
 * their own signature and rubrica, chosen at each print; and how: the
 * rubrica on every folha, the signature (image) on the termos and on the
 * "Ass.:" of each day, and the PDF signed digitally, one, two or all three.
 */

export interface PrintSigner {
  /** The place in "Quem assina" (what `?quem=` carries). */
  index: number;
  staffId: string | null;
  name: string;
  title: string;
  signatureImage: Uint8Array | null;
  rubricImage: Uint8Array | null;
}

/** Everyone in "Quem assina", with the images registered for each. */
export async function printSignersWith(
  database: Database,
  tenant: Tenant,
): Promise<{ signers: PrintSigner[]; defaultIndex: number }> {
  const { signers, settings } = await riSignerFor(tenant);
  const images = await signerImagesWith(
    database,
    tenant.slug,
    signers.map((s) => s.name),
  );
  return {
    defaultIndex: settings.signerIndex,
    signers: signers.map((s, index) => ({
      index,
      staffId: images[index]?.staffId ?? null,
      name: s.name,
      title: s.title,
      signatureImage: images[index]?.signatureImage ?? null,
      rubricImage: images[index]?.rubricImage ?? null,
    })),
  };
}

/**
 * The signature or the rubrica of a person of "Quem assina" who is not in
 * the Equipe (decision of 28/11/2026): kept by the name, on the RI
 * settings. Taking it off leaves the record in the audit.
 */
export async function saveSignerImageWith(
  database: Database,
  tenantSlug: string,
  signerName: string,
  kind: "assinatura" | "rubrica",
  bytes: Uint8Array | null,
  actor: Actor,
): Promise<void> {
  const key = foldName(signerName);
  if (!key) throw new RiError("Escolha quem assina.");
  let value = "";
  if (bytes) {
    if (bytes.byteLength > 8 * 1024 * 1024) {
      throw new RiError("A imagem passa de 8 MB.");
    }
    try {
      value = (await cleanSignature(bytes)).toString("base64");
    } catch {
      throw new RiError(
        "Não deu para ler a imagem. Envie uma foto em JPG ou PNG.",
      );
    }
  }
  const raw = await rawSignatureSettingsWith(database, tenantSlug);
  const own = { ...(raw.signerImages[key] ?? {}) };
  if (kind === "rubrica") own.rubric = value;
  else own.signature = value;
  const signerImages = { ...raw.signerImages, [key]: own };
  await database
    .insert(riSettings)
    .values({ tenantSlug, signerImages })
    .onConflictDoUpdate({
      target: riSettings.tenantSlug,
      set: { signerImages, updatedAt: new Date() },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action:
      kind === "rubrica"
        ? value
          ? "ri.rubric-image"
          : "ri.rubric-image-remove"
        : value
          ? "ri.signature-image"
          : "ri.signature-image-remove",
    targetType: "ri-signer",
    targetId: null,
    reason: signerName,
  });
}

/** The rubrica is the same image as this person's signature. */
export async function copySignerSignatureToRubricWith(
  database: Database,
  tenantSlug: string,
  signerName: string,
  actor: Actor,
): Promise<void> {
  const [mine] = await signerImagesWith(database, tenantSlug, [signerName]);
  if (!mine?.signatureImage) {
    throw new RiError("Cadastre a imagem da assinatura antes.");
  }
  const key = foldName(signerName);
  const raw = await rawSignatureSettingsWith(database, tenantSlug);
  const signerImages = {
    ...raw.signerImages,
    [key]: {
      ...(raw.signerImages[key] ?? {}),
      rubric: Buffer.from(mine.signatureImage).toString("base64"),
    },
  };
  await database
    .insert(riSettings)
    .values({ tenantSlug, signerImages })
    .onConflictDoUpdate({
      target: riSettings.tenantSlug,
      set: { signerImages, updatedAt: new Date() },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.rubric-image",
    targetType: "ri-signer",
    targetId: null,
    reason: `${signerName}: a rubrica passou a ser a mesma imagem da assinatura.`,
  });
}

/**
 * Whose the old images are (they were "of who signs by default", and
 * changed owner when the default changed). Nothing is copied or taken
 * off: they only become that person's.
 */
export async function setLegacyOwnerWith(
  database: Database,
  tenantSlug: string,
  signerName: string,
  actor: Actor,
): Promise<void> {
  const legacyOwner = foldName(signerName);
  await database
    .insert(riSettings)
    .values({ tenantSlug, legacyOwner })
    .onConflictDoUpdate({
      target: riSettings.tenantSlug,
      set: { legacyOwner, updatedAt: new Date() },
    });
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.signature-image",
    targetType: "ri-signer",
    targetId: null,
    reason: `a assinatura e a rubrica cadastradas antes são de ${signerName}`,
  });
}

export interface PrintChoice {
  signer: PrintSigner | null;
  /** The rubrica in the upper corner of every folha. */
  rubric: boolean;
  /** The signature (image) on the termos and on each day's "Ass.:". */
  signature: boolean;
}

/**
 * The choice carried by a print link: `quem` (the place in "Quem assina"),
 * `rubrica=1` and `imagem=1` (or the older `assinatura=imagem`). Digital
 * signing (`assinatura=digital`) combines with both.
 */
export async function printChoiceWith(
  database: Database,
  tenant: Tenant,
  query: URLSearchParams,
): Promise<PrintChoice> {
  const { signers, defaultIndex } = await printSignersWith(database, tenant);
  const asked = Number(query.get("quem"));
  const signer =
    (Number.isInteger(asked) && query.get("quem") !== null
      ? signers[asked]
      : undefined) ??
    signers[defaultIndex] ??
    signers[0] ??
    null;
  return {
    signer,
    rubric: query.get("rubrica") === "1",
    signature:
      query.get("imagem") === "1" ||
      query.getAll("assinatura").includes("imagem"),
  };
}

/** Saves (or takes off) the signature or the rubrica of one person. */
export async function saveStaffImageWith(
  database: Database,
  tenantSlug: string,
  staffId: string,
  kind: "assinatura" | "rubrica",
  bytes: Uint8Array | null,
  actor: Actor,
): Promise<void> {
  let value: string | null = null;
  if (bytes) {
    if (bytes.byteLength > 8 * 1024 * 1024) {
      throw new RiError("A imagem passa de 8 MB.");
    }
    try {
      value = (await cleanSignature(bytes)).toString("base64");
    } catch {
      throw new RiError(
        "Não deu para ler a imagem. Envie uma foto em JPG ou PNG.",
      );
    }
  }
  const [row] = await database
    .update(officeStaff)
    .set(
      kind === "rubrica"
        ? { rubricImage: value, updatedBy: actor.id, updatedAt: new Date() }
        : { signatureImage: value, updatedBy: actor.id, updatedAt: new Date() },
    )
    .where(
      and(eq(officeStaff.tenantSlug, tenantSlug), eq(officeStaff.id, staffId)),
    )
    .returning({ name: officeStaff.name });
  if (!row) throw new RiError("Pessoa não encontrada na Equipe.");
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action:
      kind === "rubrica"
        ? value
          ? "ri.rubric-image"
          : "ri.rubric-image-remove"
        : value
          ? "ri.signature-image"
          : "ri.signature-image-remove",
    targetType: "office-staff",
    targetId: staffId,
    reason: row.name,
  });
}

/** The rubrica is the same image as this person's signature. */
export async function copyStaffSignatureToRubricWith(
  database: Database,
  tenantSlug: string,
  staffId: string,
  actor: Actor,
): Promise<void> {
  const [row] = await database
    .select({
      name: officeStaff.name,
      signatureImage: officeStaff.signatureImage,
    })
    .from(officeStaff)
    .where(
      and(eq(officeStaff.tenantSlug, tenantSlug), eq(officeStaff.id, staffId)),
    );
  if (!row?.signatureImage) {
    throw new RiError("Cadastre a imagem da assinatura antes.");
  }
  await database
    .update(officeStaff)
    .set({
      rubricImage: row.signatureImage,
      updatedBy: actor.id,
      updatedAt: new Date(),
    })
    .where(
      and(eq(officeStaff.tenantSlug, tenantSlug), eq(officeStaff.id, staffId)),
    );
  await recordAuditWith(database, {
    tenantSlug,
    actorId: actor.id,
    action: "ri.rubric-image",
    targetType: "office-staff",
    targetId: staffId,
    reason: `${row.name}: a rubrica passou a ser a mesma imagem da assinatura.`,
  });
}

/**
 * The rubrica in the upper right corner of every page of a PDF, as on the
 * folhas of the physical book (Lei nº 6.015/1973, art. 4º: the books are
 * "numerados, autenticados"): the termos, the book and the índice. Drawn
 * before the PDF is signed digitally, so the signed file carries it.
 */
export async function stampRubric(
  bytes: Uint8Array,
  rubric: Uint8Array,
): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes);
  const isPng = rubric[0] === 0x89 && rubric[1] === 0x50;
  const image = isPng ? await doc.embedPng(rubric) : await doc.embedJpg(rubric);
  const box = { w: 70, h: 26 };
  const scale = Math.min(box.w / image.width, box.h / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize();
    page.drawImage(image, {
      x: width - w - 18,
      y: height - h - 6,
      width: w,
      height: h,
    });
  }
  return doc.save();
}

/** Who signs a document, for the lines under the signature. */
export function signerLinesOf(choice: PrintChoice): {
  signee: string;
  signature: string[];
  signatureImage: Uint8Array<ArrayBuffer> | undefined;
} {
  return {
    signee: choice.signer?.name ?? "",
    signature: choice.signer?.title ? [choice.signer.title] : [],
    signatureImage:
      choice.signature && choice.signer?.signatureImage
        ? new Uint8Array(choice.signer.signatureImage)
        : undefined,
  };
}
