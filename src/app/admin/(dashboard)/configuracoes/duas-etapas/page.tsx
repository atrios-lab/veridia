import { notFound } from "next/navigation";
import { codeEmailFor } from "@/core/auth/access-settings.ts";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import {
  getOfficeAccessWith,
  officeAccountsWith,
} from "@/lib/access-settings.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import { AccountAccessRow } from "./access-forms.tsx";

export const metadata = { title: "Verificação em duas etapas" };

export default async function TwoStepPage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "user.manage", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();
  const [accounts, access] = await Promise.all([
    officeAccountsWith(db, tenant.slug),
    getOfficeAccessWith(db, tenant.slug),
  ]);

  return (
    <>
      <AdminPageHeader title="Configurações" />
      <main className="flex max-w-[860px] flex-col gap-4.5 px-[30px] py-7">
        <ConfiguracoesTabs
          role={session.user.role ?? ""}
          permissions={session.user.permissions}
        />
        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Verificação em duas etapas
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
            Depois da senha, o painel envia um código ao e-mail de quem está
            entrando, e só dessa pessoa. O primeiro acesso (quando a pessoa cria
            a senha pelo convite) não pede código: ele começa no acesso
            seguinte. Quem marcar "Salvar este dispositivo" não recebe mais o
            código naquele dispositivo. Aqui você escolhe para qual e-mail vai o
            código de cada pessoa e pode fazer os dispositivos salvos pedirem o
            código de novo. Cada pessoa também pode trocar o próprio e-mail em
            Minha conta (menu com o nome, no alto da tela).
          </p>
        </section>
        {accounts.map((account) => (
          <AccountAccessRow
            key={account.id}
            userId={account.id}
            name={account.name}
            role={account.role}
            accountEmail={account.email}
            codeEmail={access[account.id]?.email ?? ""}
            sendsTo={codeEmailFor(access, account.id, account.email)}
          />
        ))}
      </main>
    </>
  );
}
