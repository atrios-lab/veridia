import { createHmac } from "node:crypto";

/**
 * The key `signPdfLink` and `verifyPdfLink` use, derived once per process.
 *
 * Derived from BETTER_AUTH_SECRET rather than read from a variable of its
 * own: every environment already has that one (auth.ts refuses to start
 * without it), and a second variable is one more thing to set by hand in
 * production and in Preview, the kind of step that goes missing on a deploy
 * and only shows up as a citizen who cannot open a PDF.
 *
 * Derived, not reused as-is: the purpose label means a leaked link token
 * says nothing about sessions and a leaked session secret is not directly a
 * link-signing key. Rotating the auth secret rotates this one with it, and
 * every outstanding link dies, which for a one-hour link is nothing lost.
 */
// The placeholder keeps `pnpm test` working with no `.env` and no secret,
// same reasoning as the one in src/db/index.ts: a route handler that imports
// this file (even one this process never calls) must still load under
// `node --test`. `auth.ts` is what actually refuses to start without a real
// secret; by the time a request reaches this module in production, that
// refusal has already happened.
const secret =
  process.env.BETTER_AUTH_SECRET || "test-sem-valor-nenhum-fora-deste-processo";

export const pdfLinkKey: Buffer = createHmac("sha256", secret)
  .update("veridia:pdf-link")
  .digest();
