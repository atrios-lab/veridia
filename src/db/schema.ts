import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Every table carries the office slug. The slug is not a foreign key: the
// office registry is config as code, in src/core/tenant, and the database
// only stores what an office overrides on top of it.
const tenantSlug = text("tenant_slug").notNull();

/**
 * Branding overrides for an office. One row per office, and absent means
 * "use the values from the config file".
 */
export const tenantBranding = pgTable(
  "tenant_branding",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    tokens: jsonb("tokens").notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text("updated_by"),
  },
  (t) => [uniqueIndex("tenant_branding_tenant_slug_key").on(t.tenantSlug)],
);

/**
 * Editable content, keyed by office and content key. Draft and published are
 * separate columns so an office can save work in progress without it going
 * live, and so publishing is a copy rather than a state flag to get wrong.
 */
export const tenantContent = pgTable(
  "tenant_content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    key: text("key").notNull(),
    draft: jsonb("draft"),
    published: jsonb("published"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text("updated_by"),
  },
  (t) => [uniqueIndex("tenant_content_tenant_key").on(t.tenantSlug, t.key)],
);

/**
 * Audit trail. Actor, action, target and date, and nothing else: no password,
 * no token, no document content. Anything richer belongs in the record it
 * describes, not in the trail that has to survive an audit.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    actorId: text("actor_id"),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("audit_log_tenant_created_at").on(t.tenantSlug, t.createdAt)],
);

/**
 * Everything a citizen files with the office: the service request, the
 * appointment, the data rights requirement and the ombudsman manifestation.
 * There is no account behind any of them: the protocol number says which
 * record and the access key says it is theirs, which is why the key is stored
 * as a hash and never in the clear.
 *
 * One table, four kinds, because they share the protocol, the key, the
 * attachments and the consult screen. What differs is a handful of fields,
 * kept in `details` and parsed by the core on the way in and out. The columns
 * that only some kinds fill (act, name, contact, key) accept null: an
 * appointment has no act, and an anonymous manifestation has no name, no
 * contact and no key. What is required of each kind is enforced by the core,
 * which is where the rule can be read.
 *
 * The act is kept by id, not by foreign key: the catalogue is config as code,
 * and a request has to survive the act being renamed or retired.
 */
export const serviceRequests = pgTable(
  "service_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    // "service-request" is the default so every row filed before the other
    // channels existed classifies itself correctly.
    kind: text("kind").notNull().default("service-request"),
    // Year and sequence are stored apart from the printed number because the
    // sequence restarts every year and the uniqueness has to be enforced on
    // the pair, not on the string.
    protocolYear: integer("protocol_year").notNull(),
    protocolSequence: integer("protocol_sequence").notNull(),
    protocolNumber: text("protocol_number").notNull(),
    actId: text("act_id"),
    attribution: text("attribution"),
    applicantName: text("applicant_name"),
    contact: text("contact"),
    cpf: text("cpf"),
    description: text("description"),
    purpose: text("purpose"),
    parameterValue: text("parameter_value"),
    accessKeyHash: text("access_key_hash"),
    // What belongs to one kind only: day and band of an appointment, the right
    // chosen in the data rights channel, the type and the secrecy of a
    // manifestation. Never read raw: the core parses it.
    details: jsonb("details").notNull().default(sql`'{}'::jsonb`),
    // What the office writes back: the officer's answer, the ombudsman's
    // answer. The proposal of another band lives in `details`, next to the
    // band it replaces.
    officeReply: text("office_reply"),
    officeRepliedAt: timestamp("office_replied_at", { withTimezone: true }),
    status: text("status").notNull().default("new"),
    // Null until the office informs it. A service request is never priced by
    // the citizen's own submission — only the operator, working the request,
    // knows what band or table applies.
    amountCents: integer("amount_cents"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // The office's counter for the year, one per kind: AGD.2026.000067 and
    // SOL.2026.000031 are different books. Two records racing for the same
    // number lose here rather than in the filing cabinet.
    uniqueIndex("service_requests_tenant_kind_year_sequence").on(
      t.tenantSlug,
      t.kind,
      t.protocolYear,
      t.protocolSequence,
    ),
    uniqueIndex("service_requests_tenant_protocol").on(
      t.tenantSlug,
      t.protocolNumber,
    ),
    index("service_requests_tenant_created_at").on(t.tenantSlug, t.createdAt),
  ],
);

/**
 * Files attached to a request: what the citizen sent with it, and the signed
 * form when it comes back. The path is where the bytes are (disk or blob) and
 * it never reaches the browser; the browser gets the positional display name.
 */
export const serviceRequestAttachments = pgTable(
  "service_request_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    // "citizen" for what came with the request, "signed-form" for the signed
    // requerimento, "office" for what the office delivers back.
    kind: text("kind").notNull().default("citizen"),
    storedName: text("stored_name").notNull(),
    displayName: text("display_name").notNull(),
    path: text("path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("service_request_attachments_request").on(t.requestId)],
);

/**
 * A requirement (exigência) the office raises on a service request: something
 * missing before the request can move forward. It has its own row, not a
 * field in `details`, because both sides write it — the office registers it,
 * the citizen resolves it from the protocol consult — and a JSON blob shared
 * by two writers is how one overwrites the other.
 */
export const serviceRequestRequirements = pgTable(
  "service_request_requirements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    status: text("status").notNull().default("pending"),
    // Set once the citizen's answer is attached; the row that answers it.
    resolutionAttachmentId: uuid("resolution_attachment_id").references(
      () => serviceRequestAttachments.id,
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
  },
  (t) => [index("service_request_requirements_request").on(t.requestId)],
);
