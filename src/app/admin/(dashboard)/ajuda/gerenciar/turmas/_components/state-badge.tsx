import type { CohortState } from "@/core/cohorts/cohort.ts";

const TONE: Record<CohortState, string> = {
  open: "bg-admin-success-bg text-admin-success-text",
  full: "bg-admin-warning-bg text-admin-warning-text",
  expired: "bg-admin-surface text-admin-muted",
  closed: "bg-admin-surface text-admin-muted",
};

export function CohortStateBadge({
  state,
  label,
}: {
  state: CohortState;
  label: string;
}) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${TONE[state]}`}
    >
      {label}
    </span>
  );
}
