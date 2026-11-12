import Link from "next/link";
import { notFound } from "next/navigation";
import { signHref } from "@/app/admin/_components/sign-or-print";
import { can } from "@/core/auth/roles.ts";
import {
  GUIDE_KIND_INFO,
  guideKindsSummary,
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
import { buttonVariants } from "../../../_ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../_ui/table.tsx";

export const metadata = { title: "Guias de transmissão de bens" };

/**
 * Utilitários: the guias de transmissão de bens the notary signs and the party
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
  if (!session || !can(role, "guides.manage", granted)) notFound();
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
      <AdminPageHeader
        maxWidth={1100}
        title="Guias de transmissão de bens"
        description={guideKindsSummary()}
      />
      <main className="flex max-w-[1100px] flex-col gap-4.5 px-4 py-7 md:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/utilitarios/guias/nova"
            className={buttonVariants()}
          >
            <AdminIcon name="plus" className="h-4 w-4" /> Nova guia
          </Link>
        </div>

        {itivUnset && (
          <p className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-text">
            Falta a lei municipal ou a alíquota do ITIV/ITBI de{" "}
            {tenant.location.city}. Informe em “Leis, alíquotas e quem assina”
            antes de emitir guias de ITIV.
          </p>
        )}

        <GuideRequests requests={requests} />

        {deleted && (
          <p className="rounded-lg bg-success-soft px-4 py-3 text-sm font-semibold text-success-text">
            Guia excluída. O número ficou livre para a próxima.
          </p>
        )}

        {(ending.length > 0 || past.length > 0) && (
          <section className="rounded-lg border-2 border-warning/30 bg-card px-4 py-3 text-sm text-foreground">
            <strong className="text-foreground">
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
          <p className="rounded-xl border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
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

        <section className="rounded-xl border bg-card px-5 py-4">
          <h2 className="text-base font-semibold text-foreground">
            Imóvel da União (terreno de marinha): guias da SPU
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Não sai guia do cartório: a parte resolve na Secretaria do
            Patrimônio da União, e o cartório confere a CAT antes de lavrar
            (Decreto-Lei nº 2.398/1987, art. 3º).
          </p>
          <ol className="mt-3 flex flex-col gap-2.5">
            {SPU_STEPS.map((step, index) => (
              <li
                key={step.title}
                className="text-xs leading-relaxed text-foreground"
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
                  className="text-xs font-semibold text-primary underline"
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
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <h2 className="mr-auto text-lg font-semibold text-foreground">
          {title}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({guides.length} {guides.length === 1 ? "guia" : "guias"})
          </span>
        </h2>
        {year !== undefined && (
          <a
            href={`/admin/utilitarios/guias/ano/${year}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <AdminIcon name="printer" className="h-3.5 w-3.5" /> Baixar todas de{" "}
            {year} (PDF)
          </a>
        )}
        {year !== undefined && (
          <a
            href={signHref(
              `/admin/utilitarios/guias/ano/${year}`,
              `Guias de transmissão de bens de ${year}`,
            )}
            className={buttonVariants({ size: "sm" })}
          >
            <AdminIcon name="lock" className="h-3.5 w-3.5" /> Assinar
            digitalmente
          </a>
        )}
      </header>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-4 text-xs font-medium text-muted-foreground">
              Nº
            </TableHead>
            <TableHead className="px-4 text-xs font-medium text-muted-foreground">
              Guia
            </TableHead>
            <TableHead className="px-4 text-xs font-medium text-muted-foreground">
              Adquirente
            </TableHead>
            <TableHead className="px-4 text-xs font-medium text-muted-foreground text-right">
              Valor
            </TableHead>
            <TableHead className="px-4 text-xs font-medium text-muted-foreground text-right">
              Imposto
            </TableHead>
            <TableHead className="px-4 text-xs font-medium text-muted-foreground">
              Arquivos
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {guides.map((stored) => {
            const amount = guideAmount(stored.guide);
            const acquirer = stored.guide.parties.find(
              (p) => p.role === "adquirente",
            );
            const base = `/admin/utilitarios/guias/${stored.id}`;
            const state = retentionState(stored.createdAt, now);
            return (
              <TableRow key={stored.id}>
                <TableCell className="px-4 py-2.5 font-semibold tabular-nums">
                  <Link href={base} className="hover:underline">
                    {formatGuideNumber(stored.year, stored.sequence)}
                  </Link>
                  {state === "ending" && (
                    <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-text">
                      baixar
                    </span>
                  )}
                </TableCell>
                <TableCell className="px-4 py-2.5 whitespace-normal">
                  {GUIDE_KIND_INFO[stored.guide.kind].label}
                </TableCell>
                <TableCell className="px-4 py-2.5 whitespace-normal">
                  {acquirer?.name ?? ""}
                  {stored.requestProtocol && (
                    <Link
                      href={`/admin/pedidos/${encodeURIComponent(stored.requestProtocol)}`}
                      className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-primary hover:underline"
                    >
                      pedido {stored.requestProtocol}
                    </Link>
                  )}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right tabular-nums">
                  R$ {formatMoneyBRL(stored.guide.declaredValueCents)}
                </TableCell>
                <TableCell className="px-4 py-2.5 text-right tabular-nums">
                  {amount.taxCents === null
                    ? ""
                    : `R$ ${formatMoneyBRL(amount.taxCents)}`}
                </TableCell>
                <TableCell className="px-4 py-2.5 whitespace-normal">
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
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
    <section className="overflow-hidden rounded-xl border bg-card">
      <header className="border-b px-4 py-3">
        <h2 className="text-lg font-semibold text-foreground">
          Pedidos do site{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({open.length} em aberto)
          </span>
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          A guia de cada pedido é gerada sozinha e só a serventia vê. Abra o
          pedido para conferir os documentos, corrigir a guia, fazer exigência e
          entregar a guia assinada com o boleto.
        </p>
      </header>
      {requests.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-muted-foreground">
          Nenhum pedido de guia pelo site ainda.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                Protocolo
              </TableHead>
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                Cliente
              </TableHead>
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                Andamento
              </TableHead>
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                Guia
              </TableHead>
              <TableHead className="px-4 text-xs font-medium text-muted-foreground">
                Recebido
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...open, ...closed].map((row) => (
              <TableRow key={row.id}>
                <TableCell className="px-4 py-2.5 font-semibold tabular-nums">
                  <Link
                    href={`/admin/pedidos/${encodeURIComponent(row.protocolNumber)}`}
                    className="hover:underline"
                  >
                    {row.protocolNumber}
                  </Link>
                  {row.citizenUpdatedAt && !CLOSED.has(row.status) && (
                    <span className="ml-2 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-semibold text-warning-text">
                      cliente atualizou
                    </span>
                  )}
                </TableCell>
                <TableCell className="px-4 py-2.5 whitespace-normal">
                  {row.applicantName ?? ""}
                </TableCell>
                <TableCell className="px-4 py-2.5 whitespace-normal">
                  {statusLabel("service-request", row.status)}
                </TableCell>
                <TableCell className="px-4 py-2.5 tabular-nums">
                  {row.guideNumber ?? "sem guia"}
                </TableCell>
                <TableCell className="px-4 py-2.5 tabular-nums">
                  {formatShortDate(toIsoDate(row.createdAt, OFFICE_TIME_ZONE))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
