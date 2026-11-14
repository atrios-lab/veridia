import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  certidaoModel,
  formatMatricula,
  prefillCertidao,
} from "@/core/rcpn/certidao.ts";
import { FICHA, fichaFilled, fichaValue } from "@/core/rcpn/ficha.ts";
import { formatIsoDate, RCPN_KIND_LABELS } from "@/core/rcpn/record.ts";
import { OFFICE_TIME_ZONE } from "@/core/time/office-time.ts";
import { ficha as fichas } from "@/lib/rcpn-ficha.ts";
import { getTenant } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { buttonVariants } from "../../../../_ui/button.tsx";
import { canIssue, requireRcpn } from "../../_lib/access.ts";
import { CancelRecordButton, RestoreRecordButton } from "../ficha-forms.tsx";

export const metadata = { title: "Registro" };

const HISTORY_LABELS = {
  edicao: "Alteração",
  cancelamento: "Cancelamento",
  estorno: "Estorno do cancelamento",
} as const;

const when = (date: Date) =>
  date.toLocaleString("pt-BR", {
    timeZone: OFFICE_TIME_ZONE,
    dateStyle: "short",
    timeStyle: "short",
  });

/** How a stored value reads: dates as dd/mm/aaaa, the matrícula in blocks. */
function shown(key: string, value: string): string {
  if (!value) return "";
  if (key === "r.matricula") return formatMatricula(value);
  return formatIsoDate(value) || value;
}

export default async function RcpnRecordPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    alterados?: string;
    cancelado?: string;
    estornado?: string;
  }>;
}) {
  const session = await requireRcpn();
  const tenant = await getTenant();
  const found = await fichas.get(tenant.slug, (await params).id);
  if (!found) notFound();
  const notice = await searchParams;
  const { record } = found;
  const canceled = Boolean(found.canceledAt);
  const issue = canIssue(session) && !canceled;
  const edit = can(
    session.user.role ?? "",
    "rcpn.edit",
    session.user.permissions,
  );
  // The certidão as it will come out: the index plus the book's data.
  const certidao = prefillCertidao(record);
  const model = certidaoModel(record.kind);
  const certidaoFilled = model.fields.filter((f) =>
    certidao[f.key]?.trim(),
  ).length;
  const { filled, total } = fichaFilled(record);
  const where = [
    record.book && `Livro ${record.book}`,
    record.page && `folha ${record.page}`,
    record.term && `termo ${record.term}`,
  ]
    .filter(Boolean)
    .join(", ");
  const changed = Number(notice.alterados ?? "");

  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title={`${RCPN_KIND_LABELS[record.kind]}${record.subtype === "natimorto" ? " · Natimorto" : ""}: ${record.people.map((p) => p.name).join(" e ")}`}
        description={where || undefined}
        actions={
          <span className="inline-flex flex-wrap gap-2">
            {issue && (
              <>
                <Link
                  href={`/admin/rcpn/certidoes/nova?registro=${record.id}`}
                  className={buttonVariants()}
                >
                  Emitir certidão
                </Link>
                <Link
                  href={`/admin/rcpn/certidoes/nova?registro=${record.id}&via=inteiro-teor`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  Inteiro teor
                </Link>
              </>
            )}
            {edit && !canceled && (
              <Link
                href={`/admin/rcpn/registro/${record.id}/alterar`}
                className={buttonVariants({ variant: "outline" })}
              >
                Alterar
              </Link>
            )}
          </span>
        }
      />
      <main className="flex max-w-[1000px] flex-col gap-5 px-4 py-7 md:px-8">
        <BackLink
          href={`/admin/rcpn?tipo=${record.kind}`}
          label={`Pesquisa de ${RCPN_KIND_LABELS[record.kind].toLowerCase()}`}
        />

        {Number.isFinite(changed) && notice.alterados !== undefined && (
          <output className="block rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            {changed === 0
              ? "Nenhum campo estava diferente: nada foi alterado."
              : changed === 1
                ? "1 campo alterado. O antes e o depois estão no histórico, abaixo."
                : `${changed} campos alterados. O antes e o depois estão no histórico, abaixo.`}
          </output>
        )}
        {notice.estornado && (
          <output className="block rounded-xl border border-success/30 bg-success-soft px-4 py-3 text-sm font-medium text-success-text">
            Cancelamento estornado: o registro voltou a valer no índice.
          </output>
        )}
        {canceled && (
          <section className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-sm">
              <p className="font-semibold text-destructive">
                Registro cancelado
                {found.canceledAt && ` em ${when(found.canceledAt)}`}
              </p>
              <p className="mt-1 text-foreground text-justify hyphens-auto">
                Justificativa: {found.cancelReason}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Continua guardado. Enquanto estiver cancelado, não sai certidão
                por aqui.
              </p>
            </div>
            {edit && <RestoreRecordButton id={record.id} />}
          </section>
        )}

        <section className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card px-6 py-4 text-sm shadow-xs">
          <span>
            <span className="text-muted-foreground">Ficha: </span>
            <span className="font-semibold tabular-nums text-foreground">
              {filled} de {total}
            </span>{" "}
            campos preenchidos
          </span>
          <span>
            <span className="text-muted-foreground">Certidão: </span>
            <span className="font-semibold tabular-nums text-foreground">
              {certidaoFilled} de {model.fields.length}
            </span>{" "}
            campos prontos
          </span>
          {found.editedAt && (
            <span className="text-muted-foreground">
              Corrigido no painel em {when(found.editedAt)}
            </span>
          )}
        </section>

        {FICHA[record.kind].map((section) => (
          <section
            key={section.title}
            className="rounded-xl border bg-card p-6 shadow-xs"
          >
            <h2 className="text-lg font-semibold text-foreground">
              {section.title}
            </h2>
            <dl className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {section.fields.map((field) => {
                const value = shown(field.key, fichaValue(record, field.key));
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
                    <dd
                      className={`text-sm whitespace-pre-line text-justify hyphens-auto ${field.key === "r.matricula" ? "font-mono" : ""}`}
                    >
                      {value || (
                        <span className="text-muted-foreground">
                          Não veio nos arquivos
                        </span>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </section>
        ))}

        <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
          <h2 className="text-lg font-semibold text-foreground">Histórico</h2>
          {found.history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Do jeito que veio dos arquivos: nenhuma alteração, cancelamento ou
              estorno feito no painel.
            </p>
          ) : (
            <ol className="flex flex-col gap-3">
              {found.history.map((h) => (
                <li key={h.id} className="rounded-lg border px-4 py-3 text-sm">
                  <p className="font-medium text-foreground">
                    {HISTORY_LABELS[h.kind]} · {when(h.createdAt)}
                    {h.actorName && ` · ${h.actorName}`}
                  </p>
                  <p className="mt-1 text-justify hyphens-auto text-muted-foreground">
                    Justificativa: {h.reason}
                  </p>
                  {h.changes.length > 0 && (
                    <ul className="mt-2 flex flex-col gap-1 text-xs">
                      {h.changes.map((c) => (
                        <li key={c.key}>
                          <span className="font-medium text-foreground">
                            {c.label}:
                          </span>{" "}
                          {shown(c.key, c.before) || "(vazio)"} →{" "}
                          {shown(c.key, c.after) || "(vazio)"}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {edit && !canceled && (
          <section className="flex flex-col gap-3 rounded-xl border border-destructive/20 bg-card p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground text-justify hyphens-auto">
              Cancelar tira o registro do uso, sem apagar: ele fica guardado,
              marcado, com a justificativa, e pode ser estornado.
            </p>
            <CancelRecordButton id={record.id} />
          </section>
        )}
      </main>
    </>
  );
}
