import { requireSection } from "../_lib/section.ts";
import { ManifestationScreen } from "./manifestation-form.tsx";

export const metadata = { title: "Ouvidoria" };

export default async function OmbudsmanPage() {
  await requireSection("ouvidoria");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">
      <ManifestationScreen />
    </div>
  );
}
