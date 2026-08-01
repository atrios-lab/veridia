import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth.ts";
import { isRateLimited } from "@/lib/rate-limit.ts";

const handlers = toNextJsHandler(auth);

export const GET = handlers.GET;

// Only the write side is limited: reading the session happens on every admin
// navigation and limiting it would lock out a working user.
export async function POST(request: Request) {
  if (await isRateLimited(request.headers)) {
    return new Response("Muitas tentativas. Tente novamente em instantes.", {
      status: 429,
    });
  }
  return handlers.POST(request);
}
