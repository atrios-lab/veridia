import { createHmac } from "node:crypto";

/**
 * The key of the shareable proof of protocol's seal
 * (core/request/protocol-proof.ts), derived from BETTER_AUTH_SECRET like
 * `pdfLinkKey`, with its own purpose label. The placeholder keeps the tests
 * loading with no secret; auth.ts refuses to start without a real one.
 */
const secret =
  process.env.BETTER_AUTH_SECRET || "test-sem-valor-nenhum-fora-deste-processo";

export const proofLinkKey: Buffer = createHmac("sha256", secret)
  .update("veridia:protocol-proof")
  .digest();
