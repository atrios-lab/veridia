import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  GUIDE_KIND_INFO,
  SPU_LINKS,
  SPU_STEPS,
} from "@/core/guides/catalog.ts";
import { guideAmount } from "@/core/guides/document.ts";
import {
  formatGuideNumber,
  RETENTION_MONTHS,
  RETENTION_WARNING_DAYS,
  retentionState,
} from "@/core/guides/schema.ts";
import {
  statusLabel,
  TERMINAL_SERVICE_REQUEST_STATUSES,
} from "@/core/request/kinds.ts";
import { formatShortDate, toIsoDate } from "@/core/scheduling/calendar.ts";
import { formatMoneyBRL } from "@/core/transparency/bulletin.ts";
import {
  type GuideRequestRow,
  listGuideRequests,
} from "@/lib/guide-requests.ts";
import { getSession } from "@/lib/session.ts";
import {
  getGuideSettings,
  listGuides,
  type StoredGuide,
} from "@/lib/tax-guides.ts";
import { getTenant, OFFICE_TIME_ZONE } from "@/lib/tenant.ts";
import { AdminIcon } from "../../../_components/icon.tsx";
import { AdminPageHeader } from "../../../_components/page-header.tsx";

export const metadata = { title: "Guias de recolhimento" };

/**
 * Utilitários: the guias de recolhimento the notary signs and the party
 * takes to the fisco before the escritura (ITIV/ITBI, ITCD, laudêmio
 * municipal, certidão imobiliária), and what the SPU asks for a property of
 * the União, where no guia comes out of the office.
 */
export default async function GuidesPage({
  searchParams,
}: {
  searchParams: Promise<{ excluida?: string }>;
}) {
  const session = await getSession();
  const role = session?.user.role ?? "";
  const granted = session?.user.permissions;
  if (!session || !can(role, "requests.manage", granted)) notFound();
  const tenant = await getTenant();
  const [guides, settings, requests] = await Promise.all([
    listGuides(tenant.slug).catch(() => [] as StoredGuide[]),
    getGuideSettings(tenant),
    listGuideRequests(tenant.slug).catch(() => [] as GuideRequestRow[]),
  ]);
  const now = new Date();
  const kept = guides.filter(
    (g) => retentionState(g.createdAt, now) !== "past",
  );
  const past = guides.filter(
    (g) => retentionState(g.createdAt, now) === "past",
  );
  const ending = guides.filter(
    (g) => retentionState(g.createdAt, now) === "ending",
  );
  const years = [...new Set(kept.map((g) => g.year))];
  const deleted = (await searchParams).excluida === "1";
  const itivUnset =
    !settings.municipal.itivLaw.trim() ||
    !settings.municipal.itivRateBasisPoints;

  return (
    <>
      <AdminPageHeader title="Guias de recolhimento" />
      <main className="flex max-w-[1100px] flex-col gap-4.5 px-[30px] py-7">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/utilitarios/guias/nova"
            className="btn btn-admin-primary btn-md"
          >
            <AdminIcon name="plus" className="h-4 w-4" /> Nova guia
          </Link>
          {can(role, "content.edit", granted) && (
            <Link
              href="/admin/utilitarios/guias/configuracao"
              className="btn btn-admin-secondary btn-md"
            >
              <AdminIcon name="settings" className="h-4 w-4" /> Leis, alíquotas
              e quem assina
            </Link>
          )}
        </div>

        {itivUnset && (
          <p className="rounded-[12px] border border-admin-warning-soft-border bg-admin-warning-bg px-4 py-3 text-[13px] text-admin-warning-text">
            Falta a lei municipal ou a alíquota do ITIV/ITBI de{" "}
            {tenant.location.city}. Informe em “Leis, alíquotas e quem assina”
            antes de emitir guias de ITIV.
          </p>
        )}

        <GuideRequests requests={requests} />

        {deleted && (
          <p className="rounded-[12px] bg-admin-success-bg px-4 py-3 text-[13px] font-semibold text-admin-success-text">
            Guia excluída. O número ficou livre para a próxima.
          </p>
        )}

        {(ending.length > 0 || past.length > 0) && (
          <section className="rounded-[12px] border-2 border-admin-warning-bg bg-admin-card px-4 py-3 text-[13px] text-admin-text">
            <strong className="text-admin-primary">
              Baixe as guias para o arquivo da serventia.
            </strong>{" "}
            O sistema guarda cada guia por {RETENTION_MONTHS} meses.{" "}
            {ending.length > 0 &&
              `${ending.length} ${ending.length === 1 ? "guia completa" : "guias completam"} esse prazo nos próximos ${RETENTION_WARNING_DAYS} dias. `}
            {past.length > 0 &&
              `${past.length} já ${past.length === 1 ? "passou" : "passaram"} do prazo. `}
            Use “Baixar todas do ano” e salve no arquivo próprio da serventia,
            na nuvem.
          </section>
        )}

        {kept.length === 0 && (
          <p className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-8 text-center text-[13px] text-admin-muted">
            Nenhuma guia emitida ainda.
          </p>
        )}
        {years.map((year) => (
          <GuideYear
            key={year}
            title={String(year)}
            year={year}
            guides={kept.filter((g) => g.year === year)}
            now={now}
          />
        ))}
        {past.length > 0 && (
          <GuideYear title="Prazo de guarda vencido" guides={past} now={now} />
        )}

        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[16px] font-semibold text-admin-primary">
            Imóvel da União (terreno de marinha): guias da SPU
          </h2>
          <p className="mt-1 text-[12.5px] text-admin-muted">
            Não sai guia do cartório: a parte resolve na Secretaria do
            Patrimônio da União, e o cartório confere a CAT antes de lavrar
            (Decreto-Lei nº 2.398/1987, art. 3º).
          </p>
          <ol className="mt-3 flex flex-col gap-2.5">
            {SPU_STEPS.map((step, index) => (
              <li
                key={step.title}
                className="text-[12.5px] leading-relaxed text-admin-text"
              >
                <strong>
                  {index + 1}. {step.title}.
                </strong>{" "}
                {step.detail}
              </li>
            ))}
          </ol>
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {SPU_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12.5px] font-semibold text-admin-primary underline"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}

function GuideYear({
  title,
  year,
  guides,
  now,
}: {
  title: string;
  year?: number;
  guides: StoredGuide[];
  now: Date;
}) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
      <header className="flex flex-wrap items-center gap-3 border-b border-admin-border px-4 py-3">
        <h2 className="mr-auto font-serif text-[17px] font-semibold text-admin-primary">
          {title}{" "}
          <span className="text-[13px] font-normal text-admin-muted">
            ({guides.length} {guides.length === 1 ? "guia" : "guias"})
          </span>
        </h2>
        {year !== undefined && (
          <a
            href={`/admin/utilitarios/guias/ano/${year}`}
            className="btn btn-admin-secondary btn-sm"
          >
            <AdminIcon name="printer" className="h-3.5 w-3.5" /> Baixar todas de{" "}
            {year} (PDF)
          </a>
        )}
      </header>
      <table className="w-full text-left text-[13px]">
        <thead className="border-b border-admin-border text-[11px] font-bold uppercase tracking-[0.06em] text-admin-faint">
          <tr>
            <th className="px-4 py-2.5">Nº</th>
            <th className="px-4 py-2.5">Guia</th>
            <th className="px-4 py-2.5">Adquirente</th>
            <th className="px-4 py-2.5 text-right">Valor</th>
            <th className="px-4 py-2.5 text-right">Imposto</th>
            <th className="px-4 py-2.5">Arquivos</th>
          </tr>
        </thead>
        <tbody>
          {guides.map((stored) => {
            const amount = guideAmount(stored.guide);
            const acquirer = stored.guide.parties.find(
              (p) => p.role === "adquirente",
            );
            const base = `/admin/utilitarios/guias/${stored.id}`;
            const state = retentionState(stored.createdAt, now);
            return (
              <tr
                key={stored.id}
                className="border-b border-admin-border last:border-b-0"
              >
                <td className="px-4 py-2.5 font-bold tabular-nums">
                  <Link href={base} className="hover:underline">
                    {formatGuideNumber(stored.year, stored.sequence)}
                  </Link>
                  {state === "ending" && (
                    <span className="ml-2 rounded-full bg-admin-warning-bg px-2 py-0.5 text-[10.5px] font-semibold text-admin-warning-text">
                      baixar
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {GUIDE_KIND_INFO[stored.guide.kind].label}
                </td>
                <td className="px-4 py-2.5">
                  {acquirer?.name ?? ""}
                  {stored.requestProtocol && (
                    <Link
                      href={`/admin/pedidos/${encodeURIComponent(stored.requestProtocol)}`}
                      className="ml-2 rounded-full bg-admin-input-bg px-2 py-0.5 text-[10.5px] font-semibold text-admin-primary hover:underline"
                    >
                      pedido {stored.requestProtocol}
                    </Link>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  R$ {formatMoneyBRL(stored.guide.declaredValueCents)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">
                  {amount.taxCents === null
                    ? ""
                    : `R$ ${formatMoneyBRL(amount.taxCents)}`}
                </td>
                <td className="px-4 py-2.5">
                  <a
                    href={`${base}/arquivo?formato=pdf`}
                    className="font-semibold hover:underline"
                  >
                    PDF
                  </a>{" "}
                  ·{" "}
                  <a
                    href={`${base}/arquivo?formato=docx`}
                    className="font-semibold hover:underline"
                  >
                    Word
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

const CLOSED = new Set<string>(TERMINAL_SERVICE_REQUEST_STATUSES);

/**
 * The guias the citizens asked for on the site: worked here, not in the
 * Pedidos queue. Each opens its request, where the guia is checked, the
 * documents read, the exigência made and the signed guia delivered.
 */
function GuideRequests({ requests }: { requests: GuideRequestRow[] }) {
  const open = requests.filter((row) => !CLOSED.has(row.status));
  const closed = requests.filter((row) => CLOSED.has(row.status)).slice(0, 20);
  return (
    <section className="overflow-hidden rounded-[14px] border border-admin-border bg-admin-card">
      <header className="border-b border-admin-border px-4 py-3">
        <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
          Pedidos do site{" "}
          <span className="text-[13px] font-normal text-admin-muted">
            ({open.length} em aberto)
          </span>
        </h2>
        <p className="mt-0.5 text-[12px] text-admin-muted">
          A guia de cada pedido é gerada sozinha e só a serventia vê. Abra o
          pedido para conferir os documentos, corrigir a guia, fazer exigência e
          entregar a guia assinada com o boleto.
        </p>
      </header>
      {requests.length === 0 ? (
        <p className="px-5 py-6 text-center text-[13px] text-admin-muted">
          Nenhum pedido de guia pelo site ainda.
        </p>
      ) : (
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-admin-border text-[11px] font-bold uppercase tracking-[0.06em] text-admin-faint">
            <tr>
              <th className="px-4 py-2.5">Protocolo</th>
              <th className="px-4 py-2.5">Cliente</th>
              <th className="px-4 py-2.5">Andamento</th>
              <th className="px-4 py-2.5">Guia</th>
              <th className="px-4 py-2.5">Recebido</th>
            </tr>
          </thead>
          <tbody>
            {[...open, ...closed].map((row) => (
              <tr
                key={row.id}
                className="border-b border-admin-border last:border-b-0"
              >
                <td className="px-4 py-2.5 font-bold tabular-nums">
                  <Link
                    href={`/admin/pedidos/${encodeURIComponent(row.protocolNumber)}`}
                    className="hover:underline"
                  >
                    {row.protocolNumber}
                  </Link>
                  {row.citizenUpdatedAt && !CLOSED.has(row.status) && (
                    <span className="ml-2 rounded-full bg-admin-warning-bg px-2 py-0.5 text-[10.5px] font-semibold text-admin-warning-text">
                      cliente atualizou
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">{row.applicantName ?? ""}</td>
                <td className="px-4 py-2.5">
                  {statusLabel("service-request", row.status)}
                </td>
                <td className="px-4 py-2.5 tabular-nums">
                  {row.guideNumber ?? "sem guia"}
                </td>
                <td className="px-4 py-2.5 tabular-nums">
                  {formatShortDate(toIsoDate(row.createdAt, OFFICE_TIME_ZONE))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
