import Link from "next/link";
import { notFound } from "next/navigation";
import { formatOfficeDayMonthTime } from "@/core/time/office-time.ts";
import { listDemoEmails } from "@/lib/demo-outbox.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { demoOutboxAccess } from "./access.ts";

export const metadata = { title: "E-mails de demonstração" };

/**
 * What the demonstration office would have sent and held instead (change
 * painel-livre-para-alunos). Not in the menu (decision of 16/11/2026): the
 * history of each record links here.
 */
export default async function DemoEmailsPage() {
  const access = await demoOutboxAccess();
  if (!access) notFound();
  const emails = await listDemoEmails(access.tenant.slug);

  return (
    <>
      <AdminPageHeader title="E-mails de demonstração" maxWidth={900} />
      <main className="flex max-w-[900px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <p className="text-sm text-muted-foreground">
          Este cartório é de demonstração: nenhum e-mail sai daqui. Abaixo estão
          os últimos que o sistema teria enviado, com o texto que a pessoa
          receberia.
        </p>
        <section className="rounded-xl border bg-card">
          {emails.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted-foreground">
              Nenhum e-mail ainda. Mude o andamento de um pedido ou responda um
              requerimento para ver o que o cidadão receberia.
            </p>
          ) : (
            <ul className="divide-y">
              {emails.map((email) => (
                <li key={email.id} className="px-5 py-3.5">
                  <Link
                    href={`/admin/demonstracao/emails/${email.id}`}
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {email.subject}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    Para {email.to} ·{" "}
                    {formatOfficeDayMonthTime(email.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
