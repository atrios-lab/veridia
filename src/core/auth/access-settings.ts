import { z } from "zod";

/**
 * The panel's two-step access, per person of the office (decision of
 * 10/11/2026): the e-mail the code goes to, when the administrator set one
 * other than the account's own, and the "epoch" of the saved computers,
 * which the administrator bumps to make every saved computer of that person
 * ask for the code again.
 */
export const UserAccessSchema = z.object({
  email: z.email().optional(),
  epoch: z.number().int().min(0).optional(),
});
export type UserAccess = z.infer<typeof UserAccessSchema>;

export type OfficeAccess = Record<string, UserAccess>;

/** What is stored, read leniently: a malformed entry is left out. */
export function parseOfficeAccess(raw: unknown): OfficeAccess {
  const result: OfficeAccess = {};
  const users =
    raw && typeof raw === "object"
      ? ((raw as { users?: unknown }).users ?? {})
      : {};
  if (!users || typeof users !== "object") return result;
  for (const [userId, value] of Object.entries(users)) {
    const parsed = UserAccessSchema.safeParse(value);
    if (parsed.success) result[userId] = parsed.data;
  }
  return result;
}

/** Where this person's code goes. */
export function codeEmailFor(
  access: OfficeAccess,
  userId: string,
  accountEmail: string,
): string {
  return access[userId]?.email ?? accountEmail;
}

/** The current epoch of this person's saved computers. */
export function deviceEpochOf(access: OfficeAccess, userId: string): number {
  return access[userId]?.epoch ?? 0;
}

/**
 * Who goes through the e-mail code: every office account. The Átrios
 * platform account (superadmin) is the master administrator and does not.
 */
export function needsAccessCode(role: string): boolean {
  return role !== "superadmin";
}
