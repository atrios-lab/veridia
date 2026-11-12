import { redirect } from "next/navigation";
import {
  getClosedHoursSession,
  getPendingSession,
  getSession,
} from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { OfficeMark } from "../_components/sidebar.tsx";
import { Button } from "../_ui/button.tsx";
import { signOut } from "../actions.ts";
import { AccessCodeForm } from "./access-code-form.tsx";

export const metadata = { title: "Código de acesso" };

/** The second step of the panel's sign-in: the code sent by e-mail. */
export default async function AccessCodePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination =
    next && (next.startsWith("/admin/") || next === "/admin") ? next : "/admin";
  // Past the code but outside the hours: the panel shows the closed screen.
  if ((await getSession()) || (await getClosedHoursSession())) {
    redirect(destination);
  }
  if (!(await getPendingSession())) redirect("/admin/login");
  const tenant = await getTenant();

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted px-4 py-10">
      <div className="w-full max-w-105 rounded-xl border bg-card px-6 py-8 shadow-xs sm:px-8">
        <OfficeMark tenant={tenant} />
        <h1 className="mt-6 text-xl font-semibold text-foreground">
          Confirme que é você
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          Por segurança, o acesso ao painel tem duas etapas: a senha e um código
          enviado ao seu e-mail.
        </p>
        <AccessCodeForm next={destination} />
        <form action={signOut} className="mt-6 border-t pt-4">
          <Button
            type="submit"
            variant="link"
            className="h-auto px-0 text-muted-foreground underline hover:text-foreground"
          >
            Sair e entrar com outra conta
          </Button>
        </form>
      </div>
    </main>
  );
}
