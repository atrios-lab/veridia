import Link from "next/link";
import {
  type OfficialPortal,
  portalGroupsFor,
  SERP_PORTAL,
} from "@/core/portals/catalog.ts";
import { Icon } from "../_components/icon.tsx";
import { requireSection } from "../_lib/section.ts";

export const metadata = { title: "Centrais oficiais" };

function DomainChip({ domain }: { domain: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-border bg-brand-surface px-2.5 py-1 text-[11.5px] font-semibold text-brand-primary-soft">
      <Icon name="lock" className="h-3 w-3" />
      {domain}
    </span>
  );
}

function PortalCard({ portal }: { portal: OfficialPortal }) {
  return (
    <a
      href={portal.url}
      target="_blank"
      rel="noopener"
      className="flex flex-col rounded-2xl border border-brand-border bg-brand-card p-5 hover:border-brand-accent"
    >
      <span className="font-serif text-[17px] font-semibold text-brand-primary">
        {portal.name}
      </span>
      <span className="mt-1.5 text-sm leading-relaxed text-brand-muted">
        {portal.description}
      </span>
      <span className="mt-3 flex items-center gap-1.5">
        <DomainChip domain={portal.domain} />
        <Icon
          name="arrowUpRight"
          className="ml-auto h-4 w-4 text-brand-accent"
        />
      </span>
    </a>
  );
}

export default async function OfficialPortalsPage() {
  const tenant = await requireSection("centrais-contato");
  const groups = portalGroupsFor(tenant.attributions);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent">
            Plataformas nacionais
          </span>
          <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-primary">
            Centrais oficiais
          </h1>
          <p className="mt-3 max-w-[62ch] leading-relaxed text-brand-muted">
            Sites oficiais onde você pede certidões e resolve serviços de
            cartório pela internet, com segurança.
          </p>
        </div>
        <Link
          href="/contato"
          className="inline-flex flex-none items-center gap-1.5 text-sm font-semibold text-brand-primary hover:text-brand-primary-soft"
        >
          Endereço e horário
          <Icon name="arrowRight" className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-6 flex items-start gap-2.5 rounded-2xl border border-brand-border bg-brand-tint p-4">
        <Icon
          name="shield"
          className="mt-0.5 h-4 w-4 flex-none text-brand-primary-soft"
        />
        <p className="text-[13px] leading-relaxed text-brand-primary-soft">
          <strong>Todos os links abaixo levam a sites oficiais.</strong> Confira
          o endereço no navegador ao chegar — o cartório nunca pede senha nem
          pagamento fora desses sites.
        </p>
      </div>

      <div className="mt-6 flex flex-col items-start gap-5 rounded-2xl bg-brand-primary p-6 sm:flex-row sm:items-center">
        <span className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-brand-primary-soft">
          <Icon name="columns" className="h-5 w-5 text-brand-on-dark-accent" />
        </span>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-serif text-lg font-semibold text-white">
              {SERP_PORTAL.name}
            </span>
            <span className="rounded-full bg-brand-accent-soft px-2.5 py-0.5 text-[10px] font-bold tracking-[0.1em] text-brand-accent uppercase">
              Portal único
            </span>
          </div>
          <p className="mt-1 text-[13px] text-brand-on-dark-body">
            {SERP_PORTAL.description}
          </p>
        </div>
        <a
          href={SERP_PORTAL.url}
          target="_blank"
          rel="noopener"
          className="inline-flex flex-none items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-brand-primary"
        >
          {SERP_PORTAL.domain}
          <Icon name="arrowUpRight" className="h-3.5 w-3.5" />
        </a>
      </div>

      {groups.map((group) => (
        <section key={group.label} className="mt-7">
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-brand-accent">
              {group.label}
            </span>
            <span className="h-px flex-1 bg-brand-border" />
          </div>
          <div className="mt-3 grid grid-cols-1 gap-3.5 md:grid-cols-2">
            {group.portals.map((portal) => (
              <PortalCard key={portal.domain} portal={portal} />
            ))}
          </div>
        </section>
      ))}

      <div className="mt-8 flex items-start gap-2.5 rounded-2xl bg-brand-accent-soft p-5">
        <Icon
          name="info"
          className="mt-0.5 h-4 w-4 flex-none text-brand-accent"
        />
        <p className="text-[13px] leading-relaxed text-brand-accent">
          Não achou o que precisa?{" "}
          <Link href="/solicitar" className="font-semibold underline">
            Peça direto ao cartório
          </Link>{" "}
          ou fale com a gente pelo{" "}
          <Link href="/contato" className="font-semibold underline">
            atendimento
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
