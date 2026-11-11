import Image from "next/image";
import { redirect } from "next/navigation";
import {
  getClosedHoursSession,
  getPendingSession,
  getSession,
} from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
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
    <main className="flex min-h-screen items-center justify-center bg-admin-surface px-4 py-10">
      <div className="w-full max-w-[420px] rounded-[16px] border border-admin-border bg-admin-card px-7 py-8">
        <div className="flex items-center gap-3">
          <Image
            src={tenant.logos.seal.light}
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
          />
          <span className="font-serif text-[15px] font-semibold text-admin-primary">
            {tenant.name}
          </span>
        </div>
        <h1 className="mt-6 font-serif text-[22px] font-semibold text-admin-primary">
          Confirme que é você
        </h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-admin-muted">
          Por segurança, o acesso ao painel tem duas etapas: a senha e um código
          enviado ao seu e-mail.
        </p>
        <AccessCodeForm next={destination} />
        <form
          action={signOut}
          className="mt-5 border-t border-admin-border pt-4"
        >
          <button
            type="submit"
            className="text-[12.5px] font-semibold text-admin-muted underline hover:text-admin-primary"
          >
            Sair e entrar com outra conta
          </button>
        </form>
      </div>
    </main>
  );
}
