import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  AGENDA_WEEKDAYS,
  timesForWeekday,
  WEEKDAY_LABELS,
} from "@/core/scheduling/agenda.ts";
import { getAgendaConfig } from "@/lib/appointments.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { AgendaSettingsForm } from "./agenda-settings-form.tsx";

export const metadata = { title: "Configuração da agenda" };

export default async function AgendaSettingsPage() {
  const session = await getSession();
  if (!session || !can(session.user.role ?? "", "channels.manage")) notFound();
  const tenant = await getTenant();

  const config = await getAgendaConfig(tenant.slug);

  return (
    <>
      <AdminPageHeader title="Configuração da agenda" />
      <main className="flex flex-col gap-4.5 px-[30px] py-7">
        <Link
          href="/admin/agenda"
          className="text-[12.5px] font-semibold text-admin-accent underline"
        >
          ‹ Voltar para a agenda
        </Link>

        <AgendaSettingsForm
          grid={Object.fromEntries(
            AGENDA_WEEKDAYS.map((day) => [
              day,
              timesForWeekday(config, day).join(", "),
            ]),
          )}
          weekdays={AGENDA_WEEKDAYS.map((day) => ({
            day,
            label: WEEKDAY_LABELS[day],
          }))}
          services={config.services.map((service) => service.label).join("\n")}
          modes={config.modes.join("\n")}
          closedDates={config.closedDates}
        />
      </main>
    </>
  );
}
