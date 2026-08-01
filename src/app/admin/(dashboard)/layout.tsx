import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { getSession } from "@/lib/session.ts";
import { signOut } from "../actions.ts";

// No style on purpose. This is the protected skeleton, not the panel.
// The check runs on every request and hits the database, so a session
// revoked there is gone on the next navigation.
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "admin.access")) {
    redirect("/admin/login");
  }

  return (
    <section>
      <p>
        {session.user.email} ({session.user.role})
      </p>
      <form action={signOut}>
        <button type="submit">Sair</button>
      </form>
      {children}
    </section>
  );
}
