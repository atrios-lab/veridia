import Link from "next/link";
import {
  PLATFORM_CHANNEL_RULE,
  PLATFORM_DATA_PROTECTION,
  PLATFORM_MOTTO,
  PLATFORM_SECURITY_STATEMENT,
  PLATFORM_STATEMENT,
} from "@/core/acts/catalog.ts";
import { getTenant } from "@/lib/tenant.ts";

export const metadata = { title: "Sobre a plataforma" };

// Fixed institutional text, the serventia's own wording, shared by every
// tenant like the privacy policy is; only the office's name is interpolated.
// The sentences live in the catalogue next to the ones the declaração's
// carimbo prints, so the paper and the site never say different things about
// the same platform. Outside the section gating on purpose: there is no
// tenant for which "what this site is" should be hidden.
export default async function PlatformPage() {
  const tenant = await getTenant();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-10 md:py-16">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-accent-ink">
        {tenant.name}
      </span>
      <h1 className="mt-2 font-serif text-2xl font-semibold text-brand-primary md:text-3xl">
        Plataforma Eletrônica Oficial da Serventia
      </h1>
      <p className="mt-3 max-w-[65ch] leading-relaxed text-brand-muted">
        Este site é o canal próprio da serventia para pedir e acompanhar
        serviços eletrônicos. Esta página diz sob qual norma ele existe, por
        onde os pedidos entram e como os seus dados são tratados.
      </p>

      <div className="mt-8 flex flex-col gap-8 text-sm leading-relaxed text-brand-text-soft">
        <section>
          <h2 className="font-serif text-lg font-semibold text-brand-primary">
            O que é esta plataforma
          </h2>
          <p className="mt-3">{PLATFORM_STATEMENT}</p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-brand-primary">
            Por onde os pedidos entram
          </h2>
          <p className="mt-3">{PLATFORM_CHANNEL_RULE}</p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-brand-primary">
            Segurança e rastreabilidade
          </h2>
          <p className="mt-3">{PLATFORM_SECURITY_STATEMENT}</p>
          <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-brand-accent-ink">
            {PLATFORM_MOTTO}
          </p>
        </section>

        <section>
          <h2 className="font-serif text-lg font-semibold text-brand-primary">
            Seus dados
          </h2>
          <p className="mt-3">
            {PLATFORM_DATA_PROTECTION} O detalhe do que é coletado, para quê e
            por quanto tempo está na{" "}
            <Link
              href="/privacidade"
              className="font-semibold text-brand-primary-soft hover:underline"
            >
              política de privacidade
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
