import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { COHORT_STATE_LABELS, lastValidDay } from "@/core/cohorts/cohort.ts";
import { LEARNER_STATUS_LABELS } from "@/core/cohorts/progress.ts";
import { formatDate } from "@/core/scheduling/calendar.ts";
import { coursesOrigin } from "@/core/tenant/courses-tenant.ts";
import { formatOfficeDate } from "@/core/time/office-time.ts";
import { resolveOrigin } from "@/lib/auth-tokens.ts";
import { cohortDetail } from "@/lib/cohorts.ts";
import { getSession } from "@/lib/session.ts";
import { AdminPageHeader } from "../../../../../_components/page-header.tsx";
import { CohortEditForm } from "../_components/cohort-edit-form.tsx";
import { CopyLink } from "../_components/copy-link.tsx";
import { CohortStateBadge } from "../_components/state-badge.tsx";
import { setCohortClosedAction } from "../actions.ts";
import { COHORTS_PATH } from "../paths.ts";

export const metadata = { title: "Turma" };

type Params = Promise<{ id: string }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One cohort: its link, its settings and every learner's progress. */
export default async function CohortPage({ params }: { params: Params }) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "cohorts.manage")) notFound();
  const { id } = await params;
  // Not a uuid is an address that does not exist, not a database error.
  if (!UUID.test(id)) notFound();
  const detail = await cohortDetail(id);
  if (!detail) notFound();

  const { cohort } = detail;
  const url = `${coursesOrigin(resolveOrigin(await headers()))}/turma/${cohort.code}`;
  const closed = cohort.closedAt !== null;
  const toggle = setCohortClosedAction.bind(null, cohort.id, !closed);

  return (
    <>
      <AdminPageHeader
        title={cohort.officeName}
        back={{ href: COHORTS_PATH, label: "Turmas" }}
        description={`${cohort.officeCity} · ${detail.courseTitle} · responsável: ${cohort.contactName}, ${cohort.contactPhone}`}
      />
      <main className="grid grid-cols-1 gap-4.5 px-[30px] py-7 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4.5">
          <section className="rounded-2xl border border-admin-border bg-admin-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-serif text-base font-semibold text-admin-primary">
                Link de inscrição
              </h2>
              <CohortStateBadge
                state={detail.state}
                label={COHORT_STATE_LABELS[detail.state]}
              />
            </div>
            <div className="mt-3">
              <CopyLink url={url} />
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-[12.5px] sm:grid-cols-4">
              <div>
                <dt className="text-admin-faint">Vagas usadas</dt>
                <dd className="font-semibold text-admin-text tabular-nums">
                  {detail.members} de {cohort.seats}
                </dd>
              </div>
              <div>
                <dt className="text-admin-faint">Concluíram</dt>
                <dd className="font-semibold text-admin-text tabular-nums">
                  {detail.certified}
                </dd>
              </div>
              <div>
                <dt className="text-admin-faint">Link vale até</dt>
                <dd className="font-semibold text-admin-text">
                  {formatDate(lastValidDay(cohort.expiresAt))}
                </dd>
              </div>
              <div>
                <dt className="text-admin-faint">Criada em</dt>
                <dd className="font-semibold text-admin-text">
                  {formatOfficeDate(cohort.createdAt)}
                </dd>
              </div>
            </dl>
            <form action={toggle} className="mt-4">
              <button type="submit" className="btn btn-admin-secondary btn-sm">
                {closed ? "Reabrir inscrições" : "Encerrar inscrições"}
              </button>
              <span className="ml-3 text-[11.5px] text-admin-muted">
                {closed
                  ? "Reaberto, o link volta a aceitar cadastro se estiver no prazo e com vagas."
                  : "Quem já tem conta continua entrando; o link só para de aceitar cadastro."}
              </span>
            </form>
          </section>

          <section className="rounded-2xl border border-admin-border bg-admin-card">
            <div className="border-b border-admin-border px-5 py-3.5 font-serif text-base font-semibold text-admin-primary">
              Alunos
            </div>
            {detail.learners.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-admin-muted">
                Ninguém se inscreveu ainda.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-[12.5px]">
                  <thead className="text-[11px] font-bold uppercase tracking-[0.06em] text-admin-faint">
                    <tr className="border-b border-admin-border">
                      <th scope="col" className="px-5 py-2.5">
                        Aluno
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Entrou em
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Aulas
                      </th>
                      <th scope="col" className="px-3 py-2.5">
                        Avaliação
                      </th>
                      <th scope="col" className="px-5 py-2.5">
                        Contato
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-admin-border">
                    {detail.learners.map((learner) => (
                      <tr key={learner.userId}>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-admin-text">
                            {learner.name}
                          </p>
                          <p className="text-admin-faint">{learner.email}</p>
                        </td>
                        <td className="px-3 py-3 text-admin-muted">
                          {formatOfficeDate(learner.joinedAt)}
                        </td>
                        <td className="px-3 py-3 text-admin-text tabular-nums">
                          {learner.watched} de {detail.videoCount}
                        </td>
                        <td className="px-3 py-3 text-admin-text">
                          {LEARNER_STATUS_LABELS[learner.status]}
                        </td>
                        <td className="px-5 py-3 text-admin-muted">
                          {learner.contactConsentAt
                            ? `Aceitou em ${formatOfficeDate(learner.contactConsentAt)}`
                            : "Não aceitou"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <section className="rounded-2xl border border-admin-active-border bg-admin-card p-5.5">
          <h2 className="mb-4 font-serif text-base font-semibold text-admin-primary">
            Dados da turma
          </h2>
          <CohortEditForm
            cohortId={cohort.id}
            current={{
              officeName: cohort.officeName,
              officeCity: cohort.officeCity,
              contactName: cohort.contactName,
              contactPhone: cohort.contactPhone,
              seats: cohort.seats,
              lastDay: lastValidDay(cohort.expiresAt),
            }}
          />
        </section>
      </main>
    </>
  );
}
