import { publicDpo } from "@/lib/team.ts";
import { publicMetadata } from "../_lib/metadata.ts";
import { requireSection } from "../_lib/section.ts";
import { DataRightsScreen } from "./data-rights-form.tsx";

export const generateMetadata = publicMetadata("/lgpd");

export default async function DpoPage() {
  // The officer's name and institutional address are published because LGPD
  // art. 41 §1 requires it, and they come from the office's configuration:
  // another office serves the same page with its own officer.
  const tenant = await requireSection("dpo-lgpd");
  // The Encarregado marked in the team (Configurações › Equipe) lends the
  // photo, when it may be public (decision of 27/11/2026).
  const dpo = await publicDpo(tenant.slug);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">
      <DataRightsScreen
        dpoName={tenant.dpo.name}
        dpoPhoto={dpo?.photo ? `/equipe/foto/${dpo.id}` : null}
        dpoEmail={tenant.dpo.email}
        phone={tenant.contacts.phone}
      />
    </div>
  );
}
