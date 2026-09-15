import { TJ_LOOKUP_URL } from "@/lib/tj-seal.ts";
import { publicMetadata } from "../_lib/metadata.ts";
import { requireSection } from "../_lib/section.ts";
import { SealLookup } from "./seal-lookup.tsx";

export const generateMetadata = publicMetadata("/selo");

export default async function DigitalSealPage() {
  const tenant = await requireSection("selo-tjrn");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">
      <SealLookup tenantName={tenant.name} officialUrl={TJ_LOOKUP_URL} />
    </div>
  );
}
