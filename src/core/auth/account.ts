import { z } from "zod";
import { PANEL_ROLES } from "./roles.ts";

/**
 * What the registrador may set when creating an account: name, e-mail and
 * role: nothing else, and never a password. Whoever the invite reaches
 * chooses their own password later, at `/admin/redefinir-senha`.
 */
// Trimming and lowercasing the e-mail happens where the raw form value is
// read, not here: chaining `.trim()` after `z.email()` would run the format
// check before the trim, the opposite of what a pasted address with
// trailing whitespace needs. See createUser in usuarios/actions.ts.
export const CreateAccountSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome."),
  email: z.email("Informe um e-mail válido."),
  role: z.enum(PANEL_ROLES, "Escolha um papel."),
});
export type CreateAccountInput = z.infer<typeof CreateAccountSchema>;

/**
 * What the registrador may change on an account that already exists. Same
 * three fields as creating one, and never a password: the e-mail is
 * accepted here, but it does not become the login until the link sent to it
 * is opened (see updateAccount in usuarios/actions.ts).
 */
export const UpdateAccountSchema = CreateAccountSchema;
export type UpdateAccountInput = z.infer<typeof UpdateAccountSchema>;
