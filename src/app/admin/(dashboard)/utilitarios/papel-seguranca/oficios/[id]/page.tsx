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
import { requirePaperAccess } from "../../_lib/access.ts";
import { RemoveReportButton, ReportEditForm, SentForm } from "../../forms.tsx";

export const metadata = { title: "Ofício do papel de segurança" };

const TH =
  "px-3 py-2 text-right text-[11px] font-bold uppercase tracking-[0.05em] text-admin-muted first:text-left";
const TD = "px-3 py-2 text-right text-[13px] text-admin-text first:text-left";

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
        title={title}
        back={{
          href: "/admin/utilitarios/papel-seguranca",
          label: "Papel de segurança",
        }}
        description={`${REPORT_LABELS[kind]} · ${periodLabel(snapshot.period)}`}
      />
      <main className="flex max-w-[1000px] flex-col gap-4.5 px-[30px] py-7 max-md:px-4">
        {query.gerado && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
            Documento gerado e guardado. Confira, assine e envie
            {kind === "relatorio"
              ? " ao arquivo da serventia."
              : " à Corregedoria."}
          </p>
        )}

        <section className="flex flex-wrap items-center gap-3 rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <div className="mr-auto">
            <p className="text-[13px] font-bold text-admin-primary">{title}</p>
            <p className="text-[12px] text-admin-muted">
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
            className="btn btn-admin-secondary btn-md"
            title="Planilha para abrir no Excel ou no LibreOffice"
          >
            <AdminIcon name="grid" className="h-4 w-4" /> Baixar planilha
          </a>
        </section>

        {snapshot.summary.length > 0 && (
          <section className="overflow-x-auto rounded-[14px] border border-admin-border bg-admin-card">
            <h2 className="px-4 pt-3.5 font-serif text-[16px] font-semibold text-admin-primary">
              Demonstrativo
            </h2>
            <table className="mt-2 w-full min-w-[760px]">
              <thead className="border-y border-admin-border bg-admin-input-bg">
                <tr>
                  <th className={TH}>Espécie</th>
                  <th className={TH}>Inicial</th>
                  <th className={TH}>Recebidas</th>
                  {MOVEMENT_TYPES.map((t) => (
                    <th key={t} className={TH}>
                      {MOVEMENT_COLUMNS[t]}
                    </th>
                  ))}
                  <th className={TH}>Final</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ...snapshot.summary,
                  ...(snapshot.summary.length > 1 ? [total] : []),
                ].map((r) => (
                  <tr
                    key={r.kind}
                    className={`border-b border-admin-border last:border-0 ${r === total ? "font-bold" : ""}`}
                  >
                    <td className={TD}>{r.kind}</td>
                    <td className={TD}>{r.initial.toLocaleString("pt-BR")}</td>
                    <td className={TD}>{r.received.toLocaleString("pt-BR")}</td>
                    {MOVEMENT_TYPES.map((t) => (
                      <td key={t} className={TD}>
                        {r.moved[t].toLocaleString("pt-BR")}
                      </td>
                    ))}
                    <td className={TD}>{r.final.toLocaleString("pt-BR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {kind === "extravio" && (
          <section className="overflow-x-auto rounded-[14px] border border-admin-border bg-admin-card">
            <h2 className="px-4 pt-3.5 font-serif text-[16px] font-semibold text-admin-primary">
              Folhas comunicadas
            </h2>
            <ul className="mt-2">
              {snapshot.movements.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-wrap gap-x-4 border-t border-admin-border px-4 py-2.5 text-[13px]"
                >
                  <span className="w-[86px]">{brDate(m.occurredOn)}</span>
                  <span className="font-semibold">
                    {MOVEMENT_COLUMNS[m.type].replace(/s$/, "")}
                  </span>
                  <span>{m.kind}</span>
                  <span className="font-mono text-[12px]">{m.range}</span>
                  <span className="text-admin-muted">{m.reference}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {row.removedAt ? (
          <p className="rounded-[12px] bg-admin-error-bg px-4 py-3 text-[13px] font-semibold text-admin-error-text">
            Documento excluído: {row.removeReason}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
                Editar
              </h2>
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
            <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
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
        <p className="text-[12px] text-admin-muted">
          Este documento fica guardado como foi gerado: correções feitas depois
          no classificador só entram nele se você marcar "Refazer os números com
          o classificador de agora" em Editar. O número continua o mesmo.
        </p>
      </main>
    </>
  );
}
