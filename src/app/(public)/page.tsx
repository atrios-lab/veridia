import Image from "next/image";
import Link from "next/link";
import { ATTRIBUTION_SHORT_NAMES } from "@/core/acts/catalog.ts";
import {
  PUBLICATION_KIND_LABELS,
  type PublicationKind,
} from "@/core/publications/publication.ts";
import { formatDate } from "@/core/scheduling/calendar.ts";
import {
  isSectionEnabled,
  SECTION_LABELS,
  SECTION_ROUTES,
} from "@/core/tenant/gating.ts";
import type { Section } from "@/core/tenant/schema.ts";
import { livePublications } from "@/lib/publications.ts";
import { getTenant } from "@/lib/tenant.ts";
import { Icon, type IconName } from "./_components/icon.tsx";

// The home's own section shows only the most recent ones; there is no
// listing page to send the rest to yet, so an unbounded list would just grow
// forever on an office that never archives manually (see design.md, Risks).
const MAX_HOME_PUBLICATIONS = 6;

// The three tasks that bring a citizen here, in the order the redesign puts
// them. Each one is a section, so an office that does not offer it simply
// does not show the card.
const ACTION_CARDS: {
  section: Section;
  icon: IconName;
  description: string;
  desktopOnly?: boolean;
}[] = [
  {
    section: "pedidos",
    icon: "pencil",
    description: "Certidões e atos, em 3 etapas",
  },
  { section: "agendamento", icon: "calendar", description: "" },
  {
    section: "selo-tjrn",
    icon: "seal",
    description: "Confira a autenticidade de um ato",
  },
  // Desktop only: the phone keeps the three tasks, as the redesign draws.
  {
    section: "centrais-contato",
    icon: "external",
    description: "Links oficiais por atribuição, sem sites falsos",
    desktopOnly: true,
  },
];

const CITIZEN_LINKS: {
  section: Section;
  icon: IconName;
  description: string;
}[] = [
  {
    section: "dpo-lgpd",
    icon: "shield",
    description: "Exerça seus direitos sobre seus dados",
  },
  {
    section: "ouvidoria",
    icon: "chat",
    description: "Elogio, reclamação, sugestão ou denúncia",
  },
  {
    section: "transparencia",
    icon: "columns",
    description: "Documentos públicos e movimento mensal",
  },
];

export default async function Home() {
  const tenant = await getTenant();
  const cards = ACTION_CARDS.filter((c) => isSectionEnabled(tenant, c.section));
  const citizenLinks = CITIZEN_LINKS.filter((l) =>
    isSectionEnabled(tenant, l.section),
  );
  const canLookUp = isSectionEnabled(tenant, "consulta-protocolo");
  const publications = (await livePublications(tenant.slug)).slice(
    0,
    MAX_HOME_PUBLICATIONS,
  );

  return (
    <>
      {/* The photograph is the office's identity and the search field is the
          most frequent task. The redesign puts the second inside the first so
          the first screen on a phone already does something. */}
      {/* Solid dark base under the photo: without one the scrim would sit on
          the page background and wash out to grey instead of the deep brand
          tone the redesign shows. */}
      <section className="relative overflow-hidden bg-brand-shade">
        {tenant.heroImage && (
          <Image
            src={tenant.heroImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
        <div className="hero-scrim absolute inset-0" />

        <div className="relative mx-auto max-w-6xl px-4 py-10 md:px-10 md:py-20">
          <div className="md:max-w-2xl">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-on-dark-accent md:text-xs">
              {tenant.home.eyebrow}
            </span>
            <h1 className="mt-2 font-serif text-[28px] font-semibold leading-tight text-brand-on-dark-heading md:mt-3.5 md:text-5xl">
              {tenant.home.title}
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-brand-on-dark-body md:mt-3.5 md:max-w-[44ch] md:text-base">
              Fé pública e segurança jurídica para cada ato da vida da
              comunidade
              <span className="md:hidden">
                , sem sair de casa: peça, agende ou acompanhe.
              </span>
              <span className="hidden md:inline">
                .{canLookUp && " Já tem um protocolo? Consulte direto aqui:"}
              </span>
            </p>

            {canLookUp && (
              <>
                <form
                  action={SECTION_ROUTES["consulta-protocolo"]}
                  method="get"
                  className="mt-4 flex gap-1.5 rounded-[13px] bg-brand-card p-1.5 shadow-lg md:mt-5 md:max-w-lg"
                >
                  <label
                    htmlFor="numero"
                    className="flex flex-1 items-center gap-2 px-2"
                  >
                    <Icon
                      name="search"
                      className="h-4 w-4 shrink-0 text-brand-accent"
                    />
                    <span className="sr-only">Número do protocolo</span>
                    <input
                      id="numero"
                      name="numero"
                      type="text"
                      required
                      placeholder="Nº do protocolo"
                      className="w-full bg-transparent text-sm text-brand-text outline-none placeholder:text-brand-faint md:text-[15px]"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-[9px] bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-primary-soft md:px-6"
                  >
                    Consultar
                  </button>
                </form>
                <p className="mt-2 text-[11px] text-brand-on-dark-muted md:text-xs">
                  <span className="md:hidden">
                    Um campo só: pedido (REQ), agendamento (AGD), LGPD (SOL) ou
                    ouvidoria.
                  </span>
                  <span className="hidden md:inline">
                    Informe o protocolo de solicitação de serviço, agendamento,
                    LGPD ou ouvidoria.
                  </span>
                </p>
              </>
            )}

            {/* Desktop keeps the two main tasks inside the hero, as the
                redesign draws; on a phone they are the action cards below. */}
            <div className="mt-6 hidden gap-3 md:flex">
              {isSectionEnabled(tenant, "pedidos") && (
                <Link
                  href={SECTION_ROUTES.pedidos}
                  className="rounded-xl bg-brand-accent-soft px-5 py-3 text-sm font-semibold text-brand-primary hover:bg-brand-card"
                >
                  Solicitar serviço
                </Link>
              )}
              <Link
                href={SECTION_ROUTES.agendamento}
                className="rounded-xl border border-white/50 bg-white/10 px-5 py-3 text-sm font-semibold text-white hover:bg-white/20"
              >
                Agendar atendimento
              </Link>
            </div>
          </div>

          <div className="mt-6 hidden items-center gap-3 rounded-2xl bg-brand-card/95 px-4.5 py-3.5 shadow-xl md:absolute md:right-10 md:bottom-8 md:mt-0 md:inline-flex">
            <Icon name="clock" className="h-5 w-5 text-brand-accent" />
            <div>
              <div className="text-[13px] font-bold text-brand-primary">
                {tenant.openingHours}
              </div>
              <div className="text-[11px] text-brand-muted">
                Atendimento presencial e por telefone
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 md:px-10">
        {/* Auto-fit, so the grid stays whole for an office with two cards and
            for one with three. */}
        <section className="grid gap-2.5 py-5 md:grid-cols-[repeat(auto-fit,minmax(240px,1fr))] md:gap-3.5 md:py-10">
          {cards.map((card) => (
            <Link
              key={card.section}
              href={SECTION_ROUTES[card.section]}
              className={`${card.desktopOnly ? "hidden md:flex" : "flex"} items-center gap-3 rounded-2xl border border-brand-border bg-brand-card p-4 hover:border-brand-accent md:flex-col md:items-start md:gap-0 md:p-5`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-accent md:mb-3 md:h-11 md:w-11">
                <Icon name={card.icon} className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block font-serif text-base font-semibold text-brand-primary md:text-lg">
                  {SECTION_LABELS[card.section]}
                </span>
                <span className="block text-xs text-brand-muted md:mt-1 md:text-[13px]">
                  {card.section === "agendamento"
                    ? tenant.openingHours
                    : card.description}
                </span>
              </span>
              <Icon
                name="arrowRight"
                className="h-4 w-4 text-brand-primary-soft md:hidden"
              />
            </Link>
          ))}
        </section>

        {/* Only exists on the site at all when there is a live publication —
            no publication, no section, same rule as any other optional home
            block (compare `citizenLinks.length > 0` below). */}
        {publications.length > 0 && (
          <section className="pb-6 md:pb-10">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent">
              Proclamas e avisos
            </span>
            <div className="mt-2.5 flex flex-col gap-2.5 md:mt-3.5 md:grid md:grid-cols-2">
              {publications.map((publication) => (
                <div
                  key={publication.id}
                  className="rounded-2xl border border-brand-border bg-brand-card p-4"
                >
                  <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-brand-accent">
                    {
                      PUBLICATION_KIND_LABELS[
                        publication.kind as PublicationKind
                      ]
                    }
                    {publication.publishAt &&
                      ` · ${formatDate(publication.publishAt)}`}
                  </span>
                  <p className="mt-1 text-sm font-semibold text-brand-primary">
                    {publication.title}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-brand-muted">
                    {publication.body}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* On a phone the attributions are their own section; on desktop they
            live inside the "Quem somos" card, the way the redesign draws it. */}
        <section className="pb-6 md:hidden">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent">
            O cartório atende
          </span>
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {tenant.attributions.map((attribution) => (
              <li
                key={attribution}
                data-attribution={attribution}
                className="rounded-lg bg-brand-tint px-2.5 py-1.5 text-xs font-semibold text-brand-primary"
              >
                {ATTRIBUTION_SHORT_NAMES[attribution]}
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-3.5 pb-8 md:grid-cols-2 md:pb-14">
          <div className="order-2 rounded-2xl border border-brand-border bg-brand-card p-5 md:order-1 md:p-6">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent">
              Quem somos
            </span>
            <h2 className="mt-2 font-serif text-xl font-semibold text-brand-primary md:text-2xl">
              {tenant.name}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-brand-muted md:text-[13.5px]">
              O Cartório Marinho é o Ofício Único de Ielmo Marinho / RN,
              serventia dotada de fé pública que reúne as atribuições
              extrajudiciais do município. Sua função é dar segurança jurídica,
              autenticidade e publicidade aos atos da vida do cidadão, do
              nascimento aos negócios.
            </p>
            <ul className="mt-3.5 hidden flex-wrap gap-2 md:flex">
              {tenant.attributions.map((attribution) => (
                <li
                  key={attribution}
                  className="rounded-lg bg-brand-tint px-2.5 py-1.5 text-xs font-semibold text-brand-primary"
                >
                  {ATTRIBUTION_SHORT_NAMES[attribution]}
                </li>
              ))}
            </ul>
          </div>

          {citizenLinks.length > 0 && (
            <div className="order-1 md:order-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent md:hidden">
                Cidadão e transparência
              </span>
              <div className="mt-2.5 overflow-hidden rounded-2xl border border-brand-border bg-brand-card md:mt-0 md:h-full md:px-2 md:pt-5">
                <span className="hidden px-4 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent md:block">
                  Cidadão e transparência
                </span>
                {citizenLinks.map((link) => (
                  <Link
                    key={link.section}
                    href={SECTION_ROUTES[link.section]}
                    className="flex items-center gap-3 border-b border-brand-border px-4 py-3.5 last:border-b-0 hover:bg-brand-tint"
                  >
                    <Icon
                      name={link.icon}
                      className="h-4.5 w-4.5 shrink-0 text-brand-accent md:hidden"
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-brand-primary">
                        {SECTION_LABELS[link.section]}
                      </span>
                      <span className="block text-xs text-brand-muted">
                        {link.description}
                      </span>
                    </span>
                    <Icon
                      name="chevronRight"
                      className="h-4 w-4 text-brand-primary-soft"
                    />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
