import "server-only";
import { anthropic } from "@ai-sdk/anthropic";
import { db } from "@/db/index.ts";
import { aiBlockedWith } from "../ai.ts";
import type { DpoModels } from "./assistant.ts";

/**
 * The DPO assistant's models: Claude, by Anthropic, with the same key and
 * the same switch as the rest of the platform's AI (lib/ai.ts): the
 * environment's ANTHROPIC_API_KEY, and the office's "Inteligência
 * artificial" turned on by the Tabelião/Registrador in Configurações. A
 * small fast model sorts what is on topic; a stronger one answers.
 */
const TRIAGE_MODEL = "claude-haiku-5-5";
const ANSWER_MODEL = "claude-sonnet-5-5";

export function dpoModels(): DpoModels {
  return {
    triage: anthropic(TRIAGE_MODEL),
    answer: anthropic(ANSWER_MODEL),
  };
}

/**
 * Why the assistant cannot answer in this office now, in the office's
 * words (no key in the environment, or the office's AI turned off); null
 * when it can.
 */
export function dpoBlocked(tenantSlug: string): Promise<string | null> {
  return aiBlockedWith(db, tenantSlug);
}
