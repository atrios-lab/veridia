// The cohort screens' addresses, shared by the pages and the actions (a
// "use server" module may export async functions only).
export const COHORTS_PATH = "/admin/ajuda/gerenciar/turmas";

export function cohortPath(id: string): string {
  return `${COHORTS_PATH}/${id}`;
}
