import { classificationOf } from "@/core/compliance/classification.ts";
import { toGeneratorJson } from "@/core/compliance/export.ts";
import {
  detectPendencies,
  unknownAnswers,
} from "@/core/compliance/pendencies.ts";
import { loadIntake } from "@/lib/compliance.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

export const runtime = "nodejs";

/**
 * The generator's input file. Átrios only: the platform account is the one
 * that runs the generator, and the office has nothing to do with the file.
 * The button is hidden from every other profile, and this is the check.
 */
export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session || session.user.role !== "superadmin") {
    return new Response("Não autorizado", { status: 403 });
  }

  const tenant = await getTenant();
  const { intake, answers } = await loadIntake(tenant);
  const json = toGeneratorJson({
    tenantSlug: tenant.slug,
    answers,
    classification: classificationOf(answers),
    pendencies: detectPendencies(answers),
    unknowns: unknownAnswers(answers),
    attachments: intake.attachments,
    submittedAt: intake.submittedAt?.toISOString() ?? null,
    version: intake.submittedVersion,
  });

  return new Response(JSON.stringify(json, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tenant.slug}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
}
