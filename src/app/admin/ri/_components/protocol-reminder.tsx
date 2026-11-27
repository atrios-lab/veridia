import Link from "next/link";
import { can } from "@/core/auth/roles.ts";
import { shortDate } from "@/core/ri/books.ts";
import { db } from "@/db/index.ts";
import {
  lastImportedDayWith,
  protocolReminderWith,
} from "@/lib/ri-protocol-days.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { LaterButton, RemindLater } from "./remind-later.tsx";

/**
 * "Encerre o Protocolo" (Lei nº 6.015/1973, art. 184): from 14h when today
 * is open, and from the start of the day when a day before is still open
 * (decision of 26/11/2026). Only for offices with the Registro de Imóveis.
 */
export async function ProtocolReminder() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "ri.view", session.user.permissions)
  ) {
    return null;
  }
  const tenant = await getTenant();
  if (!tenant.attributions.includes("RI")) return null;
  const reminder = await protocolReminderWith(db, tenant.slug).catch(
    () => null,
  );
  if (!reminder?.due) return null;
  const imported = await lastImportedDayWith(db, tenant.slug).catch(() => null);
  const first = reminder.late[0];
  const message =
    imported && first && first <= imported
      ? `Os dias do Protocolo importado (desde ${shortDate(first)}) ainda não estão marcados como encerrados no livro físico. Abra o encerramento e marque todos com um clique.`
      : reminder.late.length > 0
        ? `O Protocolo tem ${reminder.late.length} ${reminder.late.length === 1 ? "dia anterior aberto" : "dias anteriores abertos"} (desde ${shortDate(reminder.late[0] ?? "")}). Encerre cada um com a sua data.`
        : "O Protocolo de hoje ainda não foi encerrado.";
  return (
    <RemindLater>
      <div className="flex flex-col gap-3 rounded-lg border border-warning/50 bg-warning-soft px-4 py-3 text-sm text-warning-text sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 leading-relaxed">
          <span className="font-semibold">Encerramento do Protocolo:</span>{" "}
          {message}{" "}
          <span className="whitespace-nowrap text-xs">
            (Lei nº 6.015/1973, art. 184)
          </span>
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <LaterButton />
          <Link
            href="/admin/ri/protocolo/dias"
            className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Encerrar agora
          </Link>
        </div>
      </div>
    </RemindLater>
  );
}
