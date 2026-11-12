import { notFound } from "next/navigation";
import {
  REPORT_LABELS,
  type ReportKind,
} from "@/core/security-paper/documents.ts";
import {
  brDate,
  MOVEMENT_COLUMNS,
  MOVEMENT_TYPES,
  periodLabel,
  totalOf,
} from "@/core/security-paper/stock.ts";
import { db } from "@/db/index.ts";
import {
  findReportWith,
  reportNumber,
  snapshotOf,
} from "@/lib/security-paper.ts";
import { getGuideSettings } from "@/lib/tax-guides.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminIcon } from "../../../../../_components/icon.tsx";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { SignOrPrint } from "../../../../../_components/sign-or-print.tsx";
import { buttonVariants } from "../../../../../_ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../../_ui/table.tsx";
import { requirePaperAccess } from "../../_lib/access.ts";
import { RemoveReportButton, ReportEditForm, SentForm } from "../../forms.tsx";

export const metadata = { title: "Ofício do papel de segurança" };

const TH =
  "px-3 text-right text-xs font-medium text-muted-foreground first:text-left";
const TD = "px-3 py-2 text-right tabular-nums text-foreground first:text-left";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ gerado?: string }>;
}) {
  await requirePaperAccess();
  const tenant = await getTenant();
  const row = await findReportWith(db, tenant.slug, (await params).id);
  if (!row) notFound();
  const snapshot = snapshotOf(row);
  const signers = (await getGuideSettings(tenant)).signers;
  const query = await searchParams;
  const number = reportNumber(row);
  const kind = row.kind as ReportKind;
  const title = number ? `Ofício nº ${number}` : "Relatório do classificador";
  const pdfHref = `/admin/utilitarios/papel-seguranca/oficios/${row.id}/arquivo`;
  const total = totalOf(snapshot.summary);

  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title={title}
        back={{
          href: "/admin/utilitarios/papel-seguranca",
          label: "Papel de segurança",
        }}
        description={`${REPORT_LABELS[kind]} · ${periodLabel(snapshot.period)}`}
      />
      <main className="flex max-w-[1000px] flex-col gap-4.5 px-4 py-7 md:px-8">
        {query.gerado && (
          <p className="rounded-lg border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            Documento gerado e guardado. Confira, assine e envie
            {kind === "relatorio"
              ? " ao arquivo da serventia."
              : " à Corregedoria."}
          </p>
        )}

        <section className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-5 py-4">
          <div className="mr-auto">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">
              Datado de {brDate(snapshot.issuedOn)} ·{" "}
              {kind === "extravio"
                ? `${snapshot.movements.length} ocorrência(s)`
                : `estoque final ${total.final.toLocaleString("pt-BR")} folha(s)`}
            </p>
          </div>
          <SignOrPrint
            pdfHref={pdfHref}
            title={`${title} (papel de segurança)`}
          />
          <a
            href={`${pdfHref}?formato=planilha`}
            className={buttonVariants({ variant: "outline" })}
            title="Planilha para abrir no Excel ou no LibreOffice"
          >
            <AdminIcon name="grid" className="h-4 w-4" /> Baixar planilha
          </a>
        </section>

        {snapshot.summary.length > 0 && (
          <section className="overflow-hidden rounded-xl border bg-card">
            <h2 className="px-4 pt-3.5 text-base font-semibold text-foreground">
              Demonstrativo
            </h2>
            <Table className="mt-2 min-w-[760px]">
              <TableHeader className="border-t bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className={TH}>Espécie</TableHead>
                  <TableHead className={TH}>Inicial</TableHead>
                  <TableHead className={TH}>Recebidas</TableHead>
                  {MOVEMENT_TYPES.map((t) => (
                    <TableHead key={t} className={TH}>
                      {MOVEMENT_COLUMNS[t]}
                    </TableHead>
                  ))}
                  <TableHead className={TH}>Final</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ...snapshot.summary,
                  ...(snapshot.summary.length > 1 ? [total] : []),
                ].map((r) => (
                  <TableRow
                    key={r.kind}
                    className={r === total ? "font-semibold" : undefined}
                  >
                    <TableCell className={TD}>{r.kind}</TableCell>
                    <TableCell className={TD}>
                      {r.initial.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className={TD}>
                      {r.received.toLocaleString("pt-BR")}
                    </TableCell>
                    {MOVEMENT_TYPES.map((t) => (
                      <TableCell key={t} className={TD}>
                        {r.moved[t].toLocaleString("pt-BR")}
                      </TableCell>
                    ))}
                    <TableCell className={TD}>
                      {r.final.toLocaleString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        )}

        {kind === "extravio" && (
          <section className="overflow-x-auto rounded-xl border bg-card">
            <h2 className="px-4 pt-3.5 text-base font-semibold text-foreground">
              Folhas comunicadas
            </h2>
            <ul className="mt-2">
              {snapshot.movements.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap gap-x-4 border-t px-4 py-2.5 text-sm"
                >
                  <span className="w-[86px] tabular-nums">
                    {brDate(m.occurredOn)}
                  </span>
                  <span className="font-semibold">
                    {MOVEMENT_COLUMNS[m.type].replace(/s$/, "")}
                  </span>
                  <span>{m.kind}</span>
                  <span className="font-mono text-xs">{m.range}</span>
                  <span className="text-muted-foreground">{m.reference}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {row.removedAt ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
            Documento excluído: {row.removeReason}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">Editar</h2>
              <RemoveReportButton id={row.id} />
            </div>
            <ReportEditForm
              id={row.id}
              signers={signers.map(({ name, title }) => ({ name, title }))}
              initial={{
                issuedOn: snapshot.issuedOn,
                notes: snapshot.notes,
                signer: row.signer,
              }}
            />
          </>
        )}

        {kind !== "relatorio" && !row.removedAt && (
          <>
            <h2 className="text-lg font-semibold text-foreground">
              Envio à Corregedoria
            </h2>
            <SentForm
              id={row.id}
              sentOn={row.sentOn}
              reference={row.sentReference}
              today={today()}
            />
          </>
        )}
        <p className="text-xs text-muted-foreground">
          Este documento fica guardado como foi gerado: correções feitas depois
          no classificador só entram nele se você marcar "Refazer os números com
          o classificador de agora" em Editar. O número continua o mesmo.
        </p>
      </main>
    </>
  );
}
