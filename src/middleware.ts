import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { buildCsp } from "@/lib/csp.ts";

const LOGIN_PATH = "/admin/login";

// The panel routes a person reaches without a session, by definition: the
// login itself, the first-access invite (the whole point of the link is to
// get a first cookie, and the route decides valid vs. expired from the
// token) and the screen where someone locked out asks for a new link. Each
// one does its own checking; none of them can be behind the cookie gate
// below without becoming unreachable to exactly who needs it.
const UNAUTHENTICATED_PATHS = new Set([
  LOGIN_PATH,
  "/admin/redefinir-senha",
  "/admin/esqueci-senha",
  // A confirmação da troca de e-mail cai na mesma regra, e pelo mesmo
  // motivo: o link vai para o endereço novo, e quem precisa clicar é
  // justamente quem não consegue mais entrar pelo antigo. A tela decide
  // válido vs. expirado pelo token, sozinha.
  "/admin/confirmar-email",
]);

const isDev = process.env.NODE_ENV === "development";

/**
 * One CSP for the whole site, built per request so the script directive can
 * carry a fresh nonce.
 *
 * Next's App Router injects the RSC/hydration payload as inline `<script>`
 * tags it does not give an opt-out for (`self.__next_f.push(...)`). A CSP
 * with `script-src 'self'` and no `unsafe-inline` blocks exactly those tags,
 * which means no client component ever hydrates: no client-side validation,
 * no click handler, nothing but plain links and native form posts. That was
 * the CSP this file's `headers()` used to carry, before this became
 * middleware: the whole app "worked" in development only because dev mode
 * tolerates `unsafe-inline`, and broke silently the moment anything ran
 * against a production build.
 *
 * The fix is the nonce, not `unsafe-inline`: Next reads the nonce back out
 * of the `Content-Security-Policy` response header it receives and stamps
 * every script tag it emits with it, so only scripts the server actually
 * sent execute. `unsafe-inline` would have fixed hydration too, but it also
 * lets an attacker's injected `<script>` execute exactly like the app's own,
 * which is the one thing this CSP exists to stop.
 *
 * The one author-written `<script>` in this codebase is the JSON-LD block
 * in the public layout, and it needs no nonce: a data block is never
 * prepared as a script, so script-src never looks at it. The day an
 * executable one is added (analytics) it reads the nonce from
 * `headers().get("x-nonce")` and passes it as the `nonce` prop; Next does
 * not stamp author-written tags on its own.
 */
// Exact host only, never a wildcard: it names the one Vercel Blob store this
// deploy writes to (see next.config.ts and src/lib/uploads.ts). Undefined in
// an environment without Blob configured, and the directives that name it
// simply do not grow that source; they are assembled in src/lib/csp.ts.
const blobPublicHost = process.env.BLOB_PUBLIC_HOST;

// The pathname is forwarded as a header on every request: the dashboard
// layout has no other way to read it, and it needs it to send a revoked or
// expired session back to where it was, once the database check (which only
// it can make) fails. The nonce travels the same way, for the day a route
// needs to stamp a `<script>` of its own.
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({ nonce, isDev, blobPublicHost });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  requestHeaders.set("x-nonce", nonce);

  // Cheap gate only: it checks that a session cookie exists, so an
  // anonymous visitor is redirected without a database round trip. It is
  // not the authorization check. The admin layout revalidates the session
  // against the database on every request, which is what makes revocation
  // immediate. Scoped to /admin explicitly now that this file also carries
  // the CSP for the public site: without the guard every anonymous visit
  // to the public site would be redirected to the admin login.
  const guardsThisRoute =
    pathname.startsWith("/admin") && !UNAUTHENTICATED_PATHS.has(pathname);

  if (guardsThisRoute && !getSessionCookie(request)) {
    const login = new URL(LOGIN_PATH, request.url);
    login.searchParams.set("next", pathname);
    const response = NextResponse.redirect(login);
    response.headers.set("Content-Security-Policy", csp);
    return response;
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Every route needs the nonce, since every route can hydrate. Static
  // assets and the auth API's own JSON responses are excluded: they render
  // no script tag for a CSP to matter to, and skipping them is one fewer
  // trip through this function per asset a page loads.
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico).*)"],
};
