import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/app/admin/_components/back-link";
import { DEMO_EMAIL_HELD_LABEL } from "@/core/tenant/demo-office.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { findAppointmentByProtocol } from "@/lib/appointments.ts";
import { findDemoEmail } from "@/lib/demo-outbox.ts";
import { AdminPageHeader } from "../../../../_components/page-header.tsx";
import { demoOutboxAccess, requestHref } from "../access.ts";

export const metadata = { title: "E-mail de demonstração" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One held message: who would have received it, and the text. */
export default async function DemoEmailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await demoOutboxAccess();
  if (!access) notFound();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const email = await findDemoEmail(access.tenant.slug, id);
  if (!email) notFound();

  let recordHref = null as string | null;
  if (email.relatedKind === "appointment" && email.relatedProtocol) {
    const appointment = await findAppointmentByProtocol(
      access.tenant.slug,
      email.relatedProtocol,
    ).catch(() => undefined);
    if (appointment) recordHref = `/admin/agenda/agendamento/${appointment.id}`;
  } else {
    recordHref = requestHref(email.relatedProtocol);
  }

  return (
    <>
      <AdminPageHeader title={email.subject} maxWidth={900} />
      <main className="flex max-w-[900px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <BackLink
            href="/admin/demonstracao/emails"
            label="E-mails de demonstração"
          />
        </div>
        <section className="rounded-xl border bg-card p-5">
          <p className="text-sm font-semibold text-foreground">
            {DEMO_EMAIL_HELD_LABEL}
          </p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Para</dt>
            <dd className="break-all text-foreground">{email.to}</dd>
            <dt className="text-muted-foreground">Assunto</dt>
            <dd className="text-foreground">{email.subject}</dd>
            <dt className="text-muted-foreground">Quando</dt>
            <dd className="text-foreground tabular-nums">
              {formatOfficeDateTime(email.createdAt)}
            </dd>
            {email.relatedProtocol && (
              <>
                <dt className="text-muted-foreground">Protocolo</dt>
                <dd className="text-foreground">
                  {recordHref ? (
                    <Link
                      href={recordHref}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {email.relatedProtocol}
                    </Link>
                  ) : (
                    email.relatedProtocol
                  )}
                </dd>
              </>
            )}
          </dl>
          <pre className="mt-5 whitespace-pre-wrap rounded-lg bg-muted p-4 font-sans text-sm leading-relaxed text-foreground">
            {email.text}
          </pre>
        </section>
      </main>
    </>
  );
}
