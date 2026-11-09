// Where a learner stands in the cohort's course, from what the course
// already records: videos watched, the assessment's attempts and the
// certificate. Nothing is copied into the cohort; this only reads.

export type LearnerStatus =
  | "certified"
  | "passed"
  | "in-attempt"
  | "failed"
  | "not-taken";

export const LEARNER_STATUS_LABELS: Record<LearnerStatus, string> = {
  certified: "Certificado emitido",
  passed: "Aprovado, sem certificado",
  "in-attempt": "Fazendo a avaliação",
  failed: "Reprovou",
  "not-taken": "Não fez a avaliação",
};

export interface LearnerFacts {
  certified: boolean;
  /** A submitted attempt passed. */
  passed: boolean;
  /** An attempt is open right now. */
  attemptOpen: boolean;
  /** At least one attempt was submitted. */
  submitted: boolean;
}

/**
 * The furthest point reached. A certificate needs a pass, and a pass ends
 * the attempts, so the order is also the order in time; a learner who
 * failed and opened a new attempt is "in the assessment" again.
 */
export function learnerStatus(facts: LearnerFacts): LearnerStatus {
  if (facts.certified) return "certified";
  if (facts.passed) return "passed";
  if (facts.attemptOpen) return "in-attempt";
  if (facts.submitted) return "failed";
  return "not-taken";
}
