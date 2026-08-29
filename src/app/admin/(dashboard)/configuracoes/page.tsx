import Link from "next/link";
import { notFound } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { ATTRIBUTIONS, type Attribution } from "@/core/tenant/schema.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { AdminIcon } from "../../_components/icon.tsx";
import { AdminPageHeader } from "../../_components/page-header.tsx";
import { ConfiguracoesTabs } from "./_components/tabs.tsx";
import { OfficeContactForm } from "./office-contact-form.tsx";
import { OfficeDeadlineForm } from "./office-deadline-form.tsx";

export const metadata = { title: "Configurações" };

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-bold text-admin-primary">
        {label}
      </span>
      <p className="rounded-[9px] border border-admin-border bg-admin-readonly-bg px-3.5 py-2.5 text-[13.5px] text-admin-muted">
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
}: {
  attribution: Attribution;
  delegated: boolean;
}) {
  const { label, gloss } = ATTRIBUTION_PANEL_LABELS[attribution];
  return (
    <div
      className={`flex items-center gap-3 rounded-[10px] border bg-admin-input-bg px-3.5 py-3 ${
        delegated
          ? "border-admin-active-border"
          : "border-admin-border opacity-75"
      }`}
    >
      {delegated ? (
        <span
          aria-hidden="true"
          className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-admin-primary-soft"
        >
          <AdminIcon
            name="check"
            className="h-[11px] w-[11px] text-white"
            strokeWidth={3}
          />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="h-5 w-5 flex-none rounded-full border-[1.5px] border-admin-input-border"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold text-admin-primary">
          {label}
        </span>
        <span className="block text-[11.5px] text-admin-muted">{gloss}</span>
      </span>
      <span
        className={`flex-none text-[10.5px] font-bold ${
          delegated ? "text-admin-primary-soft" : "text-admin-faint"
        }`}
      >
        {delegated ? "Delegada" : "Não delegada"}
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
  if (!session || !can(session.user.role ?? "", "content.edit")) notFound();
  const tenant = await getTenant();
  const role = session.user.role ?? "";
  const canBrand = can(role, "branding.edit");

  return (
    <>
      <AdminPageHeader title="Configurações" />
      <main className="flex max-w-[960px] flex-col gap-4.5 px-[30px] py-7">
        <ConfiguracoesTabs role={role} />

        <div className="rounded-[14px] border border-admin-border bg-admin-card p-6">
          <OfficeContactForm tenant={tenant} />

          <section className="mt-6 border-t border-admin-border pt-5.5">
            <OfficeDeadlineForm tenant={tenant} />
          </section>

          <section className="mt-6 border-t border-admin-border pt-5.5">
            <div className="flex items-center gap-2.5">
              <h2 className="font-serif text-[17px] font-semibold text-admin-primary">
                Dados da serventia
              </h2>
              <span className="rounded-full bg-admin-warning-bg px-2.5 py-0.5 text-[11px] font-bold text-admin-warning-text">
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

            <h3 className="mt-5.5 mb-3 text-[11.5px] font-bold uppercase tracking-[0.09em] text-admin-accent">
              Atribuições da serventia
            </h3>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {ATTRIBUTIONS.map((attribution) => (
                <AttributionRow
                  key={attribution}
                  attribution={attribution}
                  delegated={tenant.attributions.includes(attribution)}
                />
              ))}
            </div>
            <p className="mt-3 text-xs leading-relaxed text-admin-muted">
              A atribuição é uma delegação do tribunal, não uma preferência da
              serventia, por isso não tem como alterar por aqui. É ela que
              decide quais seções o site oferece e quais atos o cidadão pode
              pedir; para atualizar, fale com o suporte. Logotipo, estilo e
              seções da página inicial ficam na aba{" "}
              {canBrand ? (
                <Link
                  href="/admin/configuracoes/identidade-visual"
                  className="font-semibold underline"
                >
                  Identidade Visual
                </Link>
              ) : (
                <span className="font-semibold">Identidade Visual</span>
              )}
              . O contato do Encarregado de Dados fica na aba{" "}
              <Link
                href="/admin/configuracoes/encarregado"
                className="font-semibold underline"
              >
                Encarregado
              </Link>
              , e a chave Pix da serventia, na aba{" "}
              <Link
                href="/admin/configuracoes/cobranca"
                className="font-semibold underline"
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
