import type { CohortState } from "@/core/cohorts/cohort.ts";
import { Badge } from "../../../../../_ui/badge.tsx";

// Solid where the state asks for attention (open, full); the closed ones
// recede. The label always says the state, so it never rests on colour.
const TONE: Record<CohortState, string> = {
  open: "bg-success text-success-foreground",
  full: "bg-warning text-warning-foreground",
  expired: "bg-muted text-muted-foreground",
  closed: "bg-muted text-muted-foreground",
};

export function CohortStateBadge({
  state,
  label,
}: {
  state: CohortState;
  label: string;
}) {
  return <Badge className={TONE[state]}>{label}</Badge>;
}
