import "server-only";
import type { RequerimentoDocument } from "@/core/request/requerimento.ts";
import { type FichaContent, fichaContent } from "@/core/ri/ficha.ts";
import { officialName } from "@/core/tenant/identification.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { db } from "@/db/index.ts";
import { propertyDetailWith } from "./ri.ts";
import { signatureSettingsWith } from "./ri-files.ts";
import { getGuideSettings } from "./tax-guides.ts";

/** Who signs for the RI: the one chosen in its Configurações, from "Quem assina". */
export async function riSignerFor(tenant: Tenant) {
  const [guide, settings] = await Promise.all([
    getGuideSettings(tenant),
    signatureSettingsWith(db, tenant.slug),
  ]);
  const signers = guide.signers.map((s) => ({ name: s.name, title: s.title }));
  const signer = signers[settings.signerIndex] ?? signers[0] ?? null;
  return { signer, signers, settings };
}

/** The ficha of a matrícula, ready for the PDF or the TIFF. */
export async function fichaFor(
  tenant: Tenant,
  propertyId: string,
): Promise<{
  content: FichaContent;
  signatureImage: Uint8Array | null;
  number: number;
} | null> {
  const detail = await propertyDetailWith(db, tenant.slug, propertyId);
  if (!detail || detail.property.deletedAt) return null;
  const { signer, settings } = await riSignerFor(tenant);
  return {
    content: fichaContent({
      office: {
        name: officialName(tenant),
        city: tenant.location.city,
        state: tenant.location.state,
      },
      property: detail.property,
      acts: detail.acts,
      signer,
    }),
    signatureImage: settings.signatureImage,
    number: detail.property.number,
  };
}

/** The ficha in the panel's document model (the same as every PDF). */
export function fichaDocument(
  tenant: Tenant,
  content: FichaContent,
  signatureImage: Uint8Array | null,
): RequerimentoDocument {
  return {
    eyebrow: `Registro de Imóveis · ${content.book}`,
    title: content.title,
    subtitle: content.cnm ? `CNM ${content.cnm}` : "CNM não lançado",
    office: [content.office, tenant.subtitle],
    sections: content.blocks.map((block) => ({
      heading: block.meta ? `${block.label} · ${block.meta}` : block.label,
      paragraphs: block.text.split("\n").filter(Boolean),
    })),
    signee: content.signer?.name,
    signatureImage: signatureImage ?? undefined,
    signature: content.signer ? [content.signer.title] : [],
    footer: `${content.office} · ${tenant.legalFooter}`,
  };
}
