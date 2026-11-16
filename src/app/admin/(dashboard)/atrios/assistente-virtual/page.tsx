import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { NOTE_REVIEW_MODES } from "@/core/qualificacao/revisao-base.ts";
import { TENANTS } from "@/core/tenant/resolve.ts";
import { formatOfficeDateTime } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { aiConfigured, getAiPolicyWith } from "@/lib/ai.ts";
import { getAiPlatformWith } from "@/lib/ai-platform.ts";
import { getSession } from "@/lib/session.ts";
import { AdminPageHeader } from "../../../_components/page-header.tsx";
import { PlatformForm } from "./platform-form.tsx";

export const metadata = { title: "Assistente Virtual" };

/**
 * The Átrios master account's hold over each office's Assistente Virtual
 * (decision of 16/11/2026): allowed or held back, above the Tabelião's own
 * switch, and how the notes attached to exigências are reviewed. Only this
 * account sees it; the office never learns who changed what.
 */
export default async function AiPlatformPage() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "ai.oversee", session.user.permissions)
  )
    notFound();
  const tenants = Object.values(TENANTS).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  const rows = await Promise.all(
    tenants.map(async (tenant) => ({
      tenant,
      office: await getAiPolicyWith(db, tenant.slug).catch(() => ({
        enabled: false,
      })),
      platform: await getAiPlatformWith(db, tenant.slug),
    })),
  );

  return (
    <>
      <AdminPageHeader
        maxWidth={1000}
        title="Assistente Virtual"
        description="Por serventia: liberar ou suspender a IA e escolher como as notas anexadas às exigências são analisadas. Vale na hora e pode ser mudado a qualquer momento."
      />
      <main className="flex max-w-[1000px] flex-col gap-4 px-4 pt-6 pb-8 md:px-8">
        <section className="rounded-xl border bg-card p-5 text-sm leading-relaxed text-muted-foreground shadow-xs">
          <p>
            <strong className="text-foreground">Suspender a IA</strong> corta
            todo gasto de crédito da serventia (qualificação, DPO, base
            jurídica, tirar dúvida e análise das notas), acima do botão do
            Tabelião.{" "}
            <strong className="text-foreground">A análise das notas</strong> tem
            três modos: com IA (mais completa, gasta crédito), só pela base
            jurídica (instantânea, sem crédito) ou desligada (anexa como antes).
            Nos três, a serventia continua aprendendo os modelos de exigência;
            sem IA, pelo próprio texto das notas e sem gastar crédito.
          </p>
          {!aiConfigured() && (
            <p className="mt-2 font-medium text-warning-text">
              A chave da IA não está configurada neste ambiente: nenhuma
              serventia usa a IA até ela ser cadastrada.
            </p>
          )}
        </section>
        {rows.map(({ tenant, office, platform }) => (
          <section
            key={tenant.slug}
            className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-xs"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">
                {tenant.name}
              </h2>
              <span className="text-xs text-muted-foreground">
                Botão do Tabelião: IA {office.enabled ? "ligada" : "desligada"}
                {" · "}
                {platform.aiAllowed ? "Liberada" : "Suspensa"} ·{" "}
                {NOTE_REVIEW_MODES[platform.noteReview].label}
                {platform.changedAt
                  ? ` · alterado em ${formatOfficeDateTime(new Date(platform.changedAt))}`
                  : ""}
              </span>
            </div>
            {platform.reason && (
              <p className="text-xs text-muted-foreground">
                Último motivo: {platform.reason}
              </p>
            )}
            <PlatformForm
              slug={tenant.slug}
              aiAllowed={platform.aiAllowed}
              noteReview={platform.noteReview}
            />
          </section>
        ))}
      </main>
    </>
  );
}
