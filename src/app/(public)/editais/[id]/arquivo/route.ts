// Older links (and the ones already shared) still answer: the file now lives
// at /publicacoes/[id]/arquivo, which serves every kind, notices included.
// `runtime` stays declared here: Next reads segment config statically and
// does not follow a re-export.
export const runtime = "nodejs";
export { GET } from "../../../publicacoes/[id]/arquivo/route.ts";
