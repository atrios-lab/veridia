import Link from "next/link";
import {
  DEMO_EMAIL_HELD_LABEL,
  type DemoAware,
} from "@/core/tenant/demo-office.ts";
import { formatOfficeDayMonthTime } from "@/core/time/office-time.ts";
import { demoEmailsAbout } from "@/lib/demo-outbox.ts";

/**
 * Beside a record's history in the demonstration office (change
 * painel-livre-para-alunos): each message the office would have sent about
 * it and held instead, with a link to its text. Nothing anywhere else, so a
 * real office's page never queries the outbox.
 */
export async function DemoHeldEmails({
  tenant,
  related,
}: {
  tenant: DemoAware & { slug: string };
  related: { kind: "request" | "appointment"; protocol: string };
}) {
  if (!tenant.demo) return null;
  const held = await demoEmailsAbout(tenant.slug, related).catch(() => []);
  if (held.length === 0) return null;
  return (
    <div className="rounded-xl border bg-card p-4">
      <h4 className="text-base font-semibold text-foreground">
        E-mails desta demonstração
      </h4>
      <ul className="mt-3 flex flex-col gap-2.5">
        {held.map((email) => (
          <li key={email.id} className="text-sm leading-snug text-foreground">
            <strong className="font-semibold">{DEMO_EMAIL_HELD_LABEL}:</strong>{" "}
            <Link
              href={`/admin/demonstracao/emails/${email.id}`}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              {email.subject}
            </Link>
            <br />
            <span className="text-xs text-muted-foreground tabular-nums">
              Para {email.to} · {formatOfficeDayMonthTime(email.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
