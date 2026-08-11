import {
  BULLETIN_STATUS_LABELS,
  type BulletinStatus,
  formatMonthYear,
} from "@/core/transparency/bulletin.ts";
import type { TransparencyBulletinRow } from "@/lib/transparency.ts";

function monthYearOf(referenceMonth: string): string {
  // "YYYY-MM-01": read the parts, never a Date (that would shift by zone).
  const [year, month] = referenceMonth.split("-").map(Number);
  return formatMonthYear(month, year);
}

export function BulletinList({
  bulletins,
}: {
  bulletins: TransparencyBulletinRow[];
}) {
  return (
    <div className="rounded-[14px] border border-admin-border bg-admin-card">
      <h3 className="border-b border-admin-border px-5 py-3.5 font-serif text-[15.5px] font-semibold text-admin-primary">
        Boletins publicados
      </h3>
      {bulletins.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-admin-muted">
          Nenhum boletim publicado ainda.
        </p>
      ) : (
        <ul className="divide-y divide-admin-border">
          {bulletins.map((b) => {
            const status = b.status as BulletinStatus;
            return (
              <li key={b.id} className="flex items-center gap-3 px-5 py-3.5">
                <span className="flex-1 text-[13.5px] font-semibold text-admin-primary">
                  {monthYearOf(b.referenceMonth)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${
                    status === "consolidated"
                      ? "bg-admin-success-bg text-admin-success-text"
                      : "bg-admin-warning-bg text-admin-warning-text"
                  }`}
                >
                  {BULLETIN_STATUS_LABELS[status]}
                </span>
                <a
                  href={`/transparencia/boletim/${b.id}`}
                  target="_blank"
                  rel="noopener"
                  className="btn btn-admin-secondary btn-sm flex-none"
                >
                  Ver PDF
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
