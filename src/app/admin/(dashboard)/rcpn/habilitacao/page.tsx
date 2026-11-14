import Link from "next/link";
import {
  HABILITACAO_KIND_LABELS,
  type HabilitacaoStatus,
  kindOf,
  STATUS_LABELS,
  timelineOf,
} from "@/core/rcpn/habilitacao.ts";
import { formatIsoDate } from "@/core/rcpn/record.ts";
import { habilitacoes } from "@/lib/rcpn-habilitacao.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { BackLink } from "../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { buttonVariants } from "../../../_ui/button.tsx";
import { requireRcpn } from "../_lib/access.ts";

export const metadata = { title: "Habilitação de casamento" };

const TONE: Record<HabilitacaoStatus, string> = {
  preparo: "border-border bg-muted text-foreground",
  edital: "border-primary/30 bg-primary/5 text-primary",
  habilitados: "border-success/30 bg-success-soft text-success-text",
  vencida: "border-destructive/30 bg-destructive/5 text-destructive",
  celebrado: "border-border bg-card text-muted-foreground",
  cancelada: "border-destructive/30 bg-destructive/5 text-destructive",
};

const FILTERS: { key: string; label: string; match: HabilitacaoStatus[] }[] = [
  {
    key: "andamento",
    label: "Em andamento",
    match: ["preparo", "edital", "habilitados", "vencida"],
  },
  { key: "celebrados", label: "Celebrados", match: ["celebrado"] },
  { key: "cancelados", label: "Cancelados", match: ["cancelada"] },
  {
    key: "todos",
    label: "Todos",
    match: [
      "preparo",
      "edital",
      "habilitados",
      "vencida",
      "celebrado",
      "cancelada",
    ],
  },
];

/** What is running against the processo, in words. */
function deadline(t: ReturnType<typeof timelineOf>): string {
  if (t.status === "edital" && t.certificadoAte) {
    return `Certificado até ${formatIsoDate(t.certificadoAte)}`;
  }
  if (t.status === "habilitados" && t.validaAte) {
    return `Vale até ${formatIsoDate(t.validaAte)} (${t.diasRestantes} dia${t.diasRestantes === 1 ? "" : "s"})`;
  }
  if (t.status === "vencida" && t.validaAte) {
    return `Venceu em ${formatIsoDate(t.validaAte)}`;
  }
  return "";
}

export default async function HabilitacoesPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  await requireRcpn("rcpn.habilitacao");
  const tenant = await getTenant();
  const on = today();
  const { filtro } = await searchParams;
  const filter = FILTERS.find((f) => f.key === filtro) ?? FILTERS[0];
  const all = (await habilitacoes.list(tenant.slug)).map((h) => ({
    ...h,
    timeline: timelineOf(h.values, on, Boolean(h.canceledAt)),
  }));
  const shown = all.filter((h) => filter?.match.includes(h.timeline.status));
  const urgent = all.filter(
    (h) =>
      (h.timeline.status === "edital" &&
        (h.timeline.diasRestantes ?? 9) <= 1) ||
      (h.timeline.status === "habilitados" &&
        (h.timeline.diasRestantes ?? 99) <= 10),
  );

  return (
    <>
      <AdminPageHeader
        maxWidth={1100}
        title="Habilitação de casamento"
        description="Um processo por casal, preenchido uma vez: requerimento, testemunhas, edital no site, certidão de proclamas e certificado saem dos mesmos dados."
        actions={
          <Link
            href="/admin/rcpn/habilitacao/nova"
            className={buttonVariants()}
          >
            Nova habilitação
          </Link>
        }
      />
      <main className="flex max-w-[1100px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink href="/admin/rcpn" label="Registro Civil" />

        {urgent.length > 0 && (
          <section className="rounded-xl border border-warning/40 bg-warning-soft px-5 py-4 text-sm text-warning-text">
            <p className="font-semibold">Prazos perto do fim</p>
            <ul className="mt-1 list-disc pl-5">
              {urgent.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/admin/rcpn/habilitacao/${h.id}`}
                    className="underline underline-offset-2"
                  >
                    Processo {h.number}
                  </Link>
                  : {deadline(h.timeline)}
                </li>
              ))}
            </ul>
          </section>
        )}

        <nav aria-label="Filtrar processos" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/admin/rcpn/habilitacao?filtro=${f.key}`}
              aria-current={f.key === filter?.key ? "page" : undefined}
              className={buttonVariants({
                variant: f.key === filter?.key ? "default" : "outline",
                size: "sm",
              })}
            >
              {f.label}
            </Link>
          ))}
        </nav>

        {shown.length === 0 ? (
          <p className="rounded-xl border bg-card px-6 py-5 text-sm text-muted-foreground shadow-xs">
            {all.length === 0
              ? "Nenhum processo ainda. Clique em Nova habilitação para abrir o primeiro."
              : "Nenhum processo neste filtro."}
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {shown.map((h) => (
              <li key={h.id}>
                <Link
                  href={`/admin/rcpn/habilitacao/${h.id}`}
                  className="flex h-full flex-col gap-2 rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary/40"
                >
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium tabular-nums text-muted-foreground">
                      Processo {h.number} ·{" "}
                      {HABILITACAO_KIND_LABELS[kindOf(h.values)]}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONE[h.timeline.status]}`}
                    >
                      {STATUS_LABELS[h.timeline.status]}
                    </span>
                  </span>
                  <span className="font-semibold text-foreground">
                    {[h.values["n1.nome"], h.values["n2.nome"]]
                      .filter(Boolean)
                      .join(" e ") || "Nubentes sem nome"}
                  </span>
                  {deadline(h.timeline) && (
                    <span className="text-sm text-muted-foreground">
                      {deadline(h.timeline)}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
