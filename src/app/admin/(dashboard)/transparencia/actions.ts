"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { can } from "@/core/auth/roles.ts";
import {
  PRENOTATION_ATTRIBUTIONS,
  parseMoney,
  prenotationItemsSchema,
  type ReadPrenotation,
} from "@/core/fees/prenotation.ts";
import {
  mergeReports,
  parseNotarisReport,
  type ReportFigures,
} from "@/core/iss/notaris-report.ts";
import { officialName } from "@/core/tenant/identification.ts";
import { OfficeBulletinSchema } from "@/core/tenant/overrides.ts";
import {
  type BulletinFigures,
  type BulletinStatus,
  formatMonthYear,
  fundFieldName,
  isBulletinStatus,
  parseBulletinFigures,
} from "@/core/transparency/bulletin.ts";
import {
  canPublish,
  canUnpublish,
  type DocumentStatus,
  documentFormSchema,
} from "@/core/transparency/documents.ts";
import { FUNDS_BY_STATE } from "@/core/transparency/rubrics.ts";
import { db } from "@/db/index.ts";
import { recordAudit } from "@/lib/audit.ts";
import { justify } from "@/lib/audit-reason.ts";
import { bulletinFingerprint, renderBulletinPdf } from "@/lib/bulletin-pdf.ts";
import {
  FEE_TABLE_CATEGORY,
  getFeeTableDocument,
  pdfTableText,
  readNewFeeTable,
  readPrenotationFromPdf,
  saveFeeTableItems,
} from "@/lib/fee-tables.ts";
import { notifyIndexNow } from "@/lib/notify-indexnow.ts";
import { getSession } from "@/lib/session.ts";
import { CertificatePasswordError } from "@/lib/signature/certificate.ts";
import { requestOrigin, verifyUrlFor } from "@/lib/signature/documents.ts";
import { PdfNotSignableError } from "@/lib/signature/pades.ts";
import {
  findSignedDocumentWith,
  finishA3SignWith,
  prepareA3SignWith,
  SigningError,
  signNewDocumentWith,
} from "@/lib/signing.ts";
import { getSiteOrigin } from "@/lib/site-origin.ts";
import { getTenant } from "@/lib/tenant.ts";
import {
  createDocument,
  deleteDocument,
  getDocument,
  moveDocument,
  publishDocument,
  removeBulletinWith,
  saveBulletinOption,
  unpublishDocument,
  upsertBulletin,
} from "@/lib/transparency.ts";
import {
  AttachmentError,
  deleteStoredFile,
  readStoredFile,
  storeAttachments,
  storeOfficePdf,
} from "@/lib/uploads.ts";

export type SaveState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: Record<string, string> }
  | { status: "success" };

export type ActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

const NO_PERMISSION = "Você não tem permissão para gerir a transparência.";
const GENERIC_ERROR =
  "Não foi possível concluir agora. Tente novamente em instantes.";

function fieldErrorsOf(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "form");
    fieldErrors[field] ??= issue.message;
  }
  return fieldErrors;
}

function revalidate(): void {
  revalidatePath("/admin/transparencia");
  revalidatePath("/transparencia");
}

/** Every action here needs the same gate; this returns the session or null. */
async function authorize() {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "transparency.manage",
      session.user.permissions,
    )
  )
    return null;
  return session;
}

// ── Documents ──────────────────────────────────────────────────────────────

/** Uploads a document; it always lands as a draft (see the spec). */
export async function uploadDocumentAction(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const session = await authorize();
  if (!session) {
    return { status: "error", message: NO_PERMISSION, fieldErrors: {} };
  }

  const parsed = documentFormSchema.safeParse({
    category: String(formData.get("category") ?? ""),
    title: formData.get("title"),
    yearLabel: formData.get("yearLabel"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors: fieldErrorsOf(parsed.error),
    };
  }

  const chosen = formData
    .getAll("arquivo")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const file = chosen[0];
  if (!file) {
    return {
      status: "error",
      message: "Escolha o PDF do documento.",
      fieldErrors: { arquivo: "Escolha um arquivo." },
    };
  }
  // PDF only: a transparency document is a document, not a photo. The shared
  // `storeAttachments` also allows images, so the narrowing is here.
  if (file.type !== "application/pdf") {
    return {
      status: "error",
      message: "O documento tem de ser um PDF.",
      fieldErrors: { arquivo: "Só PDF." },
    };
  }

  const tenant = await getTenant();
  try {
    const [stored] = await storeAttachments([file], {
      tenantSlug: tenant.slug,
      kind: "documento",
    });
    if (!stored) {
      return {
        status: "error",
        message: "Escolha o PDF do documento.",
        fieldErrors: { arquivo: "Escolha um arquivo." },
      };
    }
    const created = await createDocument(
      tenant.slug,
      parsed.data,
      stored,
      session.user.id,
    );
    // A new fee table: its prenotações are read from the PDF right after
    // the answer, for the office to confirm on the table's own screen.
    if (parsed.data.category === FEE_TABLE_CATEGORY) {
      after(() => readNewFeeTable(tenant, created.id));
    }
  } catch (error) {
    if (error instanceof AttachmentError) {
      return { status: "error", message: error.message, fieldErrors: {} };
    }
    console.error("transparencia.upload", error);
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }
  revalidate();
  return { status: "success" };
}

export async function publishDocumentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const id = String(formData.get("id") ?? "");
  const tenant = await getTenant();
  try {
    const doc = await getDocument(tenant.slug, id);
    if (!doc) return { status: "error", message: "Documento não encontrado." };
    if (canPublish(doc.status as DocumentStatus)) {
      await publishDocument(tenant.slug, id, session.user.id);
      notifyIndexNow(await getSiteOrigin(), ["/transparencia"]);
    }
  } catch (error) {
    console.error("transparencia.publish", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidate();
  return { status: "success" };
}

export async function unpublishDocumentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const id = String(formData.get("id") ?? "");
  const tenant = await getTenant();
  try {
    const doc = await getDocument(tenant.slug, id);
    if (!doc) return { status: "error", message: "Documento não encontrado." };
    if (canUnpublish(doc.status as DocumentStatus)) {
      await unpublishDocument(tenant.slug, id, session.user.id);
    }
  } catch (error) {
    console.error("transparencia.unpublish", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidate();
  return { status: "success" };
}

export async function moveDocumentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const id = String(formData.get("id") ?? "");
  const direction = formData.get("direction") === "up" ? "up" : "down";
  const tenant = await getTenant();
  try {
    await moveDocument(tenant.slug, id, direction);
  } catch (error) {
    console.error("transparencia.move", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidate();
  return { status: "success" };
}

export async function deleteDocumentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // Sensitive: says why, and the reason goes to the audit.
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const id = String(formData.get("id") ?? "");
  const tenant = await getTenant();
  try {
    const deleted = await deleteDocument(tenant.slug, id, session.user.id);
    if (deleted) await deleteStoredFile(deleted.filePath);
  } catch (error) {
    console.error("transparencia.delete", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidate();
  return { status: "success" };
}

// ── Bulletin ─────────────────────────────────────────────────────────────────

/** The month, figures and status typed in the bulletin form, checked. */
async function bulletinFromForm(formData: FormData): Promise<
  | {
      ok: true;
      input: {
        referenceMonth: string;
        figures: BulletinFigures;
        status: BulletinStatus;
      };
      tenant: Awaited<ReturnType<typeof getTenant>>;
    }
  | { ok: false; error: SaveState }
> {
  const month = Number(formData.get("month"));
  const year = Number(formData.get("year"));
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return {
      ok: false,
      error: {
        status: "error",
        message: "Escolha o mês.",
        fieldErrors: { month: "Mês inválido." },
      },
    };
  }
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return {
      ok: false,
      error: {
        status: "error",
        message: "Informe o ano.",
        fieldErrors: { year: "Ano inválido." },
      },
    };
  }

  // The office decides which funds the form carries (its state's) and
  // whether gross revenue and expenses are read at all: with the option off,
  // whatever those fields hold is never parsed, so it cannot reach the row.
  const tenant = await getTenant();
  const state = tenant.location.state;
  const funds: Record<string, string> = {};
  for (const fund of FUNDS_BY_STATE[state]) {
    funds[fund.key] = String(formData.get(fundFieldName(fund.key)) ?? "");
  }
  const parsedFigures = parseBulletinFigures(
    state,
    {
      actsCount: String(formData.get("actsCount") ?? ""),
      funds,
      iss: String(formData.get("iss") ?? ""),
      grossRevenue: String(formData.get("grossRevenue") ?? ""),
      expenses: String(formData.get("expenses") ?? ""),
    },
    { privateFigures: tenant.publishBulletinPrivateFigures },
  );
  if ("fieldErrors" in parsedFigures) {
    return {
      ok: false,
      error: {
        status: "error",
        message: "Confira os valores destacados.",
        fieldErrors: parsedFigures.fieldErrors,
      },
    };
  }
  // Figures the system read from a report go out only once someone has
  // checked them (decision of 11/11/2026).
  if (formData.get("lido") === "1" && formData.get("conferido") !== "on") {
    return {
      ok: false,
      error: {
        status: "error",
        message:
          "Confira os valores lidos do relatório e marque a conferência antes de publicar.",
        fieldErrors: {},
      },
    };
  }

  const statusRaw = String(formData.get("bulletinStatus") ?? "preliminary");
  const status = isBulletinStatus(statusRaw) ? statusRaw : "preliminary";
  return {
    ok: true,
    tenant,
    input: {
      // First day of the month, zero-padded: the column is a date.
      referenceMonth: `${year}-${String(month).padStart(2, "0")}-01`,
      figures: parsedFigures.figures,
      status,
    },
  };
}

/** The signing inputs of a bulletin: its PDF, as it will be published. */
async function bulletinToSign(
  tenant: Awaited<ReturnType<typeof getTenant>>,
  input: {
    referenceMonth: string;
    figures: BulletinFigures;
    status: BulletinStatus;
  },
) {
  const stored = { kind: "current" as const, figures: input.figures };
  const [year, month] = input.referenceMonth.split("-").map(Number);
  const origin = await requestOrigin();
  return {
    pdf: await renderBulletinPdf(
      tenant,
      input.referenceMonth,
      input.status,
      stored,
    ),
    fingerprint: bulletinFingerprint(
      tenant,
      input.referenceMonth,
      input.status,
      stored,
    ),
    title: `Boletim Mensal, ${formatMonthYear(month, year)}`,
    originalName: `boletim-${input.referenceMonth.slice(0, 7)}.pdf`,
    verifyUrl: (code: string) => verifyUrlFor(tenant, origin, code),
    location: `${tenant.location.city}/${tenant.location.state}`,
    officeName: officialName(tenant),
  };
}

/** The signed copy, kept with the bulletin (the assinador's expires). */
async function keepSigned(
  tenantSlug: string,
  signed: { id: string; code: string },
  fingerprint: string,
) {
  const view = await findSignedDocumentWith(db, tenantSlug, { id: signed.id });
  if (!view?.filePath) throw new SigningError("Assinatura sem arquivo.");
  const bytes = await readStoredFile(view.filePath);
  const stored = await storeOfficePdf(tenantSlug, bytes);
  return { path: stored.path, code: signed.code, fingerprint };
}

async function publish(
  tenant: Awaited<ReturnType<typeof getTenant>>,
  input: {
    referenceMonth: string;
    figures: BulletinFigures;
    status: BulletinStatus;
  },
  formData: FormData,
  userId: string,
  userName: string,
  signed?: { path: string; code: string; fingerprint: string },
) {
  await upsertBulletin(tenant.slug, { ...input, signed }, userId);
  if (formData.get("lido") === "1") {
    await recordAudit({
      tenantSlug: tenant.slug,
      actorId: userId,
      action: "transparency.bulletin.checked",
      targetType: "transparency-bulletin",
      targetId: input.referenceMonth,
      reason: `Valores lidos do relatório conferidos por ${userName}.`,
    });
  }
  revalidate();
  notifyIndexNow(await getSiteOrigin(), ["/transparencia"]);
}

export async function publishBulletinAction(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const session = await authorize();
  if (!session) {
    return { status: "error", message: NO_PERMISSION, fieldErrors: {} };
  }
  const parsed = await bulletinFromForm(formData);
  if (!parsed.ok) return parsed.error;
  const { tenant, input } = parsed;

  try {
    let signed: { path: string; code: string; fingerprint: string } | undefined;
    // A1: signed with the office's certificate before it goes out, so the
    // site never shows it unsigned (decision of 11/11/2026).
    if (formData.get("assinar") === "a1") {
      if (
        !can(session.user.role ?? "", "signer.use", session.user.permissions)
      ) {
        return {
          status: "error",
          message: "Você não tem permissão para assinar digitalmente.",
          fieldErrors: {},
        };
      }
      const sign = await bulletinToSign(tenant, input);
      const done = await signNewDocumentWith(
        db,
        tenant.slug,
        {
          ...sign,
          certificateId: String(formData.get("certificateId") ?? ""),
          password: String(formData.get("password") ?? ""),
        },
        session.user.id,
      );
      signed = await keepSigned(tenant.slug, done, sign.fingerprint);
    }
    await publish(
      tenant,
      input,
      formData,
      session.user.id,
      session.user.name,
      signed,
    );
  } catch (error) {
    if (
      error instanceof SigningError ||
      error instanceof CertificatePasswordError ||
      error instanceof PdfNotSignableError
    ) {
      return { status: "error", message: error.message, fieldErrors: {} };
    }
    console.error("transparencia.bulletin", error);
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }
  return { status: "success" };
}

/** The A3 certificate the browser sends: the holder's and its chain. */
function tokenCertificate(formData: FormData) {
  let chain: unknown = [];
  try {
    chain = JSON.parse(String(formData.get("chain") ?? "[]"));
  } catch {
    chain = [];
  }
  return {
    holderDer: Buffer.from(String(formData.get("holder") ?? ""), "base64"),
    chainDer: (Array.isArray(chain) ? chain : [])
      .slice(0, 8)
      .map((item) => Buffer.from(String(item), "base64")),
  };
}

type A3Step =
  | { status: "prepared"; token: string; toBeSigned: string }
  | { status: "error"; message: string };

/** A3, step one: the bulletin's PDF, prepared for the token. */
export async function prepareBulletinA3(formData: FormData): Promise<A3Step> {
  const session = await authorize();
  if (
    !session ||
    !can(session.user.role ?? "", "signer.use", session.user.permissions)
  ) {
    return { status: "error", message: NO_PERMISSION };
  }
  const parsed = await bulletinFromForm(formData);
  if (!parsed.ok)
    return {
      status: "error",
      message:
        parsed.error.status === "error" ? parsed.error.message : GENERIC_ERROR,
    };
  try {
    const sign = await bulletinToSign(parsed.tenant, parsed.input);
    const prepared = await prepareA3SignWith(
      parsed.tenant.slug,
      {
        ...sign,
        ...tokenCertificate(formData),
      },
      session.user.id,
    );
    return {
      status: "prepared",
      token: prepared.token,
      toBeSigned: prepared.toBeSigned.toString("base64"),
    };
  } catch (error) {
    if (error instanceof SigningError || error instanceof PdfNotSignableError) {
      return { status: "error", message: error.message };
    }
    console.error("transparencia.bulletin.a3.prepare", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

/** A3, step two: the token's signature comes back; the bulletin goes out signed. */
export async function finishBulletinA3(
  formData: FormData,
): Promise<
  { status: "signed"; id: string } | { status: "error"; message: string }
> {
  const session = await authorize();
  if (
    !session ||
    !can(session.user.role ?? "", "signer.use", session.user.permissions)
  ) {
    return { status: "error", message: NO_PERMISSION };
  }
  const parsed = await bulletinFromForm(formData);
  if (!parsed.ok)
    return {
      status: "error",
      message:
        parsed.error.status === "error" ? parsed.error.message : GENERIC_ERROR,
    };
  try {
    const done = await finishA3SignWith(
      db,
      parsed.tenant.slug,
      {
        ...tokenCertificate(formData),
        token: String(formData.get("token") ?? ""),
        signature: Buffer.from(
          String(formData.get("signature") ?? ""),
          "base64",
        ),
      },
      session.user.id,
    );
    const { fingerprint } = await bulletinToSign(parsed.tenant, parsed.input);
    const signed = await keepSigned(parsed.tenant.slug, done, fingerprint);
    await publish(
      parsed.tenant,
      parsed.input,
      formData,
      session.user.id,
      session.user.name,
      signed,
    );
    return { status: "signed", id: done.id };
  } catch (error) {
    if (error instanceof SigningError) {
      return { status: "error", message: error.message };
    }
    console.error("transparencia.bulletin.a3.finish", error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

/**
 * Reads the system's productivity report attached to the bulletin form, so
 * the figures fill themselves in (decision of 11/11/2026). Nothing stored.
 */
export async function readBulletinReport(
  formData: FormData,
): Promise<
  | { status: "read"; figures: ReportFigures }
  | { status: "error"; message: string }
> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const files = formData
    .getAll("relatorio")
    .filter((f): f is File => f instanceof File && f.size > 0);
  const read: ReportFigures[] = [];
  for (const file of files) {
    try {
      const figures = parseNotarisReport(
        await pdfTableText(new Uint8Array(await file.arrayBuffer())),
      );
      if (figures.kind !== "desconhecido") read.push(figures);
    } catch {
      // A scan or another system: the office types the figures.
    }
  }
  if (!read.length) {
    return {
      status: "error",
      message:
        "Não reconheci um relatório do sistema nesse PDF. Digite os valores.",
    };
  }
  return { status: "read", figures: mergeReports(read) };
}

/**
 * Whether the office's bulletins also show gross revenue, expenses and the
 * balance. Applies to every month at once, published ones included, because
 * the PDF is drawn on each request with the option as it stands.
 */
export async function saveBulletinOptionAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };

  const parsed = OfficeBulletinSchema.safeParse({
    publishBulletinPrivateFigures:
      formData.get("publishBulletinPrivateFigures") === "true",
  });
  if (!parsed.success) return { status: "error", message: GENERIC_ERROR };

  const tenant = await getTenant();
  try {
    await saveBulletinOption(
      tenant.slug,
      parsed.data.publishBulletinPrivateFigures,
      session.user.id,
    );
  } catch (error) {
    console.error("transparencia.bulletin-option", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  revalidate();
  return { status: "success" };
}

export type FeeTableReadState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; items: ReadPrenotation; found: number };

/**
 * "Ler do PDF": the prenotações the table's file holds, back to the screen
 * to fill the fields. Nothing is saved: the office reads, corrects and saves.
 */
export async function readFeeTablePdfAction(
  _previous: FeeTableReadState,
  formData: FormData,
): Promise<FeeTableReadState> {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "transparency.manage",
      session.user.permissions,
    )
  ) {
    return { status: "error", message: NO_PERMISSION };
  }
  const tenant = await getTenant();
  const id = String(formData.get("id") ?? "");
  let items: ReadPrenotation;
  try {
    items = await readPrenotationFromPdf(tenant, id);
  } catch (error) {
    console.error("transparencia.fee-table-read", error);
    return { status: "error", message: GENERIC_ERROR };
  }
  const found = Object.keys(items).length;
  if (found === 0) {
    return {
      status: "error",
      message:
        "Não encontramos a prenotação no texto deste PDF (pode ser uma imagem escaneada). Digite os valores abaixo.",
    };
  }
  return { status: "success", items, found };
}

/** Saves the three prenotações of one table, as the office confirmed them. */
export async function saveFeeTableAction(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "transparency.manage",
      session.user.permissions,
    )
  ) {
    return { status: "error", message: NO_PERMISSION, fieldErrors: {} };
  }
  const tenant = await getTenant();
  const id = String(formData.get("id") ?? "");
  if (!(await getFeeTableDocument(tenant.slug, id))) {
    return {
      status: "error",
      message: "Esta não é uma tabela de emolumentos.",
      fieldErrors: {},
    };
  }

  const items: Record<string, unknown> = {};
  const fieldErrors: Record<string, string> = {};
  for (const attribution of PRENOTATION_ATTRIBUTIONS) {
    const code = String(formData.get(`${attribution}.code`) ?? "").trim();
    const description = String(
      formData.get(`${attribution}.description`) ?? "",
    ).trim();
    const total = String(formData.get(`${attribution}.total`) ?? "").trim();
    // A registry left blank is "not in this table", not an error.
    if (!code && !total) continue;
    const totalCents = parseMoney(total);
    if (totalCents === undefined) {
      fieldErrors[`${attribution}.total`] = "Use o formato 57,90.";
      continue;
    }
    items[attribution] = {
      code,
      description: description || "Prenotação",
      totalCents,
    };
  }
  const parsed = prenotationItemsSchema.safeParse(items);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      // The field is "total"; the schema calls it totalCents.
      const field = issue.path.join(".").replace(/\.totalCents$/, ".total");
      fieldErrors[field] ??= issue.message;
    }
  }
  if (!parsed.success || Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Confira os campos destacados.",
      fieldErrors,
    };
  }

  try {
    await saveFeeTableItems(
      tenant.slug,
      id,
      parsed.data,
      "manual",
      session.user.id,
    );
  } catch (error) {
    console.error("transparencia.fee-table", error);
    return { status: "error", message: GENERIC_ERROR, fieldErrors: {} };
  }
  revalidatePath("/admin/transparencia");
  revalidatePath(`/admin/transparencia/tabela/${id}`);
  revalidatePath("/solicitar");
  return { status: "success" };
}

/**
 * "Excluir" a bulletin published by mistake (decision of 11/11/2026): off
 * the site, kept in the database with the reason in the audit.
 */
export async function removeBulletinAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  const removed = await removeBulletinWith(
    db,
    tenant.slug,
    String(formData.get("id") ?? ""),
    session.user.id,
  ).catch(() => false);
  if (!removed) {
    return { status: "error", message: "Não foi possível excluir agora." };
  }
  revalidate();
  return { status: "success" };
}
