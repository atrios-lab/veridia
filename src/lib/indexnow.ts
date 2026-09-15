/**
 * This deployment's IndexNow verification key: one value, shared by every
 * office's domain, each of them serving it at "/<key>.txt" (see the route
 * next to this file's sibling `src/app/<key>.txt/route.ts`). IndexNow
 * verifies a submission by fetching that file back from the same host the
 * submitted URL belongs to, so the key carries no secret of its own: it
 * only has to be hard to guess and served consistently, which one shared
 * constant already is.
 *
 * https://www.indexnow.org/documentation
 *
 * No `"next/server"` import here on purpose, unlike `./notify-indexnow.ts`,
 * which wraps this in the actual submission: the project's plain
 * `node --test` runner cannot resolve that bare specifier, so nothing that
 * imports it can be unit tested directly (`src/lib/email/service-request.ts`
 * has the same shape, for the same reason). Keeping the pure pieces here
 * lets this file be tested on its own.
 */
export const INDEXNOW_KEY = "6a79777e3c15a3f2b5fe80b4daeaa9cf";

/** The literal path IndexNow expects the key file at. */
export const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;

/** The body IndexNow's bulk endpoint expects. */
export function indexNowPayload(
  origin: string,
  paths: string[],
): { host: string; key: string; keyLocation: string; urlList: string[] } {
  return {
    host: new URL(origin).host,
    key: INDEXNOW_KEY,
    keyLocation: `${origin}${INDEXNOW_KEY_PATH}`,
    urlList: paths.map((path) => `${origin}${path}`),
  };
}
