import Link from "next/link";
import { notFound } from "next/navigation";
import { can, type Role } from "@/core/auth/roles.ts";
import { planActs } from "@/core/cedulas/analise.ts";
import { requirementTextFromNote } from "@/core/qualificacao/documents.ts";
import { qualificationDeadline, ruleFor } from "@/core/qualificacao/prazos.ts";
import {
  ATTRIBUTIONS,
  actName,
  currentRound,
  daysSince,
  noteProblems,
  positiveProblems,
  STATUS_LABELS,
} from "@/core/qualificacao/qualificacao.ts";
import { isOpenStatus } from "@/core/request/kinds.ts";
import { officeHolidays, toIsoDate } from "@/core/scheduling/calendar.ts";
import {
  formatOfficeDateTime,
  OFFICE_TIME_ZONE,
} from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { aiBlockedWith } from "@/lib/ai.ts";
import { analysesForQualificationWith } from "@/lib/cedulas.ts";
import { feeActItemsWith, feeTableReferenceWith } from "@/lib/fee-tables.ts";
import {
  getDeadlineSettingsWith,
  getQualificationWith,
  listLibraryWith,
  listNotesWith,
  noteNeedsValidation,
  noteValidatedAtWith,
  requestDocumentsWith,
} from "@/lib/qualificacao.ts";
import { findByProtocol } from "@/lib/service-request.ts";
import { certificatesForSignerWith } from "@/lib/signing.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { BackLink } from "../../../../_components/back-link.tsx";
import { FeeTableReminder } from "../../../../_components/fee-table-reminder.tsx";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { ROLE_LABELS } from "../../../../_components/role-labels.ts";
import {
  SignOrPrint,
  signHref,
} from "../../../../_components/sign-or-print.tsx";
import { TirarDuvida } from "../../../../_components/tirar-duvida.tsx";
import { buttonVariants } from "../../../../_ui/button.tsx";
import { requireQualificacao } from "../_access.ts";
import {
  AiProposeForm,
  IssueForm,
  MarkQualificationButton,
  NoteValidation,
  ReexamForm,
  RemoveNoteButton,
  RenumberNoteButton,
  RoundEditor,
  SendNoteForm,
} from "../qualificacao-forms.tsx";

export const metadata = { title: "Qualificação do título" };

const BASE = "/admin/utilitarios/qualificacao";

const isoDate = (iso: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
    : "";

export default async function QualificationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ emitida?: string; ia?: string }>;
}) {
  const session = await requireQualificacao();
  const { id } = await params;
  const { emitida, ia } = await searchParams;
  const tenant = await getTenant();
  const q = await getQualificationWith(db, tenant.slug, id);
  if (!q) notFound();
  const [
    notes,
    library,
    deadlines,
    aiBlocked,
    clientDocs,
    linkedRequest,
    certificates,
    feeTable,
    cedulas,
    feeActs,
  ] = await Promise.all([
    listNotesWith(db, tenant.slug, q.id),
    listLibraryWith(db, tenant.slug, q.data.attribution),
    getDeadlineSettingsWith(db, tenant.slug),
    aiBlockedWith(db, tenant.slug),
    requestDocumentsWith(db, tenant.slug, q.data.protocol),
    q.data.protocol.trim()
      ? findByProtocol(tenant.slug, q.data.protocol.trim())
      : Promise.resolve(null),
    certificatesForSignerWith(db, tenant.slug, session.user.id).catch(() => []),
    // The fee table in force, for reference (decision of 21/11/2026).
    feeTableReferenceWith(db, tenant.slug),
    // The cédula analyses behind this título, with the charge of each act
    // in plain words and the table's code (decision of 21/11/2026).
    analysesForQualificationWith(db, tenant.slug, q.id, q.data.protocol),
    feeActItemsWith(db, tenant.slug),
  ]);
  const round = currentRound(q.data);
  // The Tabelião's validation of the notes with the Assistente Virtual's
  // exigências (decision of 15/11/2026).
  const validations = new Map(
    await Promise.all(
      notes
        .filter((n) => !n.removedAt && noteNeedsValidation(n))
        .map(
          async (n) =>
            [n.id, await noteValidatedAtWith(db, tenant.slug, n.id)] as const,
        ),
    ),
  );
  const canValidate = can(
    session.user.role ?? "",
    "qualificacao.validate",
    session.user.permissions,
  );
  const now = today();
  const active = !q.removedAt;
  const due = active
    ? qualificationDeadline(q.data, deadlines, now, officeHolidays(tenant))
    : null;
  const rule = ruleFor(q.data.attribution, deadlines);
  const signer = {
    name: session.user.name ?? "",
    role: ROLE_LABELS[(session.user.role ?? "") as Role] ?? "",
  };
  const live = notes.filter((n) => !n.removedAt);

  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title={`${actName(q.data)} · ${q.data.presenter.name}`}
        description={`${ATTRIBUTIONS[q.data.attribution]} · ${STATUS_LABELS[q.status]} · ${daysSince(q.data.receivedOn, now)} dias desde a apresentação`}
      />
      <main className="flex max-w-[1000px] flex-col gap-6 px-4 py-7 md:px-8">
        <TirarDuvida topic="qualificacao" />
        <BackLink href={BASE} label="Qualificação de títulos" />
        {emitida && live.length > 0 && (
          <p
            aria-live="polite"
            className="rounded-xl border border-primary/25 bg-primary/5 px-5 py-3 text-sm text-foreground"
          >
            {emitida === "positiva"
              ? "Qualificação positiva emitida."
              : "Nota devolutiva emitida."}{" "}
            Assine digitalmente ou imprima abaixo e entregue ao apresentante.
          </p>
        )}
        {ia !== undefined && (
          <p
            aria-live="polite"
            className="rounded-xl border border-primary/25 bg-primary/5 px-5 py-3 text-sm text-foreground"
          >
            {Number(ia) > 0
              ? `O Assistente Virtual propôs ${ia} ${Number(ia) === 1 ? "exigência" : "exigências"}, marcadas abaixo. Confira cada uma (o fato, o fundamento e a redação), corrija ou tire, e salve antes de emitir.`
              : "O Assistente Virtual não achou exigência: o título está apto. Confira o resumo abaixo e, estando certo, emita a qualificação positiva em Emitir, no fim da página."}
          </p>
        )}
        {due && (
          <p
            className={`rounded-xl border px-5 py-3 text-sm text-foreground ${
              due.late
                ? "border-destructive/30 bg-destructive/5"
                : due.soon
                  ? "border-warning/30 bg-warning-soft"
                  : "bg-card"
            }`}
          >
            {due.late
              ? "Prazo vencido em "
              : "Prazo para registrar ou devolver com a nota: até "}
            {isoDate(due.due)} ({rule.days} dias úteis). {rule.basis}
          </p>
        )}
        <FeeTableReminder
          table={feeTable}
          canUpdate={can(
            session.user.role ?? "",
            "transparency.manage",
            session.user.permissions,
          )}
        />
        {cedulas.map((analysis) => {
          const acts = planActs(analysis.data, {
            fees: feeActs ?? undefined,
          }).acts.filter((act) => act.summary);
          if (acts.length === 0) return null;
          return (
            <section
              key={analysis.id}
              className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 px-5 py-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  Análise da cédula: o que cobrar
                </h2>
                <Link
                  href={`/admin/utilitarios/cedulas/${analysis.id}`}
                  className="text-sm font-medium text-primary underline underline-offset-4"
                >
                  Abrir a análise e o passo a passo
                </Link>
              </div>
              <p className="text-sm text-muted-foreground">{analysis.title}</p>
              <ul className="flex flex-col gap-2 text-sm text-foreground">
                {acts.map((act) => (
                  <li key={act.id}>
                    <strong className="font-semibold">{act.title}.</strong>{" "}
                    {act.summary}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {q.removedAt && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted px-5 py-3 text-sm text-foreground">
            <span>
              Excluída em {formatOfficeDateTime(q.removedAt)}
              {q.removedReason ? `: ${q.removedReason}` : ""}. Fica guardada.
            </span>
            <MarkQualificationButton id={q.id} restore />
          </div>
        )}

        <section className="rounded-xl border bg-card p-6 shadow-xs">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              Apresentação
            </h2>
            {active && (
              <Link
                href={`${BASE}/${q.id}/dados`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Alterar dados, fundamentos e observações
              </Link>
            )}
          </div>
          <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            {[
              ["Apresentante", q.data.presenter.name],
              [
                "Documento do apresentante",
                q.data.presenter.document || "Não informado",
              ],
              ["Contato", q.data.presenter.contact || "Não informado"],
              ["Protocolo", q.data.protocol || "Não informado"],
              ["Apresentado em", isoDate(q.data.receivedOn)],
              ["Ato pedido", actName(q.data)],
              ["Título apresentado", q.data.document],
              ...(q.data.object ? [["Objeto", q.data.object]] : []),
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-foreground [overflow-wrap:anywhere]">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {notes.length > 0 && (
          <section className="rounded-xl border bg-card p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-foreground">
              Notas emitidas
            </h2>
            <ul className="mt-3 flex flex-col divide-y">
              {notes.map((n) => {
                const label =
                  n.kind === "positiva"
                    ? `Qualificação positiva nº ${n.number}`
                    : `Nota devolutiva nº ${n.number}`;
                return (
                  <li key={n.id} className="flex flex-col gap-2 py-3 text-sm">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {label}
                        {n.snapshot.rounds[n.roundIndex] &&
                        (n.snapshot.rounds[n.roundIndex]?.n ?? 1) > 1
                          ? ` (reexame)`
                          : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {isoDate(n.issuedOn)}
                        {n.signer.name ? ` · ${n.signer.name}` : ""}
                      </span>
                    </div>
                    {n.removedAt ? (
                      <p className="text-xs text-muted-foreground">
                        Excluída em {formatOfficeDateTime(n.removedAt)}
                        {n.removedReason ? `: ${n.removedReason}` : ""}. O
                        número não é usado de novo.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <SignOrPrint
                          pdfHref={`${BASE}/notas/${n.id}/arquivo`}
                          title={label}
                        />
                        <a
                          href={`${BASE}/notas/${n.id}/word`}
                          className={buttonVariants({ variant: "outline" })}
                        >
                          Word (.docx)
                        </a>
                        {active && (
                          <>
                            <RenumberNoteButton
                              id={n.id}
                              qualificationId={q.id}
                              sequence={n.sequence}
                            />
                            {n.roundIndex === q.data.rounds.length - 1 && (
                              <RemoveNoteButton id={n.id} />
                            )}
                          </>
                        )}
                      </div>
                    )}
                    {validations.has(n.id) && (
                      <NoteValidation
                        noteId={n.id}
                        canValidate={canValidate}
                        validatedLabel={(() => {
                          const at = validations.get(n.id);
                          return at ? `em ${formatOfficeDateTime(at)}` : null;
                        })()}
                      />
                    )}
                    {!n.removedAt &&
                      n.kind === "devolutiva" &&
                      linkedRequest?.kind === "service-request" &&
                      isOpenStatus("service-request", linkedRequest.status) && (
                        <SendNoteForm
                          noteId={n.id}
                          protocol={linkedRequest.protocolNumber}
                          requestHref={`/admin/pedidos/${encodeURIComponent(linkedRequest.protocolNumber)}`}
                          certificates={certificates.map((c) => ({
                            id: c.id,
                            label: `${c.label || c.holderName} (até ${isoDate(toIsoDate(c.notAfter, OFFICE_TIME_ZONE))})`,
                          }))}
                          signHref={signHref(
                            `${BASE}/notas/${n.id}/arquivo`,
                            `Nota devolutiva nº ${n.number}`,
                          )}
                          initialText={requirementTextFromNote({
                            number: n.number,
                            data: n.snapshot,
                            roundIndex: n.roundIndex,
                          })}
                        />
                      )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {active && round.result === "exigencia" && (
          <ReexamForm id={q.id} today={now} />
        )}
        {active && round.result === "positiva" && (
          <p className="rounded-xl border bg-card px-5 py-4 text-sm text-foreground">
            Título qualificado positivamente: pode seguir para a prática do ato.
          </p>
        )}
        {active && round.result === "aberta" && (
          <>
            <AiProposeForm
              id={q.id}
              blocked={aiBlocked}
              protocol={q.data.protocol}
              clientDocuments={clientDocs.map((d) => d.displayName)}
            />
            <RoundEditor
              id={q.id}
              initial={q.data}
              library={library.map((l) => ({
                id: l.id,
                acts: l.acts,
                title: l.title,
                description: l.description,
                howToComply: l.howToComply,
                basis: l.basis,
              }))}
            />
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-6 shadow-xs">
              <h2 className="text-lg font-semibold text-foreground">Emitir</h2>
              <p className="text-sm text-muted-foreground text-justify hyphens-auto">
                Salve as exigências antes de emitir. A nota sai numerada, no
                padrão da serventia, para assinar digitalmente ou imprimir.
              </p>
              <div className="grid gap-3 lg:grid-cols-2">
                <IssueForm
                  id={q.id}
                  kind="devolutiva"
                  today={now}
                  problems={noteProblems(round)}
                  signer={signer}
                />
                <IssueForm
                  id={q.id}
                  kind="positiva"
                  today={now}
                  problems={positiveProblems(round)}
                  signer={signer}
                />
              </div>
            </section>
          </>
        )}
        {active && (
          <div>
            <MarkQualificationButton id={q.id} />
          </div>
        )}
      </main>
    </>
  );
}
