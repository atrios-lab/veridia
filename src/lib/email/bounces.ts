import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/index.ts";
import { emailBounces } from "@/db/schema.ts";

/**
 * Thrown instead of sending, when the address already told us it does not
 * take mail. Its own class and not a string: the actions that catch a send
 * failure have to tell "essa caixa não existe" from "o provedor está fora do
 * ar", because only one of them is worth trying again.
 */
export class AddressDoesNotReceiveError extends Error {
  readonly email: string;
  /** What the receiving server said when the message came back. */
  readonly detail: string;

  constructor(email: string, detail: string) {
    super(`O endereço ${email} não recebe: ${detail || "a mensagem voltou"}`);
    this.name = "AddressDoesNotReceiveError";
    this.email = email;
    this.detail = detail;
  }
}

/**
 * The permanent bounce on record for an address, or null. A primary-key
 * lookup per message: cheap, and the alternative is a cache with an
 * invalidation story, which only pays for itself at a volume this platform
 * does not have.
 */
export async function findPermanentBounce(email: string) {
  const [row] = await db
    .select({ detail: emailBounces.detail, permanent: emailBounces.permanent })
    .from(emailBounces)
    .where(eq(emailBounces.email, email.trim().toLowerCase()));
  return row?.permanent ? row : null;
}
