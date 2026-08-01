import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

const LOGIN_PATH = "/admin/login";

// Cheap gate only: it checks that a session cookie exists, so an anonymous
// visitor is redirected without a database round trip. It is not the
// authorization check. The admin layout revalidates the session against the
// database on every request, which is what makes revocation immediate.
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === LOGIN_PATH) return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();

  const login = new URL(LOGIN_PATH, request.url);
  login.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/admin/:path*"],
};
