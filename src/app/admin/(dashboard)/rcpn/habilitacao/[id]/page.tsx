import Link from "next/link";
import { notFound } from "next/navigation";
import {
  HABILITACAO_KIND_LABELS,
  HABILITACAO_SECTIONS,
  kindOf,
  reviewHabilitacao,
  STATUS_LABELS,
  shownValue,
  timelineOf,
} from "@/core/rcpn/habilitacao.ts";
import {
  DOCUMENT_LABELS,
  documentBlocker,
  HABILITACAO_DOCUMENTS,
} from "@/core/rcpn/habilitacao-docs.ts";
import { formatIsoDate } from "@/core/rcpn/record.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { habilitacoes } from "@/lib/rcpn-habilitacao.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { SignOrPrint } from "../../../../_components/sign-or-print.tsx";
import { buttonVariants } from "../../../../_ui/button.tsx";
import { requireRcpn } from "../../_lib/access.ts";
import {
  CancelHabilitacaoButton,
  CertificadoTodayButton,
  PublishEditalButton,
  RestoreHabilitacaoButton,
} from "../habilitacao-forms.tsx";

export const metadata = { title: "Habilitação de casamento" };

const HISTORY_LABELS = {
  abertura: "Processo aberto",
  edicao: "Alteração",
  edital: "Edital publicado no site",
  cancelamento: "Cancelamento",
  estorno: "Estorno do cancelamento",
} as const;

const when = (date: Date) =>
  date.toLocaleString("pt-BR", {
    timeZone: OFFICE_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  });

const NOTICES: Record<string, string> = {
  aberto: "Processo aberto. Complete o que faltar e siga os passos abaixo.",
  edital:
    "Edital publicado no site, só com nome, estado civil, filiação e domicílio (Código Nacional de Normas, art. 122).",
  certificado:
    "Certificado extraído. Ele vale por 90 dias (Código Civil, art. 1.532).",
  estornado: "Cancelamento estornado: o processo voltou a andar.",
};

export default async function HabilitacaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireRcpn("rcpn.habilitacao");
  const tenant = await getTenant();
  const found = await habilitacoes.get(tenant.slug, (await params).id);
  if (!found) notFound();
  const query = await searchParams;
  const on = today();
  const { values } = found;
  const kind = kindOf(values);
  const canceled = Boolean(found.canceledAt);
  const timeline = timelineOf(values, on, canceled);
  const review = reviewHabilitacao(values, on);
  const notice = Object.keys(NOTICES).find((k) => query[k] !== undefined);
  const changed =
    query.alterados !== undefined ? Number(query.alterados) : undefined;
  const names =
    [values["n1.nome"], values["n2.nome"]].filter(Boolean).join(" e ") ||
    "Nubentes sem nome";
  const steps = [
    {
      done: review.problems.length === 0,
      label: "Dados completos",
      detail:
        review.problems.length === 0
          ? "Nada impede o edital e o certificado."
          : `${review.problems.length} pendência${review.problems.length === 1 ? "" : "s"} abaixo.`,
    },
    {
      done: Boolean(values.editalEm),
      label: "Edital publicado",
      detail: values.editalEm
        ? `Em ${formatIsoDate(values.editalEm)}.`
        : "Publique no site por aqui (Lei nº 6.015/1973, art. 67, § 1º).",
    },
    ...(kind === "conversao"
      ? [
          {
            done: false,
            label: "Assento no Livro B",
            detail:
              "Estando em termos o pedido, lavre o assento da conversão, sem celebração (Lei nº 6.015/1973, art. 70-A, §§ 3º e 4º).",
          },
        ]
      : [
          {
            done: Boolean(values.certificadoEm),
            label: "Certificado extraído",
            detail: values.certificadoEm
              ? `Em ${formatIsoDate(values.certificadoEm)}; vale até ${formatIsoDate(timeline.validaAte ?? "")}.`
              : timeline.certificadoAte
                ? `Até ${formatIsoDate(timeline.certificadoAte)} (5 dias da publicação).`
                : "Depois do edital, em até 5 dias.",
          },
          {
            done: timeline.status === "celebrado",
            label: "Casamento celebrado",
            detail: values.celebracaoData
              ? `Marcado para ${formatIsoDate(values.celebracaoData)}${values.celebracaoHora ? `, às ${values.celebracaoHora}` : ""}.`
              : "Dia, hora e lugar ainda não designados.",
          },
        ]),
  ];

  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title={`Processo ${found.number}: ${names}`}
        description={`${HABILITACAO_KIND_LABELS[kind]} · ${STATUS_LABELS[timeline.status]}`}
        actions={
          !canceled && (
            <Link
              href={`/admin/rcpn/habilitacao/${found.id}/alterar`}
              className={buttonVariants({ variant: "outline" })}
            >
              Alterar
            </Link>
          )
        }
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink href="/admin/rcpn/habilitacao" label="Habilitações" />

        {(notice || changed !== undefined) && (
          <output className="block rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            {notice
              ? NOTICES[notice]
              : changed === 0
                ? "Nenhum campo estava diferente: nada foi alterado."
                : `${changed} campo${changed === 1 ? "" : "s"} alterado${changed === 1 ? "" : "s"}. O antes e o depois estão no histórico.`}
          </output>
        )}

        {canceled && (
          <section className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-sm">
              <p className="font-semibold text-destructive">
                Processo cancelado
                {found.canceledAt && ` em ${when(found.canceledAt)}`}
              </p>
              <p className="mt-1 text-justify hyphens-auto">
                Justificativa: {found.cancelReason}
              </p>
            </div>
            <RestoreHabilitacaoButton id={found.id} />
          </section>
        )}

        <section className="rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">Andamento</h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            {steps.map((step, index) => (
              <li
                key={step.label}
                className={`flex gap-3 rounded-lg border px-4 py-3 ${step.done ? "border-success/30 bg-success-soft" : ""}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-xs font-bold ${step.done ? "bg-success text-white" : "bg-muted text-foreground"}`}
                >
                  {step.done ? "✓" : index + 1}
                </span>
                <span className="text-sm">
                  <span className="block font-semibold text-foreground">
                    {step.label}
                    <span className="sr-only">
                      {step.done ? " (feito)" : " (a fazer)"}
                    </span>
                  </span>
                  <span className="text-muted-foreground">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          {!canceled && (
            <div className="mt-4 flex flex-wrap gap-4">
              {!found.publicationId && <PublishEditalButton id={found.id} />}
              {kind !== "conversao" &&
                values.editalEm &&
                !values.certificadoEm && (
                  <CertificadoTodayButton id={found.id} />
                )}
            </div>
          )}
        </section>

        {(review.problems.length > 0 || review.warnings.length > 0) && (
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
            {review.problems.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground">
                  O que falta
                </h2>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-destructive">
                  {review.problems.map((p) => (
                    <li key={p} className="text-justify hyphens-auto">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {review.warnings.length > 0 && (
              <div className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning-text">
                <p className="font-semibold">Para conferir</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {review.warnings.map((w) => (
                    <li key={w} className="text-justify hyphens-auto">
                      {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <section className="rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">Documentos</h2>
          <p className="mt-1 text-sm text-muted-foreground text-justify hyphens-auto">
            Cada documento sai dos dados do processo. Assine digitalmente pelo
            painel ou imprima para assinar à mão.
          </p>
          <ul className="mt-4 flex flex-col divide-y">
            {HABILITACAO_DOCUMENTS.map((doc) => {
              const blocker = documentBlocker(doc, values);
              const href = `/admin/rcpn/habilitacao/${found.id}/documento/${doc}`;
              return (
                <li
                  key={doc}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="text-sm">
                    <span className="block font-medium text-foreground">
                      {DOCUMENT_LABELS[doc]}
                    </span>
                    {blocker && (
                      <span className="text-muted-foreground">{blocker}</span>
                    )}
                  </span>
                  {!blocker && !canceled && (
                    <SignOrPrint
                      pdfHref={href}
                      title={`${DOCUMENT_LABELS[doc]} · processo ${found.number}`}
                      size="sm"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {HABILITACAO_SECTIONS.map((section) => {
          const fields = section.fields.filter(
            (f) => !f.only || f.only.includes(kind),
          );
          return (
            <section
              key={section.title}
              className="rounded-xl border bg-card p-6 shadow-xs"
            >
              <h2 className="text-lg font-semibold text-foreground">
                {section.title}
              </h2>
              <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                {fields.map((field) => {
                  const value = shownValue(field.key, values[field.key] ?? "");
                  return (
                    <div
                      key={field.key}
                      className={
                        field.half || field.input === "date"
                          ? undefined
                          : "sm:col-span-2"
                      }
                    >
                      <dt className="text-xs font-medium text-muted-foreground">
                        {field.label}
                      </dt>
                      <dd className="text-sm whitespace-pre-line text-justify hyphens-auto">
                        {value || (
                          <span className="text-muted-foreground">
                            Não informado
                          </span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          );
        })}

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">Histórico</h2>
          <ol className="flex flex-col gap-3">
            {found.history.map((h) => (
              <li key={h.id} className="rounded-lg border px-4 py-3 text-sm">
                <p className="font-medium text-foreground">
                  {HISTORY_LABELS[h.kind]} · {when(h.createdAt)}
                  {h.actorName && ` · ${h.actorName}`}
                </p>
                {h.reason && (
                  <p className="mt-1 text-justify hyphens-auto text-muted-foreground">
                    Justificativa: {h.reason}
                  </p>
                )}
                {h.kind !== "abertura" && h.changes.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 text-xs">
                    {h.changes.map((c) => (
                      <li key={c.key}>
                        <span className="font-medium text-foreground">
                          {c.label}:
                        </span>{" "}
                        {shownValue(c.key, c.before) || "(vazio)"} →{" "}
                        {shownValue(c.key, c.after) || "(vazio)"}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>

        {!canceled && (
          <section className="flex flex-col gap-3 rounded-xl border border-destructive/20 bg-card p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground text-justify hyphens-auto">
              Cancelar tira o processo do andamento, sem apagar: ele fica
              guardado, marcado, com a justificativa, e pode ser estornado.
            </p>
            <CancelHabilitacaoButton id={found.id} />
          </section>
        )}
      </main>
    </>
  );
}
