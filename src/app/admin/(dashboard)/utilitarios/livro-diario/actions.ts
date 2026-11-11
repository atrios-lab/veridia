"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { can } from "@/core/auth/roles.ts";
import {
  BOOK_DOC_KINDS,
  type BookDocKind,
  type EntryKind,
  EXPENSE_CATEGORIES,
  INTERIM_PERIODS,
  type InterimPeriod,
  SettingsSchema,
  specialtyOf,
} from "@/core/daily-book/book.ts";
import {
  addFigures,
  type BookBulletin,
  sumReadings,
} from "@/core/daily-book/bulletin.ts";
import {
  parseProductivity,
  parseReceipt,
  type ReceiptReading,
} from "@/core/daily-book/reports.ts";
import { parseNotarisReport } from "@/core/iss/notaris-report.ts";
import { LONG_TEXT_MAX } from "@/core/text-limits.ts";
import { db } from "@/db/index.ts";
import { justify } from "@/lib/audit-reason.ts";
import {
  addEntryWith,
  DailyBookError,
  type EntryInput,
  getBookSettingsWith,
  importProductivityWith,
  issueBookReportWith,
  monthBulletinFromBookWith,
  numberSheetsWith,
  removeBookReportWith,
  removeEntryWith,
  saveBookBulletinWith,
  saveBookSettingsWith,
  updateBookReportWith,
  updateEntryWith,
} from "@/lib/daily-book.ts";
import { pdfTableText } from "@/lib/fee-tables.ts";
import { getSession } from "@/lib/session.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import {
  AttachmentError,
  storeAttachments,
  storeOfficePdf,
} from "@/lib/uploads.ts";

export type BookFormState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const HOME = "/admin/utilitarios/livro-diario";
const NO_PERMISSION = "Você não tem permissão para o Livro Diário Auxiliar.";

async function access() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "daily-book.manage", session.user.permissions)
  ) {
    return undefined;
  }
  return { session, tenant: await getTenant() };
}

const field = (formData: FormData, name: string, max = 300) =>
  String(formData.get(name) ?? "")
    .trim()
    .slice(0, max);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** "1.234,56", "1234,5", "104.97" (a dot before two last digits): centavos. */
function amountOf(text: string): number | null {
  const t = text.replace(/[R$\s]/g, "");
  if (!/^[\d.,]+$/.test(t) || !/\d/.test(t)) return null;
  const decimalDot = !t.includes(",") && /\.\d{1,2}$/.test(t);
  const normal = decimalDot
    ? t.replace(/\.(?=\d{3}(\.|$))/g, "")
    : t.replace(/\./g, "").replace(",", ".");
  const n = Number(normal);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function fail(error: unknown): BookFormState {
  if (error instanceof DailyBookError || error instanceof AttachmentError) {
    return { status: "error", message: error.message };
  }
  console.error("daily-book", error);
  return {
    status: "error",
    message: "Não foi possível salvar agora. Tente de novo em instantes.",
  };
}

function pdfFile(formData: FormData, name: string): File | null {
  const file = formData.get(name);
  return file instanceof File && file.size > 0 ? file : null;
}

/* ----------------------------------------------------------- productivity */

export interface ReadLine {
  code: string;
  description: string;
  quantity: number;
  amountCents: number;
  fundsCents: number;
  issCents: number;
  specialty: string;
}

/**
 * Reads the productivity report, for the check before booking. The same
 * upload can go to the book (a report of one day, art. 190), to the monthly
 * bulletin (a report within one month), or both (decision of 11/11/2026).
 */
export async function readProductivity(formData: FormData): Promise<
  | {
      ok: true;
      start: string;
      end: string;
      lines: ReadLine[];
      costsCents: number | null;
      /** One day: may go into the book (art. 190). */
      oneDay: boolean;
      /** Within one month: may go to the monthly bulletin. */
      oneMonth: boolean;
      /** May prepare the bulletin (Transparência permission). */
      canBulletin: boolean;
    }
  | { ok: false; message: string }
> {
  const ok = await access();
  if (!ok) return { ok: false, message: NO_PERMISSION };
  const file = pdfFile(formData, "relatorio");
  if (!file) return { ok: false, message: "Escolha o PDF do relatório." };
  if (file.size > 15 * 1024 * 1024) {
    return { ok: false, message: "O relatório passa de 15 MB." };
  }
  try {
    const reading = parseProductivity(
      await pdfTableText(new Uint8Array(await file.arrayBuffer())),
    );
    if (!reading.start || !reading.end || reading.acts.length === 0) {
      return {
        ok: false,
        message:
          "Não reconheci o relatório de produtividade (período e atos). Confira se é o PDF do sistema, não uma foto.",
      };
    }
    const settings = await getBookSettingsWith(db, ok.tenant.slug);
    return {
      ok: true,
      start: reading.start,
      end: reading.end,
      costsCents: reading.costsCents,
      oneDay: reading.start === reading.end,
      oneMonth: reading.start.slice(0, 7) === reading.end.slice(0, 7),
      canBulletin: canPublishBulletin(ok.session),
      lines: reading.acts.map((a) => ({
        code: a.code,
        description: a.description,
        quantity: a.quantity,
        amountCents: Math.max(0, a.emolumentsCents - a.discountCents),
        fundsCents: a.fdjCents + a.frmpCents + a.fcrcpnCents + a.fpgeCents,
        issCents: a.issCents,
        specialty: specialtyOf(a.code, settings),
      })),
    };
  } catch (error) {
    console.error("daily-book.read", error);
    return { ok: false, message: "Não foi possível ler este PDF." };
  }
}

const LinesSchema = z
  .array(
    z.object({
      code: z.string().max(20),
      description: z.string().trim().min(1).max(500),
      quantity: z.number().int().min(0).max(1_000_000),
      amountCents: z.number().int().min(0).max(1_000_000_000_00),
      fundsCents: z.number().int().min(0).max(1_000_000_000_00),
      issCents: z.number().int().min(0).max(1_000_000_000_00),
      specialty: z.string().trim().min(1).max(120),
      /** Art. 190: the act's number, or book and sheet, or protocol. */
      identification: z.string().trim().max(500).default(""),
      explanation: z.string().max(LONG_TEXT_MAX).default(""),
    }),
  )
  .max(2000);

/** The bulletin is the Transparência's: its own permission. */
function canPublishBulletin(
  session: NonNullable<Awaited<ReturnType<typeof getSession>>>,
) {
  return can(
    session.user.role ?? "",
    "transparency.manage",
    session.user.permissions,
  );
}

const BULLETIN_FORM = "/admin/transparencia?aba=boletim&origem=livro";

export async function importProductivity(
  _previous: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const start = field(formData, "inicio", 10);
  const end = field(formData, "fim", 10);
  if (!isDate(start) || !isDate(end)) {
    return { status: "error", message: "Leia o relatório antes de lançar." };
  }
  const toBook = formData.get("livro") === "on";
  const toBulletin = formData.get("boletim") === "on";
  if (!toBook && !toBulletin) {
    return {
      status: "error",
      message:
        "Marque o que fazer com o relatório: lançar no livro, enviar ao boletim mensal, ou os dois.",
    };
  }
  if (toBook && start !== end) {
    return {
      status: "error",
      message:
        'O livro recebe só o relatório de um dia: "A receita será lançada no Livro Diário Auxiliar [...] no dia da prática do ato" (art. 190). Desmarque o livro para enviar este relatório só ao boletim.',
    };
  }
  if (toBulletin && !canPublishBulletin(ok.session)) {
    return {
      status: "error",
      message:
        "Você não tem permissão para o boletim mensal (Transparência). Desmarque o boletim ou peça a permissão.",
    };
  }
  if (toBulletin && start.slice(0, 7) !== end.slice(0, 7)) {
    return {
      status: "error",
      message: "O boletim é mensal: envie um relatório dentro de um mês só.",
    };
  }
  let lines: z.infer<typeof LinesSchema> = [];
  if (toBook) {
    try {
      const parsed = LinesSchema.safeParse(
        JSON.parse(field(formData, "linhas", 2_000_000)),
      );
      if (!parsed.success)
        return { status: "error", message: "Confira as linhas lidas." };
      lines = parsed.data;
    } catch {
      return { status: "error", message: "Leia o relatório antes de lançar." };
    }
  }
  const month = start.slice(0, 7);
  try {
    const file = pdfFile(formData, "relatorio");
    if (!file) {
      return {
        status: "error",
        message: "Escolha de novo o PDF do relatório.",
      };
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    // The report's totals, as the bulletin reads them.
    const totals = parseNotarisReport(
      await pdfTableText(new Uint8Array(bytes)),
    );
    if (toBook) {
      const stored = await storeOfficePdf(ok.tenant.slug, bytes);
      await importProductivityWith(
        db,
        ok.tenant.slug,
        {
          start,
          end,
          lines,
          file: { path: stored.path, name: file.name || "produtividade.pdf" },
          reading: totals.kind === "produtividade" ? totals : null,
          replace: formData.get("substituir") === "on",
        },
        ok.session.user.id,
      );
    }
    if (toBulletin) {
      const bulletin: BookBulletin =
        start === end
          ? await monthBulletinFromBookWith(db, ok.tenant.slug, month)
          : {
              month,
              figures: sumReadings([totals]),
              source: "relatorio",
              days: [],
              start,
              end,
            };
      // A day sent to the bulletin and not to the book still counts; with
      // no day in the book yet, it is the bulletin's only day.
      if (start === end && !toBook && !bulletin.days.includes(start)) {
        bulletin.figures = bulletin.days.length
          ? addFigures(bulletin.figures, sumReadings([totals]))
          : sumReadings([totals]);
        bulletin.days = [...bulletin.days, start].sort();
      }
      await saveBookBulletinWith(
        db,
        ok.tenant.slug,
        bulletin,
        ok.session.user.id,
      );
    }
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  if (toBulletin) redirect(`${BULLETIN_FORM}&mes=${month}`);
  redirect(`${HOME}?mes=${month}&feito=importado`);
}

/** Livro › "Enviar o mês ao boletim": the book's days, to check and publish. */
export async function sendMonthToBulletin(formData: FormData): Promise<void> {
  const ok = await access();
  const month = field(formData, "mes", 7);
  if (!ok || !canPublishBulletin(ok.session)) redirect(HOME);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) redirect(HOME);
  await saveBookBulletinWith(
    db,
    ok.tenant.slug,
    await monthBulletinFromBookWith(db, ok.tenant.slug, month),
    ok.session.user.id,
  );
  redirect(`${BULLETIN_FORM}&mes=${month}`);
}

/* ---------------------------------------------------------------- entries */

/** Reads a receipt (DAM, bank receipt) to fill the expense. */
export async function readReceipt(
  formData: FormData,
): Promise<
  { ok: true; reading: ReceiptReading } | { ok: false; message: string }
> {
  const ok = await access();
  if (!ok) return { ok: false, message: NO_PERMISSION };
  const file = pdfFile(formData, "comprovante");
  if (!file) return { ok: false, message: "Escolha o comprovante." };
  if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
    return {
      ok: false,
      message:
        "Só leio comprovante em PDF. Uma foto fica anexada, mas o valor e a data você digita.",
    };
  }
  try {
    const reading = parseReceipt(
      await pdfTableText(new Uint8Array(await file.arrayBuffer())),
    );
    if (!reading.amountCents && !reading.paidOn) {
      return {
        ok: false,
        message: "Não encontrei valor nem data neste PDF: preencha à mão.",
      };
    }
    return { ok: true, reading };
  } catch {
    return {
      ok: false,
      message: "Não foi possível ler este PDF: preencha à mão.",
    };
  }
}

const CATEGORY_IDS = EXPENSE_CATEGORIES.map((c) => c.id) as string[];

export async function saveEntry(
  _previous: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const typed = field(formData, "tipo");
  const kind: EntryKind =
    typed === "despesa" || typed === "deposito" ? typed : "receita";
  const occurredOn = field(formData, "data", 10);
  if (!isDate(occurredOn) || occurredOn > today()) {
    return { status: "error", message: "Confira a data." };
  }
  const amountCents = amountOf(field(formData, "valor", 20));
  if (amountCents === null) {
    return { status: "error", message: "Confira o valor (ex.: 1.234,56)." };
  }
  const category = field(formData, "categoria", 40);
  if (kind === "despesa" && !CATEGORY_IDS.includes(category)) {
    return { status: "error", message: "Escolha a categoria da despesa." };
  }
  if (kind === "receita" && !field(formData, "especialidade", 120)) {
    return {
      status: "error",
      message:
        "Informe a especialidade: a receita é lançada separadamente, por especialidade (art. 190).",
    };
  }
  const id = field(formData, "id", 40);
  // The notices of checks.ts are shown on the form; none refuses the entry.
  const explanation = field(formData, "explicacao", LONG_TEXT_MAX);
  try {
    const file = pdfFile(formData, "comprovante");
    const [stored] = file
      ? await storeAttachments([file], {
          tenantSlug: ok.tenant.slug,
          limit: 1,
          name:
            kind === "despesa"
              ? "Comprovante de despesa"
              : kind === "deposito"
                ? "Comprovante de depósito"
                : "Comprovante de receita",
        })
      : [];
    const input: EntryInput = {
      kind,
      occurredOn,
      specialty:
        kind === "receita" ? field(formData, "especialidade", 120) : "",
      category,
      actCode: field(formData, "codigo", 20),
      description: field(formData, "descricao", 500),
      quantity: Number(field(formData, "quantidade", 7)) || 1,
      amountCents,
      fundsCents: 0,
      issCents: 0,
      supplier: field(formData, "fornecedor", 160),
      documentRef: field(formData, "documento", 160),
      fiscalDistinct: formData.get("fiscal") === "on",
      fiscalNote: field(formData, "fiscalNota", 1000),
      explanation,
      attachment: stored
        ? { path: stored.path, name: stored.displayName }
        : null,
      source: stored ? "comprovante" : "manual",
    };
    if (id)
      await updateEntryWith(db, ok.tenant.slug, id, input, ok.session.user.id);
    else await addEntryWith(db, ok.tenant.slug, input, ok.session.user.id);
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  redirect(
    `${HOME}?mes=${occurredOn.slice(0, 7)}&feito=${id ? "editado" : kind}`,
  );
}

export async function removeEntry(
  _previous: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const problem = justify(formData);
  if (problem) return { status: "error", message: problem };
  try {
    await removeEntryWith(
      db,
      ok.tenant.slug,
      field(formData, "id", 40),
      String(formData.get("justificativa") ?? "").trim(),
      ok.session.user.id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  return {
    status: "saved",
    message: "Lançamento excluído. Ele continua guardado.",
  };
}

/* ---------------------------------------------------------------- reports */

function periodOf(kind: BookDocKind, formData: FormData) {
  if (kind === "dia") {
    const day = field(formData, "dia", 10);
    return isDate(day) ? { start: day, end: day } : null;
  }
  if (kind === "mes") {
    const month = field(formData, "mes", 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
    const [y, m] = month.split("-").map(Number);
    const last = new Date(Date.UTC(y ?? 2000, m ?? 1, 0)).getUTCDate();
    return {
      start: `${month}-01`,
      end: `${month}-${String(last).padStart(2, "0")}`,
    };
  }
  if (kind === "abertura" || kind === "encerramento") {
    const day = field(formData, "data", 10) || today();
    return isDate(day) ? { start: day, end: day } : null;
  }
  const year = field(formData, "ano", 4);
  return /^\d{4}$/.test(year)
    ? { start: `${year}-01-01`, end: `${year}-12-31` }
    : null;
}

export async function issueReport(
  _previous: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const kind = field(formData, "tipo") as BookDocKind;
  if (!BOOK_DOC_KINDS.includes(kind)) {
    return { status: "error", message: "Escolha a página." };
  }
  const period = periodOf(kind, formData);
  if (!period) return { status: "error", message: "Confira o período." };
  let id: string;
  let full = false;
  try {
    const row = await issueBookReportWith(
      db,
      ok.tenant.slug,
      {
        kind,
        ...period,
        issuedOn: field(formData, "data", 10) || today(),
        notes: field(formData, "observacoes", LONG_TEXT_MAX),
        signerIndex: Number(field(formData, "assina", 3)) || 0,
        signers: (await getGuideSettings(ok.tenant)).signers,
      },
      ok.session.user.id,
    );
    id = row.id;
    // Art. 186: the page takes the next numbered sheets of the book.
    full = (await numberSheetsWith(db, ok.tenant, row.id))?.overflow ?? false;
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  redirect(`${HOME}/paginas/${id}?gerado=1${full ? "&livro=cheio" : ""}`);
}

export async function editReport(
  _previous: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const issuedOn = field(formData, "data", 10);
  if (!isDate(issuedOn)) return { status: "error", message: "Confira a data." };
  const id = field(formData, "id", 40);
  try {
    await updateBookReportWith(
      db,
      ok.tenant.slug,
      id,
      {
        issuedOn,
        notes: field(formData, "observacoes", LONG_TEXT_MAX),
        signerIndex: Number(field(formData, "assina", 3)) || 0,
        signers: (await getGuideSettings(ok.tenant)).signers,
        refresh: formData.get("atualizar") === "on",
      },
      ok.session.user.id,
    );
    // Same first sheet; the pages are counted again (art. 186).
    await numberSheetsWith(db, ok.tenant, id);
  } catch (error) {
    return fail(error);
  }
  revalidatePath(`${HOME}/paginas/${id}`);
  return {
    status: "saved",
    message: "Página salva. O PDF já sai com a alteração.",
  };
}

export async function removeReport(
  _previous: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const problem = justify(formData);
  if (problem) return { status: "error", message: problem };
  try {
    await removeBookReportWith(
      db,
      ok.tenant.slug,
      field(formData, "id", 40),
      String(formData.get("justificativa") ?? "").trim(),
      ok.session.user.id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  redirect(`${HOME}?feito=pagina-excluida`);
}

/* --------------------------------------------------------------- settings */

export async function saveSettings(
  _previous: BookFormState,
  formData: FormData,
): Promise<BookFormState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const specialties = field(formData, "especialidades", 5000)
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*(\d{1,4})\s*[=:-]\s*(.+?)\s*$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => ({ prefix: m[1] ?? "", name: m[2] ?? "" }));
  const parsed = SettingsSchema.safeParse({
    specialties,
    responsible: field(formData, "responsavel", 160),
    bookNumber: Number(field(formData, "livro", 4)) || 1,
    sheetCount: Number(field(formData, "folhas", 6)) || 0,
    interim: formData.get("interino") === "on",
    ceilingCents: amountOf(field(formData, "teto", 20)) ?? 0,
    interimPeriod: (INTERIM_PERIODS as readonly string[]).includes(
      field(formData, "periodicidade", 20),
    )
      ? (field(formData, "periodicidade", 20) as InterimPeriod)
      : "trimestral",
  });
  if (!parsed.success)
    return {
      status: "error",
      message:
        "Confira as especialidades, o número do livro, as folhas e o valor do teto.",
    };
  try {
    await saveBookSettingsWith(
      db,
      ok.tenant.slug,
      parsed.data,
      ok.session.user.id,
    );
  } catch (error) {
    return fail(error);
  }
  revalidatePath(HOME);
  return { status: "saved", message: "Configuração salva." };
}
