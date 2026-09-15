import { publicMetadata } from "../_lib/metadata.ts";
import { requireSection } from "../_lib/section.ts";
import { DataRightsScreen } from "./data-rights-form.tsx";

export const generateMetadata = publicMetadata("/lgpd");

export default async function DpoPage() {
  // The officer's name and institutional address are published because LGPD
  // art. 41 §3 requires it, and they come from the office's configuration:
  // another office serves the same page with its own officer.
  const tenant = await requireSection("dpo-lgpd");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">
      <DataRightsScreen
        dpoName={tenant.dpo.name}
        dpoEmail={tenant.dpo.email}
        phone={tenant.contacts.phone}
      />
    </div>
  );
}
