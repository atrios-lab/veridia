import { z } from "zod";
import {
  isValidPixCity,
  isValidPixKey,
  PIX_CITY_MAX_LENGTH,
  PixKeyTypeSchema,
} from "./pix.ts";

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
  "agendamento",
  "consulta-protocolo",
  "ouvidoria",
  "transparencia",
  "editais",
  "selo-tjrn",
  "centrais-contato",
] as const;
export const SectionSchema = z.enum(SECTIONS);
export type Section = z.infer<typeof SectionSchema>;

// The visual themes an office may pick. Structure and journey are identical
// across them: a theme only swaps the palette and the serif face, and both
// live in the stylesheet. Registering an office is picking one of these, never
// writing CSS. The values are theme identifiers, kept in Portuguese because
// they name colours the registrar recognises.
export const THEMES = [
  "verde-dourado",
  "marinho-bronze",
  "vinho-perola",
  "grafite-cobre",
  "oliva-terracota",
] as const;
export const ThemeSchema = z.enum(THEMES, "Escolha o estilo do site.");
export type Theme = z.infer<typeof ThemeSchema>;

export const OwnerStatusSchema = z.enum(["provido", "interino", "a confirmar"]);

export const TenantSchema = z.object({
  slug: z.string().min(1),
  hosts: z.array(z.string()).default([]),
  name: z.string().min(1),
  subtitle: z.string().min(1),
  // The "Quem somos" paragraph on the home page. Per office: it describes
  // the serventia itself, so there is no sensible shared default.
  about: z.string().min(1, "Escreva o texto de apresentação do cartório."),
  cns: z.string().min(1),
  attributions: z.array(AttributionSchema).nonempty(),
  contacts: z.object({
    phone: z.string().min(1, "Informe o telefone."),
    whatsapp: z.string().min(1, "Informe o WhatsApp."),
    email: z.email("Informe um e-mail válido."),
  }),
  openingHours: z.string().min(1, "Informe o horário de atendimento."),
  // The same counter hours as the sentence above, in numbers, because the
  // appointment bands need arithmetic and reading a number out of Portuguese
  // prose breaks on the first office that writes it differently. The sentence
  // stays: it is what the citizen reads.
  scheduling: z
    .object({
      startHour: z.number().int().min(0).max(23).default(8),
      endHour: z.number().int().min(1).max(24).default(14),
      // How many appointments the office takes inside one hour long band.
      capacityPerSlot: z.number().int().min(1).default(2),
    })
    .refine((s) => s.endHour > s.startHour, {
      message: "A hora de encerramento tem de ser depois da de abertura.",
    })
    .default({ startHour: 8, endHour: 14, capacityPerSlot: 2 }),
  owner: z.object({
    name: z.string().min(1),
    status: OwnerStatusSchema,
  }),
  // Data protection officer. Required by LGPD art. 41 §3: this is an
  // institutional channel, never a personal address.
  dpo: z.object({
    name: z.string().min(1, "Informe o nome do encarregado."),
    email: z.email("Informe um e-mail válido."),
  }),
  // ISS rate as a decimal (5% = 0.05). Municipal parameter, per office.
  issRate: z.number().min(0).max(1),
  theme: ThemeSchema,
  logos: z.object({
    light: z.string().min(1), // logo for light backgrounds
    dark: z.string().min(1), // logo for dark backgrounds
    // Sublogo, used as favicon, watermark, and the admin login panel. Same
    // light/dark split as the main logo above, for the same reason: the
    // admin panel's institutional side is a fixed dark background, never the
    // tenant's own theme.
    seal: z.object({
      light: z.string().min(1),
      dark: z.string().min(1),
    }),
  }),
  // Photograph behind the home hero. Optional: an office that has not sent
  // one yet gets the plain gradient, which is a worse hero but never a
  // broken one.
  heroImage: z.string().min(1).optional(),
  // The two lines of text on the home hero. `eyebrow` defaults because every
  // office reads the same one today; `title` has no default because it has
  // always varied per office (it used to just be `subtitle`), so each tenant
  // config states it explicitly.
  home: z.object({
    eyebrow: z
      .string()
      .min(1, "Informe a frase de destaque.")
      .default("Serviços notariais e de registro"),
    title: z.string().min(1, "Informe o título de boas-vindas."),
  }),
  legalFooter: z.string().min(1),
  // Override: turns sections off even when the attribution grants them.
  // It never turns a section on beyond the gate.
  disabledSections: z.array(SectionSchema).default([]),
  // The office's Pix key, where the citizen's payment lands. Optional: most
  // offices have not registered one yet, and "no key" is a permanent, valid
  // state, not a transition. The key is validated against its own type
  // below, and stored normalized (see `normalizePixKey`).
  pix: z
    .object({
      type: PixKeyTypeSchema,
      key: z.string().min(1, "Informe a chave."),
      // Merchant City of the Pix EMV payload. Optional here, not because a
      // charge can be built without it (it can't — see pix-charge.ts), but
      // because offices that registered a key before this field existed have
      // it absent in the JSONB row, with no migration to backfill. Required
      // at save time instead (cobranca/actions.ts); a key with no city just
      // means no QR yet, never a key that fails to load.
      city: z.string().optional(),
    })
    .superRefine((value, ctx) => {
      if (!isValidPixKey(value.type, value.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["key"],
          message:
            "Isso não parece uma chave Pix válida para o tipo escolhido.",
        });
      }
      if (value.city !== undefined && !isValidPixCity(value.city)) {
        ctx.addIssue({
          code: "custom",
          path: ["city"],
          message: `A cidade deve ter até ${PIX_CITY_MAX_LENGTH} caracteres (sem acento).`,
        });
      }
    })
    .optional(),
});

export type Tenant = z.infer<typeof TenantSchema>;

/** Validates a raw config and returns the typed object, or throws. */
export function parseTenant(raw: unknown): Tenant {
  return TenantSchema.parse(raw);
}
