import Link from "next/link";
import { progress, resumeSection } from "@/core/compliance/answers.ts";
import { formatDate, toIsoDate } from "@/core/scheduling/calendar.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { loadIntake } from "@/lib/compliance.ts";
import { OFFICE_TIME_ZONE } from "@/lib/tenant.ts";
import { buttonVariants } from "../../_ui/button.tsx";
import { cn } from "../../_ui/cn.ts";
import { Progress } from "../../_ui/progress.tsx";

/**
 * The Visão geral card for the Provimento intake. Same mould as "Continuar
 * de onde parou": title, the figure, a line, a small button. Once the
 * office has sent its answers the count gives way to the date.
 *
 * A card that cannot load renders nothing rather than throwing: the Visão
 * geral is the whole panel's front door, and a secondary card must never be
 * the reason it fails to open. Same posture as `livePublications` on the
 * public home. This is exactly what took the panel down on 06/09/2026: the
 * deploy shipped before the migration reached production, and the missing
 * table turned every office's home screen into a 500.
 */
export async function ComplianceCard({ tenant }: { tenant: Tenant }) {
  let loaded: Awaited<ReturnType<typeof loadIntake>>;
  try {
    loaded = await loadIntake(tenant);
  } catch (error) {
    console.error("compliance-card.load", error);
    return null;
  }
  const { intake, answers } = loaded;

  if (intake.submittedAt) {
    return (
      <section className="rounded-xl border bg-card p-6 shadow-xs">
        <h2 className="text-base font-semibold text-foreground">
          Adequação ao Provimento
        </h2>
        <p className="mt-3 text-sm font-semibold text-success-text">
          Informações enviadas à Átrios
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          em {formatDate(toIsoDate(intake.submittedAt, OFFICE_TIME_ZONE))}. As
          respostas continuam abertas para correção.
        </p>
        <Link
          href="/admin/adequacao"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "mt-4",
          )}
        >
          Ver respostas
        </Link>
      </section>
    );
  }

  const state = progress(answers, intake.sectionUpdatedAt);
  const resume = resumeSection(state, intake.sectionUpdatedAt);
  return (
    <section className="rounded-xl border bg-card p-6 shadow-xs">
      <h2 className="text-base font-semibold text-foreground">
        Adequação ao Provimento
      </h2>
      <p className="mt-3 text-sm text-foreground">
        <span className="text-2xl font-semibold text-foreground tabular-nums">
          {state.complete}
        </span>{" "}
        <span className="font-medium text-muted-foreground">
          de {state.total} seções respondidas
        </span>
      </p>
      <Progress
        className="mt-3"
        value={state.complete}
        max={state.total}
        aria-label={`${state.complete} de ${state.total} seções respondidas`}
      />
      <p className="mt-2 text-sm text-muted-foreground">
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
        className={cn(buttonVariants({ size: "sm" }), "mt-4")}
      >
        {state.ready
          ? "Revisar e enviar"
          : state.complete === 0
            ? "Começar"
            : "Continuar de onde parei"}
      </Link>
    </section>
  );
}
