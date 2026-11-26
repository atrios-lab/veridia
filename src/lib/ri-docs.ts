import "server-only";
import type { RequerimentoDocument } from "@/core/request/requerimento.ts";
import { type FichaContent, fichaContent } from "@/core/ri/ficha.ts";
import { type Requirement, requirementNote } from "@/core/ri/protocol.ts";
import { officialName } from "@/core/tenant/identification.ts";
import type { Tenant } from "@/core/tenant/schema.ts";
import { formatOfficeDate } from "@/core/time/office-time.ts";
import { db } from "@/db/index.ts";
import { propertyDetailWith } from "./ri.ts";
import { signatureSettingsWith } from "./ri-files.ts";
import { protocolWith } from "./ri-protocols.ts";
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

/**
 * The nota devolutiva of a protocolo (Lei nº 6.015/1973, art. 198): every
 * exigência at once, in order, with its source, what the apresentante may
 * do and until when the prenotação lasts. Signed by who signs for the RI.
 */
export async function noteDocumentFor(
  tenant: Tenant,
  protocolId: string,
  withImage: boolean,
): Promise<{ document: RequerimentoDocument; number: number } | null> {
  const row = await protocolWith(db, tenant.slug, protocolId);
  if (!row || row.voidedAt) return null;
  const requirements = (row.requirements as Requirement[]) ?? [];
  if (requirements.length === 0) return null;
  const { signer, settings } = await riSignerFor(tenant);
  const office = officialName(tenant);
  const sections = requirementNote({
    protocolNumber: row.number,
    presentedOn: row.presentedOn,
    titleKind: row.titleKind,
    presenter: row.presenterName,
    requirements,
    prenotationEnds: row.prenotationEnds ?? row.presentedOn,
  });
  const issued = row.requirementIssuedAt ?? new Date();
  return {
    number: row.number,
    document: {
      eyebrow: "Registro de Imóveis · Nota devolutiva",
      title: `Nota devolutiva · Protocolo nº ${row.number.toLocaleString("pt-BR")}`,
      subtitle: `Lei nº 6.015/1973, art. 198 · emitida em ${formatOfficeDate(issued)}`,
      office: [office, tenant.subtitle],
      sections:
        row.kind === "exame"
          ? sections.filter((s) => s.heading !== "O que fazer")
          : sections,
      signee: signer?.name,
      signatureImage: withImage
        ? (settings.signatureImage ?? undefined)
        : undefined,
      signature: signer ? [signer.title] : [],
      footer: `${office} · ${tenant.legalFooter}`,
    },
  };
}
