import { TJ_LOOKUP_URL } from "@/lib/tj-seal.ts";
import { publicMetadata } from "../_lib/metadata.ts";
import { requireSection } from "../_lib/section.ts";
import { SealLookup } from "./seal-lookup.tsx";

export const generateMetadata = publicMetadata("/selo");

// Pinned to gru1 in vercel.json, like captcha/route.ts: this function also
// runs the lookup action, which submits on the TJ session opened there, and
// both have to leave from the same region.

export default async function DigitalSealPage() {
  const tenant = await requireSection("selo-tjrn");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-10 md:py-10">
      <SealLookup tenantName={tenant.name} officialUrl={TJ_LOOKUP_URL} />
    </div>
  );
}
