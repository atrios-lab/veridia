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
import { Button } from "../../../../../_ui/button.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../../../_ui/table.tsx";
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
  if (
    !session ||
    !can(session.user.role ?? "", "cohorts.manage", session.user.permissions)
  )
    notFound();
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
      <main className="grid grid-cols-1 gap-4.5 px-4 py-6 md:px-8 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
        <div className="flex min-w-0 flex-col gap-4.5">
          <section className="rounded-xl border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">
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
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-xs text-muted-foreground">Vagas usadas</dt>
                <dd className="font-semibold text-foreground tabular-nums">
                  {detail.members} de {cohort.seats}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Concluíram</dt>
                <dd className="font-semibold text-foreground tabular-nums">
                  {detail.certified}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Link vale até</dt>
                <dd className="font-semibold text-foreground">
                  {formatDate(lastValidDay(cohort.expiresAt))}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Criada em</dt>
                <dd className="font-semibold text-foreground">
                  {formatOfficeDate(cohort.createdAt)}
                </dd>
              </div>
            </dl>
            <form action={toggle} className="mt-4">
              <Button type="submit" variant="outline" size="sm">
                {closed ? "Reabrir inscrições" : "Encerrar inscrições"}
              </Button>
              <span className="ml-3 text-xs text-muted-foreground">
                {closed
                  ? "Reaberto, o link volta a aceitar cadastro se estiver no prazo e com vagas."
                  : "Quem já tem conta continua entrando; o link só para de aceitar cadastro."}
              </span>
            </form>
          </section>

          <section className="rounded-xl border bg-card">
            <div className="border-b px-5 py-3.5 text-lg font-semibold text-foreground">
              Alunos
            </div>
            {detail.learners.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted-foreground">
                Ninguém se inscreveu ainda.
              </p>
            ) : (
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead
                      scope="col"
                      className="px-5 text-xs text-muted-foreground"
                    >
                      Aluno
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="px-3 text-xs text-muted-foreground"
                    >
                      Entrou em
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="px-3 text-xs text-muted-foreground"
                    >
                      Aulas
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="px-3 text-xs text-muted-foreground"
                    >
                      Avaliação
                    </TableHead>
                    <TableHead
                      scope="col"
                      className="px-5 text-xs text-muted-foreground"
                    >
                      Contato
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.learners.map((learner) => (
                    <TableRow key={learner.userId}>
                      <TableCell className="px-5 py-3">
                        <p className="font-semibold text-foreground">
                          {learner.name}
                        </p>
                        <p className="text-muted-foreground">{learner.email}</p>
                      </TableCell>
                      <TableCell className="px-3 py-3 text-muted-foreground tabular-nums">
                        {formatOfficeDate(learner.joinedAt)}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-foreground tabular-nums">
                        {learner.watched} de {detail.videoCount}
                      </TableCell>
                      <TableCell className="px-3 py-3 text-foreground">
                        {LEARNER_STATUS_LABELS[learner.status]}
                      </TableCell>
                      <TableCell className="px-5 py-3 text-muted-foreground">
                        {learner.contactConsentAt
                          ? `Aceitou em ${formatOfficeDate(learner.contactConsentAt)}`
                          : "Não aceitou"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </div>

        <section className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
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
