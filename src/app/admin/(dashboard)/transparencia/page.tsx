import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  type BookBulletin,
  bulletinSourceNote,
  bulletinStatusFor,
} from "@/core/daily-book/bulletin.ts";
import {
  BULLETIN_STATUS_LABELS,
  type BulletinDraft,
  type BulletinStatus,
  bulletinDraftOf,
  formatMoneyBRL,
  formatMonthYear,
  isBulletinStatus,
  legacyBulletinDraftOf,
} from "@/core/transparency/bulletin.ts";
import type { SupportedState } from "@/core/transparency/rubrics.ts";
import { db } from "@/db/index.ts";
import { bulletinFingerprint } from "@/lib/bulletin-pdf.ts";
import { bookBulletinWith } from "@/lib/daily-book.ts";
import { FEE_TABLE_CATEGORY, readFeeTables } from "@/lib/fee-tables.ts";
import {
  type PendingBulletin,
  pendingBulletinsWith,
} from "@/lib/iss-declarations.ts";
import { getSession } from "@/lib/session.ts";
import { certificatesForSignerWith } from "@/lib/signing.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import {
  listBulletins,
  listDocuments,
  storedBulletinOf,
  type TransparencyBulletinRow,
} from "@/lib/transparency.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { BulletinForm } from "./_components/bulletin-form.tsx";
import { BulletinList } from "./_components/bulletin-list.tsx";
import { DocumentForm } from "./_components/document-form.tsx";
import {
  DocumentList,
  type FeeTableInfo,
} from "./_components/document-list.tsx";
import { TransparencyTabs } from "./_components/tabs.tsx";

export const metadata = { title: "Transparência" };

function latestLabel(row: TransparencyBulletinRow | undefined): string {
  if (!row) return "Nenhum boletim publicado";
  const [year, month] = row.referenceMonth.split("-").map(Number);
  const status = row.status as BulletinStatus;
  return `Último publicado: ${formatMonthYear(month, year)} (${BULLETIN_STATUS_LABELS[status].toLowerCase()})`;
}

/**
 * Every published month, as the form shows it, keyed "YYYY-MM". Picking a
 * month in the form brings its bulletin back to correct and republish; a row
 * in neither format is left out, so the form opens blank for it rather than
 * with zeros nobody typed.
 */
function savedDrafts(
  rows: TransparencyBulletinRow[],
  state: SupportedState,
): Record<string, BulletinDraft> {
  const drafts: Record<string, BulletinDraft> = {};
  for (const row of rows) {
    const stored = storedBulletinOf(row, state);
    if (!stored) continue;
    const status = isBulletinStatus(row.status) ? row.status : "preliminary";
    drafts[row.referenceMonth.slice(0, 7)] =
      stored.kind === "current"
        ? bulletinDraftOf(stored.figures, status)
        : legacyBulletinDraftOf(stored.figures, status);
  }
  return drafts;
}

export default async function TransparencyPage({
  searchParams,
}: {
  searchParams: Promise<{ aba?: string; origem?: string; mes?: string }>;
}) {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "transparency.manage",
      session.user.permissions,
    )
  )
    notFound();

  const tenant = await getTenant();
  const { aba, origem, mes } = await searchParams;
  // Sent by the Livro Diário Auxiliar: the month to check and publish.
  const bookMonth =
    origem === "livro" && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes ?? "")
      ? (mes as string)
      : undefined;
  const tab = aba === "boletim" ? "boletim" : "documentos";

  return (
    <>
      <AdminPageHeader title="Transparência" />
      <div className="px-4 pt-6 pb-8 md:px-8">
        <TransparencyTabs />

        {tab === "documentos" ? (
          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
            <DocumentsTab tenantSlug={tenant.slug} />
            <DocumentForm />
          </div>
        ) : (
          <BulletinTab
            tenant={tenant}
            userId={session.user.id}
            bookMonth={bookMonth}
            canSign={can(
              session.user.role ?? "",
              "signer.use",
              session.user.permissions,
            )}
          />
        )}
      </div>
    </>
  );
}

/**
 * The list, with what each fee table holds for the prenotação: which one is
 * in force (the first published, as on the public page) and whether its
 * values were read from the PDF or confirmed by the office.
 */
async function DocumentsTab({ tenantSlug }: { tenantSlug: string }) {
  const [documents, tables] = await Promise.all([
    listDocuments(tenantSlug),
    readFeeTables(tenantSlug),
  ]);
  const inForceId = documents.find(
    (doc) => doc.category === FEE_TABLE_CATEGORY && doc.status === "published",
  )?.id;
  const feeTables: Record<string, FeeTableInfo> = {};
  for (const doc of documents) {
    if (doc.category !== FEE_TABLE_CATEGORY) continue;
    const saved = tables[doc.id];
    feeTables[doc.id] = {
      inForce: doc.id === inForceId,
      items: saved ? Object.keys(saved.items).length : 0,
      source: saved?.source,
    };
  }
  return <DocumentList documents={documents} feeTables={feeTables} />;
}

/** What a Declaração de ISS left, in the strings the bulletin form shows. */
function declaredDraft(figures: PendingBulletin): Partial<BulletinDraft> {
  const money = (cents: number | undefined) =>
    cents === undefined ? "" : formatMoneyBRL(cents);
  const funds: Record<string, string> = {};
  for (const [key, cents] of Object.entries(figures.fundAmountsCents ?? {})) {
    funds[key] = formatMoneyBRL(cents);
  }
  return {
    iss: formatMoneyBRL(figures.issCents),
    actsCount: figures.actsCount === undefined ? "" : String(figures.actsCount),
    funds,
    grossRevenue: money(figures.grossRevenueCents),
    expenses: money(figures.expensesCents),
  };
}

/** What the Livro Diário Auxiliar sent, in the strings the form shows. */
function bookDraft(
  b: BookBulletin,
  privateFigures: boolean,
  alreadyPublished: boolean,
): { period: string; draft: Partial<BulletinDraft>; note: string } {
  const funds: Record<string, string> = {};
  for (const [key, cents] of Object.entries(b.figures.fundAmountsCents)) {
    funds[key] = formatMoneyBRL(cents);
  }
  const draft: Partial<BulletinDraft> = {
    actsCount: String(b.figures.actsCount),
    funds,
    iss: formatMoneyBRL(b.figures.issCents),
    status: bulletinStatusFor(b, today()),
  };
  if (privateFigures && b.figures.grossRevenueCents !== undefined) {
    draft.grossRevenue = formatMoneyBRL(b.figures.grossRevenueCents);
  }
  if (privateFigures && b.figures.expensesCents !== undefined) {
    draft.expenses = formatMoneyBRL(b.figures.expensesCents);
  }
  const notes = [bulletinSourceNote(b)];
  if (privateFigures && b.bookExpensesCents !== undefined) {
    notes.push(
      `Despesas lançadas no livro neste mês: R$ ${formatMoneyBRL(b.bookExpensesCents)}.`,
    );
  }
  if (alreadyPublished) {
    notes.push("Este mês já está publicado: publicar de novo substitui.");
  }
  notes.push('Confira, marque "Conferi os valores" e publique.');
  return { period: b.month, draft, note: notes.join(" ") };
}

async function BulletinTab({
  tenant,
  userId,
  canSign,
  bookMonth,
}: {
  tenant: Awaited<ReturnType<typeof getTenant>>;
  userId: string;
  canSign: boolean;
  bookMonth?: string;
}) {
  // One read serves the header line, the form and the list: most recent
  // month first, so the latest is the head of it.
  const [bulletins, declared, certificates] = await Promise.all([
    listBulletins(tenant.slug),
    pendingBulletinsWith(db, tenant.slug).catch(
      (): Record<string, PendingBulletin> => ({}),
    ),
    canSign
      ? certificatesForSignerWith(db, tenant.slug, userId).catch(() => [])
      : [],
  ]);
  const fromBook = bookMonth
    ? await bookBulletinWith(db, tenant.slug, bookMonth)
    : null;
  const saved = savedDrafts(bulletins, tenant.location.state);
  return (
    <div className="mt-6 space-y-5">
      <p className="text-xs text-muted-foreground">
        {latestLabel(bulletins[0])}
      </p>
      <BulletinForm
        office={{
          name: tenant.name,
          subtitle: tenant.subtitle,
          legalFooter: tenant.legalFooter,
          city: tenant.location.city,
          state: tenant.location.state,
          publishPrivateFigures: tenant.publishBulletinPrivateFigures,
        }}
        currentMonth={Number(today().slice(5, 7))}
        currentYear={Number(today().slice(0, 4))}
        saved={saved}
        canSign={canSign}
        fromBook={
          fromBook
            ? bookDraft(
                fromBook,
                tenant.publishBulletinPrivateFigures,
                Boolean(saved[fromBook.month]),
              )
            : undefined
        }
        certificates={certificates.map(({ id, label, holderName }) => ({
          id,
          label,
          holderName,
        }))}
        declared={Object.fromEntries(
          Object.entries(declared).map(([month, figures]) => [
            month,
            declaredDraft(figures),
          ]),
        )}
      />
      <BulletinList
        bulletins={bulletins}
        signed={bulletins
          .filter((row) => {
            const stored = storedBulletinOf(row, tenant.location.state);
            return (
              stored &&
              row.signedPdfPath &&
              row.signedFingerprint ===
                bulletinFingerprint(
                  tenant,
                  row.referenceMonth,
                  isBulletinStatus(row.status) ? row.status : "preliminary",
                  stored,
                )
            );
          })
          .map((row) => row.id)}
      />
    </div>
  );
}
