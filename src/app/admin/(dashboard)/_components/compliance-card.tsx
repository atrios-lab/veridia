import Link from "next/link";
import { progress, resumeSection } from "@/core/compliance/answers.ts";
import { formatDate, toIsoDate } from "@/core/scheduling/calendar.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { loadIntake } from "@/lib/compliance.ts";
import { OFFICE_TIME_ZONE } from "@/lib/tenant.ts";

/**
 * The Visão geral card for the Provimento intake. Same mould as "Continuar
 * de onde parou": eyebrow, the figure, a line, a small button. Once the
 * office has sent its answers the count gives way to the date.
 */
export async function ComplianceCard({ tenant }: { tenant: Tenant }) {
  const { intake, answers } = await loadIntake(tenant);

  if (intake.submittedAt) {
    return (
      <div className="rounded-[14px] border border-admin-border bg-admin-card p-5">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint">
          Adequação ao Provimento
        </span>
        <p className="mt-2.5 text-[13px] font-semibold text-admin-success-text">
          Informações enviadas à Átrios
        </p>
        <p className="mt-0.5 text-[12px] text-admin-muted">
          em {formatDate(toIsoDate(intake.submittedAt, OFFICE_TIME_ZONE))}. As
          respostas continuam abertas para correção.
        </p>
        <Link
          href="/admin/adequacao"
          className="btn btn-admin-secondary btn-sm mt-3"
        >
          Ver respostas
        </Link>
      </div>
    );
  }

  const state = progress(answers, intake.sectionUpdatedAt);
  const resume = resumeSection(state, intake.sectionUpdatedAt);
  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card p-5">
      <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-admin-faint">
        Adequação ao Provimento
      </span>
      <p className="mt-2.5 text-[13px] text-admin-text">
        <span className="font-serif text-[24px] font-semibold tabular-nums text-admin-primary">
          {state.complete}
        </span>{" "}
        <span className="font-semibold text-admin-muted">
          de {state.total} seções respondidas
        </span>
      </p>
      <div
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-admin-readonly-bg"
        role="progressbar"
        aria-valuenow={state.complete}
        aria-valuemin={0}
        aria-valuemax={state.total}
        aria-label={`${state.complete} de ${state.total} seções respondidas`}
      >
        <span
          className="block h-full rounded-full bg-admin-primary-soft"
          style={{ width: `${(state.complete / state.total) * 100}%` }}
        />
      </div>
      <p className="mt-2 text-[12px] text-admin-muted">
        {state.ready
          ? "Tudo respondido. Falta revisar e enviar."
          : `Próxima: Seção ${resume.number} · ${resume.title}`}
      </p>
      <Link
        href={
          state.ready
            ? "/admin/adequacao/revisao"
            : `/admin/adequacao/${resume.id}`
        }
        className="btn btn-admin-primary btn-sm mt-3"
      >
        {state.ready
          ? "Revisar e enviar"
          : state.complete === 0
            ? "Começar"
            : "Continuar de onde parei"}
      </Link>
    </div>
  );
}
