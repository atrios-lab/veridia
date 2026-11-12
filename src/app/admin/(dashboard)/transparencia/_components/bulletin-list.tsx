import {
  BULLETIN_STATUS_LABELS,
  type BulletinStatus,
  formatMonthYear,
} from "@/core/transparency/bulletin.ts";
import type { TransparencyBulletinRow } from "@/lib/transparency.ts";
import { buttonVariants } from "../../../_ui/button.tsx";
import { RemoveBulletinButton } from "./remove-bulletin-button.tsx";

function monthYearOf(referenceMonth: string): string {
  // "YYYY-MM-01": read the parts, never a Date (that would shift by zone).
  const [year, month] = referenceMonth.split("-").map(Number);
  return formatMonthYear(month, year);
}

export function BulletinList({
  bulletins,
  signed = [],
}: {
  bulletins: TransparencyBulletinRow[];
  /** The ids whose signed copy still matches what is published. */
  signed?: string[];
}) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <h3 className="border-b border-border px-5 py-3.5 text-lg font-semibold text-foreground">
        Boletins publicados
      </h3>
      {bulletins.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted-foreground">
          Nenhum boletim publicado ainda.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {bulletins.map((b) => {
            const status = b.status as BulletinStatus;
            return (
              <li key={b.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="flex-1 text-sm font-medium text-foreground">
                  {monthYearOf(b.referenceMonth)}
                  {signed.includes(b.id) && (
                    <span className="ml-2 rounded-full bg-success-soft px-2 py-0.5 text-xs font-medium text-success-text">
                      Assinado digitalmente
                    </span>
                  )}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    status === "consolidated"
                      ? "bg-success-soft text-success-text"
                      : "bg-warning-soft text-warning-text"
                  }`}
                >
                  {BULLETIN_STATUS_LABELS[status]}
                </span>
                <a
                  href={`/transparencia/boletim/${b.id}`}
                  target="_blank"
                  rel="noopener"
                  className={buttonVariants({
                    variant: "outline",
                    size: "sm",
                    className: "flex-none",
                  })}
                >
                  Ver PDF
                </a>
                <RemoveBulletinButton
                  id={b.id}
                  label={monthYearOf(b.referenceMonth)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
