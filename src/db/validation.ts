import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { auditLog, tenantBranding, tenantContent } from "./schema.ts";

// One validation stack from the form to the database: the shape comes from
// the table, and only the business rules are written by hand on top.

export const tenantBrandingSelectSchema = createSelectSchema(tenantBranding);
export const tenantBrandingInsertSchema = createInsertSchema(tenantBranding, {
  tenantSlug: (s) => s.min(1),
});

export const tenantContentSelectSchema = createSelectSchema(tenantContent);
export const tenantContentInsertSchema = createInsertSchema(tenantContent, {
  tenantSlug: (s) => s.min(1),
  key: (s) => s.min(1),
})
  // Publishing is a copy, so a published row without a date is a row nobody
  // can audit. Refuse it here rather than discovering it in the trail later.
  .refine((row) => !row.published || row.publishedAt != null, {
    message: "Conteúdo publicado exige a data de publicação.",
    path: ["publishedAt"],
  });

export const auditLogSelectSchema = createSelectSchema(auditLog);
export const auditLogInsertSchema = createInsertSchema(auditLog, {
  action: (s) => s.min(1),
  targetType: (s) => s.min(1),
}).extend({
  // The trail records what happened, never the payload. Anything that could
  // carry a password or a document body is refused at the boundary.
  actorId: z.string().min(1).nullable(),
});

export type TenantBrandingRow = z.infer<typeof tenantBrandingSelectSchema>;
export type TenantContentRow = z.infer<typeof tenantContentSelectSchema>;
export type AuditLogRow = z.infer<typeof auditLogSelectSchema>;
