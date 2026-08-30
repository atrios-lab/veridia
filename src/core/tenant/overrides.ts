import type { z } from "zod";
import { MANDATORY_SECTIONS } from "./gating.ts";
import { CounterHoursSchema, type Tenant, TenantSchema } from "./schema.ts";

/**
 * What an office may change about itself from the panel: the counter hours,
 * as the sentence the citizen reads and as the numbers the site computes
 * with, plus the three contact channels. Everything else about the office
 * stays config as code.
 *
 * The two halves of the schedule travel together on purpose. While only the
 * sentence was editable, an office that started closing at 17h could correct
 * the sentence and nothing else: the site went on saying "fecha às 14h" and
 * the chat went on closing then, and no one at the counter could reach the
 * numbers to fix it.
 *
 * Derived from TenantSchema by pick rather than restated, so a change to
 * `contacts` reaches the panel on its own. The pick is also what makes a
 * forged save harmless: name, CNS and attributions are not in the shape, so
 * the parse drops them before anything is written.
 */
export const OfficeContactSchema = TenantSchema.pick({
  openingHours: true,
  counterHours: true,
  contacts: true,
});
export type OfficeContact = z.infer<typeof OfficeContactSchema>;

/**
 * The stored shape. Partial because a row written by an older or newer
 * version of the panel may carry only one of the two blocks, and one known
 * block is worth more than discarding both.
 */
export const OfficeContactOverrideSchema = OfficeContactSchema.partial().extend(
  {
    // Without the default, so a row saved before the hours were editable
    // leaves the office's own hours standing instead of being handed 8h-14h.
    counterHours: CounterHoursSchema.optional(),
  },
);

/**
 * What an office may change about how it presents itself: theme, logos, the
 * home hero (photo and its two lines of text), and which optional sections
 * are switched off. Same pick discipline as OfficeContactSchema: name, CNS
 * and attributions are not in the shape, so a forged save cannot reach them.
 *
 * `disabledSections` is refined here, not just in gating: a mandatory section
 * listed as disabled must fail the save outright, rather than be silently
 * accepted and only ignored later by `isSectionEnabled`. Belt and suspenders
 * on purpose: one row written into the database by hand should not be able
 * to take a legally required channel off the air even for a moment.
 */
export const OfficeBrandSchema = TenantSchema.pick({
  theme: true,
  logos: true,
  heroImage: true,
  home: true,
  disabledSections: true,
}).extend({
  disabledSections: TenantSchema.shape.disabledSections.refine(
    (sections) => sections.every((s) => !MANDATORY_SECTIONS.includes(s)),
    { message: "Uma seção obrigatória não pode ser desligada." },
  ),
});
export type OfficeBrand = z.infer<typeof OfficeBrandSchema>;

/** Same partial-for-reading discipline as OfficeContactOverrideSchema. */
export const OfficeBrandOverrideSchema = OfficeBrandSchema.partial();

/**
 * What an office may change about its Data Protection Officer: the name and
 * institutional e-mail LGPD art. 41 §3 requires it to publish. Same pick
 * discipline as the other two: nothing else in `Tenant` is reachable through
 * this shape.
 */
export const OfficeDpoSchema = TenantSchema.pick({ dpo: true });
export type OfficeDpo = z.infer<typeof OfficeDpoSchema>;

/** Same partial-for-reading discipline as OfficeContactOverrideSchema. */
export const OfficeDpoOverrideSchema = OfficeDpoSchema.partial();

/**
 * What an office may change about where the citizen's payment lands: its own
 * Pix key. Same pick discipline as the other three, with `pix` made
 * required: `TenantSchema` allows an office to have none at all, but a save
 * always submits one type and one key, and there is no "half a Pix key" to
 * write. `removePixKey` is the separate action that takes the key away.
 */
export const OfficePixSchema = TenantSchema.pick({ pix: true }).extend({
  pix: TenantSchema.shape.pix.unwrap(),
});
export type OfficePix = z.infer<typeof OfficePixSchema>;

/** Same partial-for-reading discipline as OfficeContactOverrideSchema. */
export const OfficePixOverrideSchema = OfficePixSchema.partial();

/**
 * What an office may change about how long it takes: the term it expects to
 * answer a service request within. Same pick discipline as the others.
 *
 * Only the service request's term is here. The data rights channel's fifteen
 * days are Lei 13.709 art. 19's, not the office's, and are deliberately not
 * reachable from the panel.
 */
export const OfficeDeadlineSchema = TenantSchema.pick({
  requestDeadlineDays: true,
});
export type OfficeDeadline = z.infer<typeof OfficeDeadlineSchema>;

/** Same partial-for-reading discipline as OfficeContactOverrideSchema. */
export const OfficeDeadlineOverrideSchema = OfficeDeadlineSchema.partial();

/**
 * Lays the office's own edits over its configuration.
 *
 * Each row that fails to parse is ignored rather than thrown: an override is
 * noise on top of a base that is always valid, and a corrupted JSON blob must
 * not be able to take the public site down. Absent, null and malformed all
 * mean the same thing here: use the config. The two rows are independent: a
 * corrupted brand row does not take the contact override down with it, or the
 * other way around.
 *
 * Attributions are deliberately not overridable, here or anywhere. They are a
 * delegation from the court, and they decide which sections the public site
 * offers and which acts a citizen may ask for. The pick in both schemas above
 * is what keeps that true even for a row someone writes into the database by
 * hand.
 *
 * A record, not positional arguments: four `unknown` blobs in a row is a
 * trap where swapping two by mistake still compiles. Each key is independent
 * of the others, same as the two original blocks: a corrupted DPO row does
 * not take the Pix override down with it, or the other way around.
 */
export function applyTenantOverrides(
  tenant: Tenant,
  overrides: {
    contact?: unknown;
    brand?: unknown;
    dpo?: unknown;
    pix?: unknown;
    deadline?: unknown;
  },
): Tenant {
  let merged = tenant;

  const contact = OfficeContactOverrideSchema.safeParse(overrides.contact);
  if (contact.success) merged = { ...merged, ...contact.data };

  const brand = OfficeBrandOverrideSchema.safeParse(overrides.brand);
  if (brand.success) merged = { ...merged, ...brand.data };

  const dpo = OfficeDpoOverrideSchema.safeParse(overrides.dpo);
  if (dpo.success) merged = { ...merged, ...dpo.data };

  const pix = OfficePixOverrideSchema.safeParse(overrides.pix);
  if (pix.success) merged = { ...merged, ...pix.data };

  const deadline = OfficeDeadlineOverrideSchema.safeParse(overrides.deadline);
  if (deadline.success) merged = { ...merged, ...deadline.data };

  return merged;
}
