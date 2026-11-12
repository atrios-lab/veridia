import { notFound } from "next/navigation";
import { ACCESS_CLOSED_NOTICE, released } from "@/core/auth/access-hours.ts";
import { can, type Role } from "@/core/auth/roles.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { getAccessHoursWith, listPeopleWith } from "@/lib/access-hours.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { ROLE_LABELS } from "../../../_components/role-labels.ts";
import { Button } from "../../../_ui/button.tsx";
import { ConfiguracoesTabs } from "../_components/tabs.tsx";
import { decideRelease } from "./actions.ts";
import { WindowForm } from "./window-form.tsx";

export const metadata = { title: "Horário de acesso" };

const CARD = "rounded-xl border bg-card px-5 py-4";

function Decide({
  userId,
  decision,
  label,
  tone = "secondary",
}: {
  userId: string;
  decision: string;
  label: string;
  tone?: "primary" | "secondary" | "danger";
}) {
  return (
    <form action={decideRelease}>
      <input type="hidden" name="userId" value={userId} />
      <input type="hidden" name="decision" value={decision} />
      <Button
        type="submit"
        size="sm"
        variant={
          tone === "primary"
            ? "default"
            : tone === "danger"
              ? "destructive"
              : "outline"
        }
      >
        {label}
      </Button>
    </form>
  );
}

/**
 * When the panel opens, who may use it outside that window, and the
 * requests waiting (decision of 11/11/2026). The holder only.
 */
export default async function AccessHoursPage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "access.manage", session.user.permissions)
  ) {
    notFound();
  }
  const tenant = await getTenant();
  const [hours, people] = await Promise.all([
    getAccessHoursWith(db, tenant.slug),
    listPeopleWith(db, tenant.slug),
  ]);
  const now = new Date();

  return (
    <>
      <AdminPageHeader maxWidth={1000} title="Configurações" />
      <main className="flex max-w-[1000px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <ConfiguracoesTabs
          role={session.user.role ?? ""}
          permissions={session.user.permissions}
        />
        <section className={CARD}>
          <h2 className="text-lg font-semibold text-foreground">
            Horário de acesso ao painel
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Fora deste horário, quem não estiver liberado abaixo vê &quot;Acesso
            indisponível neste horário&quot; e pode pedir liberação a você. Você
            e a conta da plataforma entram a qualquer hora. Uma tela aberta
            avisa 10 minutos antes e fecha no horário.
          </p>
          <WindowForm
            enabled={hours.enabled}
            start={hours.start}
            end={hours.end}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            O que aparece para a pessoa: {ACCESS_CLOSED_NOTICE}
          </p>
        </section>

        {hours.requests.length > 0 && (
          <section className={`${CARD} border-warning`}>
            <h2 className="text-lg font-semibold text-foreground">
              Pedidos de liberação
            </h2>
            <ul className="mt-2 flex flex-col divide-y">
              {hours.requests.map((request) => (
                <li key={request.userId} className="py-3">
                  <p className="text-sm font-medium text-foreground">
                    {request.name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground tabular-nums">
                      {formatOfficeDateTime(new Date(request.at))}
                    </span>
                  </p>
                  <p className="mt-0.5 text-sm text-foreground [overflow-wrap:anywhere]">
                    {request.reason}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Decide
                      userId={request.userId}
                      decision="hoje"
                      label="Liberar só hoje"
                      tone="primary"
                    />
                    <Decide
                      userId={request.userId}
                      decision="sempre"
                      label="Liberar sempre"
                    />
                    <Decide
                      userId={request.userId}
                      decision="recusar"
                      label="Recusar"
                      tone="danger"
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={CARD}>
          <h2 className="text-lg font-semibold text-foreground">
            Quem pode acessar fora do horário
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tudo o que você liberar ou retirar fica registrado na auditoria.
          </p>
          {people.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Ninguém mais tem conta nesta serventia.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col divide-y">
              {people.map((person) => {
                const always = hours.always.includes(person.id);
                const today =
                  !always && released(hours, person.id, now)
                    ? hours.until[person.id]
                    : undefined;
                return (
                  <li
                    key={person.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">
                        {person.name}{" "}
                        <span className="font-normal text-muted-foreground">
                          ({ROLE_LABELS[person.role as Role] ?? person.role})
                        </span>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {always
                          ? "Liberado sempre, fora do horário"
                          : today
                            ? `Liberado até ${formatOfficeDateTime(new Date(today))}`
                            : `Só no horário (${hours.start} às ${hours.end})`}
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-2">
                      {always || today ? (
                        <Decide
                          userId={person.id}
                          decision="retirar"
                          label="Retirar liberação"
                          tone="danger"
                        />
                      ) : (
                        <>
                          <Decide
                            userId={person.id}
                            decision="hoje"
                            label="Liberar só hoje"
                          />
                          <Decide
                            userId={person.id}
                            decision="sempre"
                            label="Liberar sempre"
                          />
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
