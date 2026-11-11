import { notFound } from "next/navigation";
import { codeEmailFor, needsAccessCode } from "@/core/auth/access-settings.ts";
import { can } from "@/core/auth/roles.ts";
import { getOfficeAccess } from "@/lib/access-settings.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { OwnAccessForms } from "./own-access-forms.tsx";

export const metadata = { title: "Minha verificação em duas etapas" };

export default async function MyAccountPage() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "admin.access")) notFound();
  const tenant = await getTenant();
  const access = await getOfficeAccess(tenant.slug);
  const own = access[session.user.id]?.email ?? "";

  return (
    <>
      <AdminPageHeader title="Minha conta" />
      <main className="flex max-w-[720px] flex-col gap-4.5 px-[30px] py-7">
        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Verificação em duas etapas
          </h2>
          {needsAccessCode(session.user.role ?? "") ? (
            <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
              Depois da senha, o painel envia um código para o seu e-mail de
              verificação. Hoje ele vai para{" "}
              <strong className="text-admin-text">
                {codeEmailFor(access, session.user.id, session.user.email)}
              </strong>
              . Você pode trocar o e-mail (confirmando o novo com um código) ou
              fazer os seus dispositivos salvos pedirem o código de novo. O
              administrador da serventia também pode alterar estes dados.
            </p>
          ) : (
            <p className="mt-1 text-[12.5px] text-admin-muted">
              A conta mestre da Átrios não passa pela verificação em duas
              etapas.
            </p>
          )}
        </section>
        {needsAccessCode(session.user.role ?? "") && (
          <OwnAccessForms accountEmail={session.user.email} ownEmail={own} />
        )}
      </main>
    </>
  );
}
