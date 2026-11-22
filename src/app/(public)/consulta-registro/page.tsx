import { notFound } from "next/navigation";
import { publicLookupEnabled } from "@/lib/rcpn-lookup.ts";
import { getTenant } from "@/lib/tenant.ts";
import { publicMetadata } from "../_lib/metadata.ts";
import { LookupForm } from "./lookup-form.tsx";

export const generateMetadata = publicMetadata("/consulta-registro");

/**
 * "Seu registro é daqui?" (change `consulta-de-registro-rcpn`, phase 2):
 * the Registro Civil index answers on the spot whether a registro is here
 * and the profession it states, without a request. Only where the office
 * has the Registro Civil and keeps the lookup switched on.
 */
export default async function RegistroLookupPage() {
  const tenant = await getTenant();
  if (
    !tenant.attributions.includes("RCPN") ||
    !(await publicLookupEnabled(tenant.slug).catch(() => false))
  ) {
    notFound();
  }
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 md:px-10 md:py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-accent-ink">
        Registro Civil
      </p>
      <h1 className="mt-1 font-serif text-3xl font-semibold text-brand-primary">
        Seu registro é daqui?
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-muted">
        Consulte na hora se um registro de nascimento, casamento ou óbito está
        no {tenant.name} e qual profissão consta nele. Informe o nome completo e
        o nome completo da mãe, como estão no documento; a data de nascimento
        ajuda, mas não é obrigatória. Não precisa de requerimento.
      </p>
      <div className="mt-6">
        <LookupForm />
      </div>
    </div>
  );
}
