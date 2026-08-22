"use server";

import { cookies, headers } from "next/headers";
import type { Seal } from "@/core/seal/parse.ts";
import { isSectionEnabled } from "@/core/tenant/gating.ts";
import { isSealRateLimited } from "@/lib/rate-limit.ts";
import { getTenant } from "@/lib/tenant.ts";
import { submitLookup } from "@/lib/tj-seal.ts";
import { SEAL_SESSION_COOKIE } from "./session.ts";

export type SealLookupState =
  | { status: "idle" }
  | { status: "seals"; codes: string; seals: Seal[] }
  /** What the TJ itself answered: wrong captcha, seal not found. */
  | { status: "message"; codes: string; message: string }
  /** Our side could not get an answer worth showing. */
  | { status: "unavailable"; codes: string }
  | { status: "error"; codes: string; message: string };

const EXPIRED =
  "O código da imagem expirou. Gere um novo código e tente de novo.";
const THROTTLED =
  "Muitas consultas seguidas. Aguarde um minuto e tente de novo.";

export async function lookupSeal(
  _previous: SealLookupState,
  form: FormData,
): Promise<SealLookupState> {
  const tenant = await getTenant();
  // Hiding the page is presentation; this is the control.
  if (!isSectionEnabled(tenant, "selo-tjrn")) {
    return { status: "error", codes: "", message: EXPIRED };
  }

  // Kept across every outcome below: retyping a seal code because the
  // captcha was misread is the fastest way to make someone give up.
  const codes = String(form.get("codigo") ?? "").trim();
  const captcha = String(form.get("captcha") ?? "").trim();

  if (!codes) {
    return {
      status: "error",
      codes,
      message: "Informe o código do selo digital.",
    };
  }
  if (!captcha) {
    return { status: "error", codes, message: "Digite o texto da imagem." };
  }

  if (await isSealRateLimited(await headers())) {
    return { status: "error", codes, message: THROTTLED };
  }

  const session = (await cookies()).get(SEAL_SESSION_COOKIE)?.value;
  if (!session) return { status: "error", codes, message: EXPIRED };

  const result = await submitLookup(session, codes, captcha);
  switch (result.kind) {
    case "seals":
      return { status: "seals", codes, seals: result.seals };
    case "message":
      return { status: "message", codes, message: result.text };
    default:
      // Both "the TJ did not answer" and "the TJ answered something we no
      // longer recognise" end here: with no answer we can vouch for, the
      // page sends the citizen to the TJ's own lookup.
      return { status: "unavailable", codes };
  }
}
