import { SECTION_LABELS } from "@/core/tenant/gating.ts";
import type { Section } from "@/core/tenant/schema.ts";
import { requireSection } from "../_lib/section.ts";
import { Icon } from "./icon.tsx";

/**
 * Placeholder for a section this office already offers but the site does not
 * serve yet. It exists so the navigation can tell the truth about what the
 * office does while the flow is still being built: a menu that hides the
 * section reads as "we do not do that", and a link to nothing reads worse.
 */
export async function ComingSoon({
  section,
  description,
  children,
}: {
  section: Section;
  description: string;
  /** What the office can already publish about the section today. */
  children?: React.ReactNode;
}) {
  const tenant = await requireSection(section);

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 md:px-10 md:py-20">
      <span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-accent">
        {tenant.name}
      </span>
      <h1 className="mt-2 font-serif text-3xl font-semibold text-brand-primary">
        {SECTION_LABELS[section]}
      </h1>
      <p className="mt-3 leading-relaxed text-brand-muted">{description}</p>

      <div className="mt-8 rounded-2xl border border-brand-border bg-brand-card p-5">
        <div className="flex items-center gap-3">
          <Icon name="clock" className="h-5 w-5 text-brand-accent" />
          <h2 className="font-serif text-lg font-semibold text-brand-primary">
            Disponível em breve pelo site
          </h2>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-brand-muted">
          Enquanto esta página não entra no ar, fale com a serventia pelos
          canais oficiais. O atendimento presencial e por telefone segue normal.
        </p>
        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex gap-2">
            <dt className="font-semibold text-brand-primary">Telefone:</dt>
            <dd className="text-brand-text-soft">{tenant.contacts.phone}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold text-brand-primary">WhatsApp:</dt>
            <dd className="text-brand-text-soft">{tenant.contacts.whatsapp}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold text-brand-primary">E-mail:</dt>
            <dd className="text-brand-text-soft">{tenant.contacts.email}</dd>
          </div>
          <div className="flex gap-2">
            <dt className="font-semibold text-brand-primary">Atendimento:</dt>
            <dd className="text-brand-text-soft">{tenant.openingHours}</dd>
          </div>
        </dl>
      </div>

      {children}
    </div>
  );
}
