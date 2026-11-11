import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { listAccessPoliciesWith } from "@/lib/access-policy.ts";
import { getSession } from "@/lib/session.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { TwoStepSwitch } from "./two-step-switch.tsx";

export const metadata = { title: "Liberação de acesso" };

/**
 * The Átrios master account's own screen: every office of the platform,
 * whichever site it is opened from, with its two-step access on or off.
 */
export default async function AccessReleasePage() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "access.release")) notFound();
  const tenants = Object.values(TENANTS).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  const policies = await listAccessPoliciesWith(
    db,
    tenants.map((tenant) => tenant.slug),
  );
  const envOff = process.env.PANEL_ACCESS_CODE === "off";

  return (
    <>
      <AdminPageHeader title="Liberação de acesso" />
      <main className="flex max-w-[900px] flex-col gap-4.5 px-[30px] py-7">
        <section className="rounded-[14px] border border-admin-border bg-admin-card px-5 py-4">
          <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
            Verificação em duas etapas por serventia
          </h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-admin-muted">
            Só a conta mestre da Átrios vê esta tela. Desligada, a serventia
            entra no painel só com a senha, sem o código por e-mail. Use quando
            a serventia não está recebendo os e-mails, ou a pedido dela, e ligue
            de novo assim que possível. Cada mudança fica na auditoria da
            serventia.
          </p>
          {envOff && (
            <p className="mt-2 rounded-[10px] bg-admin-warning-bg px-3 py-2 text-[12.5px] font-semibold text-admin-warning-text">
              A variável PANEL_ACCESS_CODE=off está ativa neste deploy: a
              verificação está desligada para todas as serventias, qualquer que
              seja a escolha abaixo.
            </p>
          )}
        </section>
        <ul className="flex flex-col gap-2.5">
          {tenants.map((tenant) => {
            const policy = policies[tenant.slug];
            return (
              <li
                key={tenant.slug}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-admin-border bg-admin-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-[13.5px] text-admin-primary">
                    {tenant.name}
                  </p>
                  <p className="text-[11.5px] text-admin-muted [overflow-wrap:anywhere]">
                    {tenant.hosts[0] ?? tenant.slug}
                    {policy.changedAt &&
                      ` · alterado em ${formatOfficeDateTime(new Date(policy.changedAt))}`}
                    {policy.reason && ` · ${policy.reason}`}
                  </p>
                </div>
                <TwoStepSwitch
                  slug={tenant.slug}
                  name={tenant.name}
                  on={policy.twoStep === "on"}
                />
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
