import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CHECK_LABELS,
  SOURCE_AREAS,
  SOURCE_KINDS,
} from "@/core/conhecimento/base.ts";
import {
  formatOfficeDate,
  formatOfficeDateTime,
} from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { aiBlockedWith } from "@/lib/ai.ts";
import { getSourceWith } from "@/lib/knowledge.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { buttonVariants } from "../../../../_ui/button.tsx";
import { requireKnowledge } from "../_access.ts";
import {
  CheckSourceButton,
  ConfirmSourceButton,
  RemoveSourceButton,
  RestoreSourceButton,
} from "../knowledge-forms.tsx";
import { MarkdownView } from "../markdown-view.tsx";

export const metadata = { title: "Fonte da base jurídica" };

const BASE = "/admin/utilitarios/base-juridica";

export default async function SourcePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conferida?: string; nova?: string }>;
}) {
  await requireKnowledge();
  const { id } = await params;
  const { conferida, nova } = await searchParams;
  const tenant = await getTenant();
  const [source, aiOff] = await Promise.all([
    getSourceWith(db, tenant.slug, id),
    aiBlockedWith(db, tenant.slug),
  ]);
  if (!source) notFound();
  const m = source.meta;
  const active = !source.removedAt && !m.replacedBy;

  return (
    <>
      <AdminPageHeader maxWidth={1000} title={m.title} />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink href={BASE} label="Base jurídica da IA" />
        {nova === "1" && (
          <p
            aria-live="polite"
            className="rounded-xl border border-primary/25 bg-primary/5 px-5 py-3 text-sm text-foreground"
          >
            Versão nova guardada. A anterior continua guardada, fora da base.
          </p>
        )}
        {conferida === "1" && m.check && (
          <p
            aria-live="polite"
            className="rounded-xl border border-primary/25 bg-primary/5 px-5 py-3 text-sm text-foreground"
          >
            Conferência feita: {CHECK_LABELS[m.check.result]}.
            {m.check.result === "alterada" || m.check.result === "revogada"
              ? " A IA deixou um pedido na lista da base."
              : ""}
          </p>
        )}
        {m.pending?.length ? (
          <section className="flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-soft p-5">
            <h2 className="text-base font-semibold text-foreground">
              Em conferência: esta fonte não é usada
            </h2>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
              {m.pending.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {!source.removedAt && (
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`${BASE}/${source.id}/alterar#trocar`}
                  className={buttonVariants({ size: "sm" })}
                >
                  Trocar pelo arquivo certo
                </Link>
                <ConfirmSourceButton id={source.id} />
              </div>
            )}
          </section>
        ) : null}
        {source.removedAt && (
          <p className="rounded-xl border bg-muted px-5 py-3 text-sm text-foreground">
            Excluída em {formatOfficeDateTime(source.removedAt)}
            {source.removedReason ? `: ${source.removedReason}` : ""}. Fica
            guardada e fora da base.
          </p>
        )}
        {m.replacedBy && (
          <p className="rounded-xl border bg-muted px-5 py-3 text-sm text-foreground">
            Versão antiga, fora da base.{" "}
            <Link href={`${BASE}/${m.replacedBy}`} className="underline">
              Ver a versão nova
            </Link>
          </p>
        )}
        <section className="rounded-xl border bg-card p-6 shadow-xs">
          <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {[
              ["Tipo", SOURCE_KINDS[m.kind].label],
              ["Referência", m.reference || "Não informada"],
              ["Órgão", m.issuer || "Não informado"],
              [
                "Data",
                m.date
                  ? m.date.split("-").reverse().join("/")
                  : "Não informada",
              ],
              [
                "Situação",
                m.status === "revogada" ? "Revogada (não é usada)" : "Vigente",
              ],
              [
                "Atribuições",
                m.areas.length
                  ? m.areas.map((a) => SOURCE_AREAS[a]).join(", ")
                  : "Todas",
              ],
              ["Veio de", source.origin || "Não informado"],
              [
                "Guardada em",
                `${formatOfficeDate(source.createdAt)} · ${source.passages} trechos`,
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-foreground [overflow-wrap:anywhere]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {m.url && (
            <p className="mt-3 text-sm [overflow-wrap:anywhere]">
              <a
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                {m.url}
              </a>
            </p>
          )}
          {m.notes && (
            <p className="mt-3 text-sm text-muted-foreground text-justify">
              {m.notes}
            </p>
          )}
          {m.replaces && (
            <p className="mt-3 text-sm">
              <Link href={`${BASE}/${m.replaces}`} className="underline">
                Ver a versão anterior
              </Link>
            </p>
          )}
        </section>
        {m.check && (
          <section className="rounded-xl border bg-card p-6 text-sm shadow-xs">
            <h2 className="text-base font-semibold text-foreground">
              Conferência na fonte oficial: {CHECK_LABELS[m.check.result]}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Pela IA, só nos sites oficiais, em{" "}
              {m.check.on
                ? formatOfficeDateTime(new Date(m.check.on))
                : "data não registrada"}
              .
            </p>
            {m.check.summary && (
              <p className="mt-2 text-foreground text-justify hyphens-auto">
                {m.check.summary}
              </p>
            )}
            {m.check.url && (
              <p className="mt-2 [overflow-wrap:anywhere]">
                <a
                  href={m.check.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {m.check.url}
                </a>
              </p>
            )}
          </section>
        )}
        <div className="flex flex-wrap items-start gap-2">
          <a
            href={`${BASE}/${source.id}/md`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Baixar em .md
          </a>
          {active && (
            <>
              <Link
                href={`${BASE}/${source.id}/alterar`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Alterar dados ou trocar o arquivo
              </Link>
              {aiOff ? (
                <span className="self-center text-xs text-muted-foreground">
                  Conferência pela IA: {aiOff}
                </span>
              ) : (
                <CheckSourceButton id={source.id} />
              )}
              <RemoveSourceButton id={source.id} />
            </>
          )}
          {source.removedAt && <RestoreSourceButton id={source.id} />}
        </div>
        <section className="rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="mb-3 text-lg font-semibold text-foreground">Texto</h2>
          <div className="flex flex-col gap-4">
            {source.sections.map((s, i) => (
              <article
                // biome-ignore lint/suspicious/noArrayIndexKey: sections keep their order
                key={i}
                className="border-b pb-4 last:border-b-0 last:pb-0"
              >
                <MarkdownView text={s.text} />
              </article>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
