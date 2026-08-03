import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { signOut } from "../actions.ts";

// No style on purpose. This is the protected skeleton, not the panel.
// The check runs on every request and hits the database, so a session
// revoked there is gone on the next navigation.
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // getSession already refuses a session from another office, so what is
  // left here is the role. Both conditions still have to hold, and they stay
  // separate: an admin is an admin of their own office, never of the one
  // whose domain they happened to open.
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "admin.access")) {
    redirect("/admin/login");
  }

  const tenant = await getTenant();

  return (
    <section>
      <p>
        {session.user.email} ({session.user.role}) {tenant.name}
      </p>
      <form action={signOut}>
        <button type="submit">Sair</button>
      </form>
      {children}
    </section>
  );
}
