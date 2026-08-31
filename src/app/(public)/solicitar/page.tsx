import Link from "next/link";
import {
  ATTRIBUTION_EXAMPLES,
  ATTRIBUTION_SHORT_NAMES,
  actsOfAttribution,
  getActForTenant,
} from "@/core/acts/catalog.ts";
import type { Attribution } from "@/core/tenant/schema.ts";
import { ATTRIBUTIONS } from "@/core/tenant/schema.ts";
import { Icon } from "../_components/icon.tsx";
import { requireSection } from "../_lib/section.ts";
import {
  ProcessingBadge,
  ProcessingHint,
  ProcessingLegend,
  Stepper,
} from "./_components/badges.tsx";
import { RequestForm } from "./request-form.tsx";

export const metadata = { title: "Solicitar serviço" };

function isAttribution(value: string | undefined): value is Attribution {
  return (
    value !== undefined && (ATTRIBUTIONS as readonly string[]).includes(value)
  );
}

/**
 * The whole wizard is one route with the choices in the query string. That is
 * what makes the browser's back button, a bookmark and a shared link behave
 * the way the citizen expects, with no state to keep on either side.
 */
export default async function RequestPage({
  searchParams,
}: {
  searchParams: Promise<{ atribuicao?: string; ato?: string }>;
}) {
  const tenant = await requireSection("pedidos");
  const { atribuicao, ato } = await searchParams;

  const attribution =
    isAttribution(atribuicao) && tenant.attributions.includes(atribuicao)
      ? atribuicao
      : undefined;
  const act = ato ? getActForTenant(tenant, ato) : undefined;

  // Step three, and only when the act really belongs to the chosen area.
  if (attribution && act && act.attribution === attribution) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">
        <StepHeader
          step={3}
          title="Preencha o pedido"
          backHref={`/solicitar?atribuicao=${attribution}`}
        />
        <RequestForm act={act} attribution={attribution} />
      </div>
    );
  }

  if (attribution) {
    const acts = actsOfAttribution(tenant, attribution);
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 md:px-10 md:py-10">
        <StepHeader step={2} title="Escolha o ato" backHref="/solicitar" />

        <div className="mt-4 flex items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-tint px-3 py-1.5">
            <span className="text-xs font-bold text-brand-primary">
              {ATTRIBUTION_SHORT_NAMES[attribution]}
            </span>
            <Link href="/solicitar" className="btn btn-ghost btn-sm">
              trocar
            </Link>
          </span>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-brand-muted">
          O selo diz como o pedido tramita, antes de você preencher qualquer
          coisa.
        </p>

        <ul className="mt-4 flex flex-col gap-2.5">
          {acts.map((option) => (
            <li key={option.id}>
              <Link
                href={`/solicitar?atribuicao=${attribution}&ato=${option.id}`}
                className="block rounded-2xl border border-brand-border bg-brand-card p-4 hover:border-brand-accent"
              >
                <div className="flex items-center gap-2.5">
                  <span className="flex-1 font-serif text-[15.5px] font-semibold text-brand-primary">
                    {option.name}
                  </span>
                  <Icon
                    name="chevronRight"
                    className="h-4 w-4 shrink-0 text-brand-primary-soft"
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ProcessingBadge act={option} />
                  <ProcessingHint act={option} />
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          <ProcessingLegend />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">
      <StepHeader step={1} title="Qual serviço você precisa?" />
      <div className="md:grid md:grid-cols-[1fr_300px] md:gap-9">
        <div>
          <p className="mt-3 text-sm leading-relaxed text-brand-muted">
            Escolha pela área. Os exemplos ajudam se você não conhece os nomes
            do cartório.
          </p>

          <ul className="mt-4 flex flex-col gap-2.5 md:grid md:grid-cols-2">
            {tenant.attributions.map((option) => (
              <li key={option}>
                <Link
                  href={`/solicitar?atribuicao=${option}`}
                  data-attribution={option}
                  className="flex h-full items-center gap-3 rounded-2xl border border-brand-border bg-brand-card p-4 hover:border-brand-accent"
                >
                  <span className="flex-1">
                    <span className="block font-serif text-[15.5px] font-semibold text-brand-primary">
                      {ATTRIBUTION_SHORT_NAMES[option]}
                    </span>
                    <span className="mt-0.5 block text-xs text-brand-muted">
                      {ATTRIBUTION_EXAMPLES[option]}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-brand-accent-soft px-2 py-1 text-[11px] font-bold text-brand-accent-ink">
                    {actsOfAttribution(tenant, option).length} atos
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-3 text-[11px] text-brand-faint">
            A lista acompanha a configuração da serventia: só aparecem as
            atribuições ativas.
          </p>
        </div>

        <aside className="mt-6 rounded-2xl border border-brand-border bg-brand-card p-5 md:mt-3">
          <h2 className="font-serif text-[17px] font-semibold text-brand-primary">
            Como funciona
          </h2>
          <ol className="mt-3 flex flex-col gap-3">
            {[
              "Escolha a área e o ato; o site mostra o que ele exige.",
              "Preencha o pedido e anexe documentos, se tiver.",
              "Receba protocolo e chave de acesso para acompanhar, sem criar conta.",
            ].map((line, index) => (
              <li key={line} className="flex gap-2.5">
                <span className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[11.5px] font-bold text-brand-primary">
                  {index + 1}
                </span>
                <p className="text-[12.5px] leading-relaxed text-brand-text-soft">
                  {line}
                </p>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </div>
  );
}

function StepHeader({
  step,
  title,
  backHref,
}: {
  step: 1 | 2 | 3;
  title: string;
  backHref?: string;
}) {
  return (
    <>
      <div className="flex items-center gap-3">
        {backHref && (
          <Link
            href={backHref}
            className="text-brand-primary"
            aria-label="Voltar para a etapa anterior"
          >
            <Icon name="arrowLeft" className="h-5 w-5" />
          </Link>
        )}
        <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
          Serviços on-line
        </span>
      </div>
      <div className="mt-3 md:flex md:items-center md:gap-6">
        <h1 className="font-serif text-2xl font-semibold text-brand-primary md:text-3xl">
          {title}
        </h1>
        <div className="mt-3 md:mt-0 md:w-[300px]">
          <Stepper current={step} />
        </div>
      </div>
    </>
  );
}
