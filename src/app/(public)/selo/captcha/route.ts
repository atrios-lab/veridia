import { cookies, headers } from "next/headers";
import { isSealRateLimited } from "@/lib/rate-limit.ts";
import { fetchCaptcha, openSession } from "@/lib/tj-seal.ts";
import { requireSection } from "../../_lib/section.ts";
import { SEAL_SESSION_COOKIE, SEAL_SESSION_MAX_AGE } from "../session.ts";

export const runtime = "nodejs";

/**
 * The TJ's captcha, issued to this citizen.
 *
 * Each call opens a session of its own on the TJ and hands the session back
 * in a cookie, so the answer the citizen types is checked against the image
 * they actually saw. "Gerar novo código" is simply this route again.
 */
export async function GET(): Promise<Response> {
  await requireSection("selo-tjrn");

  if (await isSealRateLimited(await headers())) {
    return new Response("Muitas tentativas seguidas.", { status: 429 });
  }

  const session = await openSession();
  const image = session ? await fetchCaptcha(session) : undefined;
  if (!session || !image) {
    // The page reads this as "the TJ is not answering" and offers its link.
    return new Response("O TJ não respondeu.", { status: 502 });
  }

  (await cookies()).set(SEAL_SESSION_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/selo",
    maxAge: SEAL_SESSION_MAX_AGE,
  });

  return new Response(image.body, {
    headers: {
      "Content-Type": image.contentType,
      // The image is bound to one session: a cached copy is a captcha that
      // answers to nothing, which is the failure this whole change had to
      // work around on the TJ's own side.
      "Cache-Control": "no-store",
    },
  });
}
