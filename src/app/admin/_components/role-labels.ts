import type { Role } from "@/core/auth/roles.ts";

// Portuguese display names for a role. The role itself ("admin"/"staff")
// stays in src/core/auth/roles.ts, which grants permissions and does not
// speak Portuguese: this is presentation only, shared by the sidebar
// footer and the Usuários screen so the two never name the same role
// differently.
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Registrador",
  staff: "Operador",
  superadmin: "Átrios",
};
