import { isSectionEnabled } from "@/core/tenant/gating.ts";
import { sendDueReminders } from "@/lib/appointment-reminders.ts";
import { allTenantsWithOverrides, officeNow } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The daily reminders job, called by Vercel Cron (see vercel.json): for every
 * office with the agenda on, tomorrow's reminder to each citizen and the
 * summary of tomorrow to the office. Each one goes once, whoever calls this
 * and however often (the panel also calls it as it opens, as a backup).
 *
 * Vercel sends `Authorization: Bearer <CRON_SECRET>` when the project has
 * that variable. Without it configured the job refuses to run, rather than
 * answering anyone who finds the address: the panel still sends the
 * reminders the next time someone opens it.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Não autorizado", { status: 401 });
  }

  const now = officeNow();
  const results: Record<string, { citizens: number; summary: boolean }> = {};
  for (const tenant of await allTenantsWithOverrides()) {
    if (!isSectionEnabled(tenant, "agendamento")) continue;
    try {
      results[tenant.slug] = await sendDueReminders(tenant, now);
    } catch (error) {
      // One office's failure must not cost the others their reminders.
      console.error("agenda.reminders", tenant.slug, error);
    }
  }
  return Response.json({ day: now.date, results });
}
