import "server-only";
import { after } from "next/server";
import { indexNowPayload } from "./indexnow.ts";

/**
 * Tells the IndexNow-participating engines (Bing, Yandex, Naver; not
 * Google, which does not read it) that a page changed, instead of leaving
 * them to notice on their own next crawl.
 *
 * Runs after the response, the same way the office's own e-mail
 * notifications do (see `src/lib/email/service-request.ts`): a citizen
 * publishing a notice or a document must never wait on, or fail because of,
 * a third party neither of them chose. Best effort throughout, including
 * around `after` itself: every call site here is a Server Action, which
 * always has a request to attach to, but this must not be the thing that
 * breaks a citizen's publish if it is ever called from somewhere that has
 * none.
 */
export function notifyIndexNow(origin: string, paths: string[]): void {
  try {
    after(async () => {
      try {
        const response = await fetch("https://api.indexnow.org/indexnow", {
          method: "POST",
          headers: { "content-type": "application/json; charset=utf-8" },
          body: JSON.stringify(indexNowPayload(origin, paths)),
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) {
          console.error("indexnow.notify", response.status);
        }
      } catch (error) {
        console.error("indexnow.notify", error);
      }
    });
  } catch (error) {
    console.error("indexnow.notify", error);
  }
}
