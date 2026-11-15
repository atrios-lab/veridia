import "server-only";
import type { DpoModels } from "./assistant.ts";

/**
 * The DPO assistant's models, through the Vercel AI Gateway (a plain
 * "provider/model" string resolves through it). A small fast model sorts
 * what is on topic; a stronger one answers. Changing either is this file.
 */
const TRIAGE_MODEL = "anthropic/claude-haiku-5.5";
const ANSWER_MODEL = "anthropic/claude-sonnet-5.5";

/**
 * On Vercel the Gateway authenticates by OIDC with no secret to set; locally
 * it needs AI_GATEWAY_API_KEY (or the OIDC token `vercel env pull` writes).
 * Without either, the screen says the assistant is unavailable here instead
 * of failing at the first question.
 */
export function isDpoAssistantConfigured(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY ||
      process.env.VERCEL_OIDC_TOKEN ||
      process.env.VERCEL === "1",
  );
}

export function dpoModels(tenantSlug: string): DpoModels {
  return {
    triage: TRIAGE_MODEL,
    answer: ANSWER_MODEL,
    providerOptions: {
      gateway: {
        // Only providers that keep nothing and train on nothing: the text
        // is masked already, and this is the second lock on the same door.
        zeroDataRetention: true,
        disallowPromptTraining: true,
        caching: "auto",
        tags: ["feature:dpo-assistant", `tenant:${tenantSlug}`],
      },
    },
  };
}
