import "server-only";
import { termSignaturesOf } from "@/core/ri/books.ts";
import { db } from "@/db/index.ts";
import { listBooksWith } from "@/lib/ri-books.ts";
import { pendingDaysWith } from "@/lib/ri-protocol-days.ts";
import { listProtocolsWith, officeToday } from "@/lib/ri-protocols.ts";
import type { NavBadge } from "./ri-nav.tsx";

/**
 * The counts beside the menu (decision of 28/11/2026): only when there is
 * something to do. A failure leaves the menu without them, never broken.
 */
export async function riNavBadges(
  tenantSlug: string,
): Promise<Record<string, NavBadge>> {
  try {
    const today = officeToday();
    const [protocols, pending, books] = await Promise.all([
      listProtocolsWith(db, tenantSlug),
      pendingDaysWith(db, tenantSlug, today),
      listBooksWith(db, tenantSlug),
    ]);
    const open = protocols.filter(
      (p) =>
        !p.voidedAt &&
        p.kind === "prenotacao" &&
        ["prenotado", "exigencia", "duvida"].includes(p.status),
    ).length;
    const late = pending.filter((d) => d < today).length;
    const unsigned = books.filter((b) => {
      if (b.deletedAt) return false;
      const s = termSignaturesOf(b.termSignatures);
      return !s.abertura || (b.closedOn && !s.encerramento);
    }).length;
    const out: Record<string, NavBadge> = {};
    if (open) out["/admin/ri/protocolo"] = { text: String(open) };
    if (late) {
      out["/admin/ri/protocolo/dias"] = {
        text: late >= 400 ? "400+" : String(late),
        warn: true,
      };
    }
    if (unsigned) {
      out["/admin/ri/livros"] = {
        text: `${unsigned} a assinar`,
        warn: true,
      };
    }
    return out;
  } catch {
    return {};
  }
}
