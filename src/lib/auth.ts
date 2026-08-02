import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
// Relative imports, not the "@/" alias: the seed script runs this module
// under plain node, which does not read tsconfig paths.
import { isRegisteredHost, normalizeHost } from "../core/tenant/resolve.ts";
import * as authSchema from "../db/auth-schema.ts";
import { db } from "../db/index.ts";

// A missing secret has to stop the process, not quietly fall back to a
// default that every install of the library shares.
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  throw new Error(
    "BETTER_AUTH_SECRET nao esta definida. Gere com: openssl rand -base64 32",
  );
}

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema: authSchema }),
  secret,
  baseURL: process.env.BETTER_AUTH_URL,
  // Every office answers on its own domain, so a single trusted origin taken
  // from BETTER_AUTH_URL would break the login on every other one.
  //
  // Two origins are accepted. First, the one that matches the host actually
  // being served: a cross site form carries the attacker's origin and our
  // host, so it never matches, which is the whole point of the check. That
  // arm is what makes the deploy domain and every preview URL work without
  // being declared anywhere. Second, any registered office host, which keeps
  // a request that reaches us through one office domain valid.
  trustedOrigins: (request) => {
    const origin = request?.headers.get("origin");
    if (!origin) return [];
    try {
      const originHost = normalizeHost(new URL(origin).hostname);
      const servedHost = normalizeHost(
        request?.headers.get("host") ?? undefined,
      );
      if (originHost !== "" && originHost === servedHost) return [origin];
      return isRegisteredHost(originHost) ? [origin] : [];
    } catch {
      return [];
    }
  },
  emailAndPassword: {
    enabled: true,
    // No public sign up: panel users are created by seed or internal invite.
    // The endpoint stays disabled rather than merely unlinked, because an
    // unlinked endpoint is still an endpoint.
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      // Declared here only so the session carries it. What the role may do
      // is decided in src/core/auth/roles.ts, never by the library.
      role: { type: "string", input: false, defaultValue: "staff" },
    },
  },
  session: {
    // Sessions live in the database. Revoking a row has to take effect on the
    // next request, so nothing may be cached in the cookie itself.
    expiresIn: 60 * 60 * 8,
    updateAge: 60 * 60,
  },
  advanced: {
    cookies: {
      session_token: {
        attributes: {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
        },
      },
    },
  },
  plugins: [nextCookies()],
});
