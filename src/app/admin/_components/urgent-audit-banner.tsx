import Link from "next/link";
import { buttonVariants } from "../_ui/button.tsx";

/**
 * On every screen of the Tabelião/Registrador while an urgent act of the
 * last 30 days waits for his look: an exclusion, the Pix key, an account,
 * access. It goes away only when he marks them as seen in Auditoria.
 */
export function UrgentAuditBanner({ count }: { count: number }) {
  return (
    <output className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm text-destructive-foreground md:mx-8">
      <span className="flex items-center gap-2 font-medium">
        <span
          aria-hidden="true"
          className="inline-block size-2.5 animate-pulse rounded-full bg-destructive-foreground"
        />
        {count === 1
          ? "1 ato urgente aguarda a sua verificação na auditoria."
          : `${count} atos urgentes aguardam a sua verificação na auditoria.`}
      </span>
      <Link
        href="/admin/auditoria?nivel=urgente&pendentes=1"
        className={buttonVariants({ variant: "secondary", size: "sm" })}
      >
        Verificar agora
      </Link>
    </output>
  );
}

/**
 * On every screen of whoever has an audit notification to answer: the
 * notice inside the platform, besides the e-mail (decision of 11/11/2026).
 * It stays until the answer is sent.
 */
export function AuditNoticeBanner({ count }: { count: number }) {
  return (
    <output className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-warning px-4 py-2.5 text-sm text-warning-foreground md:mx-8">
      <span className="flex items-center gap-2 font-medium">
        <span
          aria-hidden="true"
          className="inline-block size-2.5 animate-pulse rounded-full bg-warning-foreground"
        />
        {count === 1
          ? "O Tabelião/Registrador enviou uma notificação de auditoria para você. Responda em até 24 horas."
          : `O Tabelião/Registrador enviou ${count} notificações de auditoria para você. Responda em até 24 horas.`}
      </span>
      <Link
        href="/admin/auditoria"
        className={buttonVariants({ variant: "secondary", size: "sm" })}
      >
        Ver e responder
      </Link>
    </output>
  );
}

export { AuditChime } from "./audit-chime.tsx";

/**
 * Release requests from people outside the panel's hours, waiting for
 * the holder (decision of 11/11/2026).
 */
export function AccessRequestsBanner({ count }: { count: number }) {
  return (
    <output className="flex items-center gap-2.5 bg-warning px-4 py-2.5 text-sm font-medium text-warning-foreground md:px-8">
      <span aria-hidden="true">🕘</span>
      <span className="flex-1">
        {count === 1
          ? "1 pessoa pediu para acessar o painel fora do horário."
          : `${count} pessoas pediram para acessar o painel fora do horário.`}
      </span>
      <Link
        href="/admin/configuracoes/horario-de-acesso"
        className={buttonVariants({ variant: "secondary", size: "sm" })}
      >
        Ver e decidir
      </Link>
    </output>
  );
}

/**
 * Someone away (busy, at the counter, in a meeting, absent) for 40
 * minutes or more (decision of 11/11/2026): the holder checks, and can
 * change the status in Equipe e conversas. At 60 it lapses on its own.
 */
export function LingeringStatusBanner({
  people,
}: {
  people: { name: string; status: string; minutes: number }[];
}) {
  const [first, ...rest] = people;
  if (!first) return null;
  return (
    <output className="flex items-center gap-2.5 bg-warning px-4 py-2.5 text-sm font-medium text-warning-foreground md:px-8">
      <span aria-hidden="true">⏱</span>
      <span className="flex-1">
        {first.name} está como &quot;{first.status}&quot; há {first.minutes}{" "}
        minutos
        {rest.length > 0
          ? ` (e mais ${rest.length} ${rest.length === 1 ? "pessoa" : "pessoas"})`
          : ""}
        .
      </span>
      <Link
        href="/admin/mensagens/supervisao"
        className={buttonVariants({ variant: "secondary", size: "sm" })}
      >
        Verificar
      </Link>
    </output>
  );
}
