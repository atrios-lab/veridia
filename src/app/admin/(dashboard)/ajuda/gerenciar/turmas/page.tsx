import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { COHORT_STATE_LABELS, lastValidDay } from "@/core/cohorts/cohort.ts";
import { formatDate } from "@/core/scheduling/calendar.ts";
import { coursesOrigin } from "@/core/tenant/courses-tenant.ts";
import { resolveOrigin } from "@/lib/auth-tokens.ts";
import { certificateCourses, listCohorts } from "@/lib/cohorts.ts";
import { getSession } from "@/lib/session.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { CohortCreateForm } from "./_components/cohort-create-form.tsx";
import { CopyLink } from "./_components/copy-link.tsx";
import { CohortStateBadge } from "./_components/state-badge.tsx";
import { cohortPath } from "./paths.ts";

export const metadata = { title: "Turmas" };

/**
 * The course cohorts: one link per office that is not a client yet. The
 * platform's screen, gated like Gerenciar vídeos by the permission alone:
 * anyone else gets the same 404 as an address that does not exist.
 */
export default async function CohortsPage() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "cohorts.manage")) notFound();

  const [cohorts, courses] = await Promise.all([
    listCohorts(),
    certificateCourses(),
  ]);
  const origin = coursesOrigin(resolveOrigin(await headers()));

  return (
    <>
      <AdminPageHeader
        title="Turmas"
        back={{ href: "/admin/ajuda/gerenciar", label: "Gerenciar vídeos" }}
        description="Links de inscrição para cartórios que ainda não são clientes. Cada funcionário cria a própria conta e emite o certificado com o nome do cartório da turma."
      />
      <main className="grid grid-cols-1 gap-4.5 px-[30px] py-7 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
        <div className="min-w-0 rounded-2xl border border-admin-border bg-admin-card">
          <div className="border-b border-admin-border px-5 py-3.5 font-serif text-base font-semibold text-admin-primary">
            {cohorts.length === 0
              ? "Nenhuma turma ainda"
              : `${cohorts.length} ${cohorts.length === 1 ? "turma" : "turmas"}`}
          </div>
          {cohorts.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-admin-muted">
              Crie a primeira turma ao lado. O link aparece aqui para copiar e
              mandar ao responsável do cartório.
            </p>
          ) : (
            <ul className="flex flex-col divide-y divide-admin-border">
              {cohorts.map(
                ({ cohort, courseTitle, members, certified, state }) => (
                  <li
                    key={cohort.id}
                    className="flex flex-col gap-2 px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-4"
                  >
                    <div className="min-w-0">
                      <Link
                        href={cohortPath(cohort.id)}
                        className="block truncate text-[14px] font-semibold text-admin-primary hover:underline"
                      >
                        {cohort.officeName}
                      </Link>
                      <p className="truncate text-[12px] text-admin-muted">
                        {cohort.officeCity} · {courseTitle} ·{" "}
                        <span className="font-mono">{cohort.code}</span>
                      </p>
                      <p className="mt-0.5 text-[12px] text-admin-faint">
                        Link vale até{" "}
                        {formatDate(lastValidDay(cohort.expiresAt))}
                      </p>
                      <div className="mt-2 max-w-[440px]">
                        <CopyLink url={`${origin}/turma/${cohort.code}`} />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-admin-muted">
                      <span className="tabular-nums">
                        <strong className="text-admin-text">
                          {members}/{cohort.seats}
                        </strong>{" "}
                        vagas
                      </span>
                      <span className="tabular-nums">
                        <strong className="text-admin-text">{certified}</strong>{" "}
                        {certified === 1 ? "concluiu" : "concluíram"}
                      </span>
                      <CohortStateBadge
                        state={state}
                        label={COHORT_STATE_LABELS[state]}
                      />
                    </div>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>

        <CohortCreateForm courses={courses} />
      </main>
    </>
  );
}
