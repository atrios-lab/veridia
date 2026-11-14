import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  officeHolidays,
  upcomingLawHolidays,
} from "@/core/scheduling/calendar.ts";
import {
  ATTRIBUTION_REGIME_LABELS,
  ATTRIBUTIONS,
  type Attribution,
} from "@/core/tenant/schema.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, today } from "@/lib/tenant.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { ConfiguracoesTabs } from "./_components/tabs.tsx";
import { OfficeAttributionsForm } from "./office-attributions-form.tsx";
import { OfficeContactForm } from "./office-contact-form.tsx";
import { OfficeDeadlineForm } from "./office-deadline-form.tsx";
import { OfficeHolidaysForm } from "./office-holidays-form.tsx";
import { OfficeIdentificationForm } from "./office-identification-form.tsx";

export const metadata = { title: "Configurações" };

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </span>
      <p className="rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
        {value}
      </p>
    </div>
  );
}

/**
 * How the panel names each attribution: the label the registrar recognises,
 * and the short gloss under it.
 *
 * Its own map, not one of the two in core/acts/catalog.ts, because those two
 * are written for the citizen: someone who has to be told what RCPN stands
 * for before they can pick it from a list. The registrar is the person the
 * delegation was granted to. So "Protesto / Protesto de Títulos" here, where
 * the catalogue says "Tabelionato de Protesto" to a citizen, and "RCPJ /
 * Pessoas Jurídicas" where the catalogue spells out the full legal name.
 *
 * The official acronyms are untouched; NOTAS and PROTESTO are words rather
 * than initials, so they are written as words.
 */
const ATTRIBUTION_PANEL_LABELS: Record<
  Attribution,
  { label: string; gloss: string }
> = {
  RCPN: { label: "RCPN", gloss: "Registro Civil das Pessoas Naturais" },
  NOTAS: { label: "Notas", gloss: "Tabelionato de Notas" },
  RI: { label: "RI", gloss: "Registro de Imóveis" },
  PROTESTO: { label: "Protesto", gloss: "Protesto de Títulos" },
  RTD: { label: "RTD", gloss: "Registro de Títulos e Documentos" },
  RCPJ: { label: "RCPJ", gloss: "Pessoas Jurídicas" },
};

/**
 * An attribution as it stands, stated rather than switched.
 *
 * It was a switch, matching the design as first approved, and the switch was
 * wrong: the first person to open the screen tried to click it. A control
 * that controls nothing is a promise the screen cannot keep, and no amount of
 * `aria-disabled` survives the instinct to click a toggle. The design was
 * revised to a tick, which is what this renders.
 *
 * The state is in words as well as in colour and shape: "Delegada" has to
 * reach a screen reader and survive being printed in black and white.
 */
function AttributionRow({
  attribution,
  delegated,
  regime,
}: {
  attribution: Attribution;
  delegated: boolean;
  regime: string;
}) {
  const { label, gloss } = ATTRIBUTION_PANEL_LABELS[attribution];
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border bg-muted/50 px-3.5 py-3 ${
        delegated ? "border-primary/40" : "opacity-75"
      }`}
    >
      {delegated ? (
        <span
          aria-hidden="true"
          className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-primary"
        >
          <AdminIcon
            name="check"
            className="h-3 w-3 text-primary-foreground"
            strokeWidth={3}
          />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="h-5 w-5 flex-none rounded-full border-2 border-input"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          {label}
        </span>
        <span className="block text-xs text-muted-foreground">{gloss}</span>
      </span>
      <span
        className={`flex-none text-xs font-semibold ${
          delegated ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {delegated ? regime : "Não oferece"}
      </span>
    </div>
  );
}

export default async function SettingsPage() {
  // The layout already proved the session and admin.access. This screen needs
  // one permission more, and it checks for itself: the sidebar omitting the
  // link is a courtesy, never the gate.
  //
  // A 404, not a redirect with an explanation: a panel user who may not edit
  // settings has no business learning the screen is there.
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "content.edit", session.user.permissions)
  )
    notFound();
  const tenant = await getTenant();
  const role = session.user.role ?? "";
  const granted = session.user.permissions;
  const canBrand = can(role, "branding.edit", granted);
  // The Tabelião/Registrador marks what the office offers (decision of
  // 14/11/2026); the others see it stated.
  const canMarkAttributions = can(role, "user.manage", granted);
  const regimeOf = (key: string) =>
    tenant.attributionRegimes?.[key] ?? "delegado";

  return (
    <>
      <AdminPageHeader maxWidth={960} title="Configurações" />
      <main className="flex max-w-[960px] flex-col gap-6 px-4 pt-6 pb-8 md:px-8">
        <ConfiguracoesTabs role={role} permissions={granted} />

        <div className="rounded-xl border bg-card p-6">
          <OfficeContactForm tenant={tenant} />

          <section className="mt-6 border-t pt-5.5">
            <OfficeIdentificationForm tenant={tenant} />
          </section>

          <section className="mt-6 border-t pt-5.5">
            <OfficeDeadlineForm tenant={tenant} />
          </section>

          <section className="mt-6 border-t pt-5.5">
            <OfficeHolidaysForm
              initial={officeHolidays(tenant)}
              initialHidden={tenant.hiddenHolidays}
              law={upcomingLawHolidays(today(), 365)}
            />
          </section>

          <section className="mt-6 border-t pt-5.5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold text-foreground">
                Dados da serventia
              </h2>
              <span className="rounded-full bg-warning px-2.5 py-0.5 text-xs font-medium text-warning-foreground">
                Somente leitura
              </span>
            </div>

            <div className="mt-3.5 grid grid-cols-1 gap-3.5 md:grid-cols-2">
              <ReadOnlyField
                label="Nome"
                value={`${tenant.name}, ${tenant.subtitle}`}
              />
              <ReadOnlyField label="CNS" value={tenant.cns} />
            </div>

            <h3 className="mt-5.5 mb-3 text-xs font-medium text-muted-foreground">
              Atribuições da serventia
            </h3>
            {canMarkAttributions ? (
              <OfficeAttributionsForm
                choices={[
                  ...ATTRIBUTIONS.map((attribution) => ({
                    key: attribution,
                    ...ATTRIBUTION_PANEL_LABELS[attribution],
                    offered: tenant.attributions.includes(attribution),
                    regime: regimeOf(attribution),
                  })),
                  {
                    key: "DISTRIBUICAO",
                    label: "Distribuição",
                    gloss: "Registro de Distribuição",
                    offered: tenant.offersDistribution ?? false,
                    regime: regimeOf("DISTRIBUICAO"),
                  },
                ]}
              />
            ) : (
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {ATTRIBUTIONS.map((attribution) => (
                  <AttributionRow
                    key={attribution}
                    attribution={attribution}
                    delegated={tenant.attributions.includes(attribution)}
                    regime={ATTRIBUTION_REGIME_LABELS[regimeOf(attribution)]}
                  />
                ))}
              </div>
            )}
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              A serventia marca o que oferece, como faz no CNJ, e em cada
              atribuição quem responde: o delegado (titular), um interino ou um
              interventor. Só o Tabelião/Registrador altera. É essa marcação que
              decide quais seções o site oferece, quais atos o cidadão pode
              pedir e o que aparece em Atribuições no painel. Logotipo, estilo e
              seções da página inicial ficam na aba{" "}
              {canBrand ? (
                <Link
                  href="/admin/configuracoes/identidade-visual"
                  className="font-medium text-primary underline"
                >
                  Identidade Visual
                </Link>
              ) : (
                <span className="font-semibold">Identidade Visual</span>
              )}
              . O contato do Encarregado de Dados fica na aba{" "}
              <Link
                href="/admin/configuracoes/encarregado"
                className="font-medium text-primary underline"
              >
                Encarregado
              </Link>
              , e a chave Pix da serventia, na aba{" "}
              <Link
                href="/admin/configuracoes/cobranca"
                className="font-medium text-primary underline"
              >
                Cobrança
              </Link>
              .
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
