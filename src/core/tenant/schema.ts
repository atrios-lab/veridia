import { z } from "zod";

// The six legal attributions of a Brazilian extrajudicial notary office.
// Official acronyms, never translated: they are the legal identifiers.
export const ATTRIBUTIONS = [
  "RCPN",
  "NOTAS",
  "RI",
  "PROTESTO",
  "RTD",
  "RCPJ",
] as const;
export const AttributionSchema = z.enum(ATTRIBUTIONS);
export type Attribution = z.infer<typeof AttributionSchema>;

// Sections of the public site. The values are route slugs, so they stay in
// Portuguese: they are user visible URLs, not identifiers.
export const SECTIONS = [
  "inicio",
  "dpo-lgpd",
  "pedidos",
  "consulta-protocolo",
  "ouvidoria",
  "transparencia",
  "editais",
  "selo-tjrn",
  "centrais-contato",
] as const;
export const SectionSchema = z.enum(SECTIONS);
export type Section = z.infer<typeof SectionSchema>;

export const OwnerStatusSchema = z.enum(["provido", "interino", "a confirmar"]);

export const TenantSchema = z.object({
  slug: z.string().min(1),
  hosts: z.array(z.string()).default([]),
  name: z.string().min(1),
  subtitle: z.string().min(1),
  cns: z.string().min(1),
  attributions: z.array(AttributionSchema).nonempty(),
  contacts: z.object({
    phone: z.string().min(1),
    whatsapp: z.string().min(1),
    email: z.email(),
  }),
  openingHours: z.string().min(1),
  owner: z.object({
    name: z.string().min(1),
    status: OwnerStatusSchema,
  }),
  // Data protection officer. Required by LGPD art. 41 §3: this is an
  // institutional channel, never a personal address.
  dpo: z.object({
    name: z.string().min(1),
    email: z.email(),
  }),
  // ISS rate as a decimal (5% = 0.05). Municipal parameter, per office.
  issRate: z.number().min(0).max(1),
  logos: z.object({
    light: z.string().min(1), // logo for light backgrounds
    dark: z.string().min(1), // logo for dark backgrounds
    seal: z.string().min(1), // sublogo, used as favicon and watermark
  }),
  legalFooter: z.string().min(1),
  // Override: turns sections off even when the attribution grants them.
  // It never turns a section on beyond the gate.
  disabledSections: z.array(SectionSchema).default([]),
});

export type Tenant = z.infer<typeof TenantSchema>;

/** Validates a raw config and returns the typed object, or throws. */
export function parseTenant(raw: unknown): Tenant {
  return TenantSchema.parse(raw);
}
