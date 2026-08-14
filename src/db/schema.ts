import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.ts";

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
    // Set only on the form the office attaches to a requirement, for the
    // citizen to print and present. Such a file belongs to the requirement,
    // not to the request's delivery list: it never shows up in "Entrega ao
    // cidadão" and it goes when the requirement goes. Null on every other
    // attachment, which is what every existing row is.
    requirementId: uuid("requirement_id").references(
      (): AnyPgColumn => serviceRequestRequirements.id,
      { onDelete: "cascade" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("service_request_attachments_request").on(t.requestId),
    index("service_request_attachments_requirement").on(t.requirementId),
  ],
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

/**
 * One message in the question-and-answer thread attached to a service
 * request — not a live chat: the citizen posts, the office replies in its
 * own time. Its own row for the same reason `serviceRequestRequirements`
 * has one instead of a field in `details`: both sides write here, and a
 * JSON blob shared by two writers is how one overwrites the other.
 */
export const serviceRequestQuestions = pgTable(
  "service_request_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    // "citizen" or "staff" — see QUESTION_AUTHOR_TYPES in
    // src/core/request/question.ts.
    authorType: text("author_type").notNull(),
    // Set only on a staff reply; null on the citizen's own messages, who has
    // no account to reference.
    authorId: text("author_id").references(() => user.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("service_request_questions_request_created_at").on(
      t.requestId,
      t.createdAt,
    ),
  ],
);

/**
 * What a serventia publishes to the "Proclamas e avisos" home section:
 * marriage banns, a general notice, or a formal notice. `publishAt` and
 * `expireAt` are calendar dates, not instants — a publication is on the site
 * for whole days, read on the wall calendar of the office, same discipline as
 * `IsoDate` in `src/core/scheduling/calendar.ts`. Null `publishAt` is a
 * draft; state (draft/scheduled/live/archived) is never stored, only
 * computed from these dates and `archivedAt` — see
 * `src/core/publications/state.ts`.
 */
export const officePublications = pgTable(
  "office_publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    kind: text("kind").notNull(),
    // Which sector of the public notices page this belongs to. Null on
    // notices (home-only) and on rows older than the column; banns are
    // always "proclamas", written by the form schema, not trusted from UI.
    sector: text("sector"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // The signed edital itself, optional. Same column shape as the chat
    // message attachment: the file hangs off the row it belongs to, and the
    // body stays required — the document is the proof, not the reading.
    attachmentStoredName: text("attachment_stored_name"),
    attachmentDisplayName: text("attachment_display_name"),
    attachmentPath: text("attachment_path"),
    attachmentMimeType: text("attachment_mime_type"),
    attachmentSizeBytes: integer("attachment_size_bytes"),
    publishAt: date("publish_at"),
    expireAt: date("expire_at"),
    // Set only by manual archiving ("Arquivar agora"); automatic expiry is a
    // read-time calculation and never writes here.
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("office_publications_tenant_publish_at").on(
      t.tenantSlug,
      t.publishAt,
    ),
  ],
);

/**
 * A live conversation between a citizen and the office's support chat.
 * Unlike the four kinds in `service_requests` — one submission, one eventual
 * reply — a conversation has many messages, an attendant that can change
 * mid-life (transfer), and both sides poll it at once. That shape is why it
 * is its own table instead of a fifth request kind — see
 * add-support-chat/design.md.
 *
 * There is deliberately no protocol number and no access key here: the
 * citizen only needs this to survive a reload of the same browser tab, not
 * to prove ownership from another device later (see design.md, "Sem
 * protocolo nem chave de acesso para a conversa"). The citizen's own token
 * is never stored — only its hash, in `chat_citizen_token_hash`, read the
 * same way `access_key_hash` already is for the other four channels.
 */
export const chatConversations = pgTable(
  "chat_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    status: text("status").notNull().default("waiting"),
    citizenName: text("citizen_name").notNull(),
    citizenContact: text("citizen_contact").notNull(),
    subject: text("subject").notNull(),
    // Hash of the opaque cookie token that lets the citizen's browser find
    // this conversation again — same discipline as `access_key_hash`
    // elsewhere: the value itself never touches the database.
    citizenTokenHash: text("citizen_token_hash").notNull(),
    // What the citizen typed in the pre-chat, kept verbatim even if it
    // matches nothing — the attendant still sees what was typed.
    informedProtocolNumber: text("informed_protocol_number"),
    // Set only when informedProtocolNumber matches a real record.
    matchedRequestId: uuid("matched_request_id").references(
      () => serviceRequests.id,
      { onDelete: "set null" },
    ),
    // The public page the citizen opened the widget from.
    sourcePath: text("source_path"),
    assignedUserId: text("assigned_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // Copied from the attendant's own `chat_sector` at the moment they take
    // the conversation, not read live from `user` — a transcript has to keep
    // saying "Registro Civil" even if that attendant's sector changes later
    // (same reasoning as `service_requests.attribution`).
    assignedSector: text("assigned_sector"),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    waitingSince: timestamp("waiting_since", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedReason: text("closed_reason"),
    // Set at closing time, either by linking to an existing request or by
    // the manual entry launched from this conversation.
    linkedRequestId: uuid("linked_request_id").references(
      () => serviceRequests.id,
      { onDelete: "set null" },
    ),
    rating: integer("rating"),
    ratingComment: text("rating_comment"),
    wantsTranscriptEmail: boolean("wants_transcript_email")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("chat_conversations_tenant_status").on(t.tenantSlug, t.status),
    index("chat_conversations_tenant_waiting_since").on(
      t.tenantSlug,
      t.waitingSince,
    ),
  ],
);

/**
 * One message, note or system event inside a conversation. `authorType`
 * carries `note` as its own value rather than a flag on top of `staff` — a
 * note must never reach the citizen, and a boolean next to a shared type is
 * the kind of field a query forgets to filter (see design.md).
 *
 * The attachment columns mirror `service_request_attachments`'s shape and
 * stay null on every message that is not one.
 */
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => chatConversations.id, { onDelete: "cascade" }),
    tenantSlug,
    authorType: text("author_type").notNull(),
    authorUserId: text("author_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull().default(""),
    attachmentStoredName: text("attachment_stored_name"),
    attachmentDisplayName: text("attachment_display_name"),
    attachmentPath: text("attachment_path"),
    attachmentMimeType: text("attachment_mime_type"),
    attachmentSizeBytes: integer("attachment_size_bytes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("chat_messages_conversation_created_at").on(
      t.conversationId,
      t.createdAt,
    ),
  ],
);

/**
 * A public transparency document — a fee table, a cost table, a notice — the
 * office publishes to meet the Lei de Acesso à Informação. Same file columns
 * as `office_publications` (the document is the point, so it is required, not
 * optional here). What differs: no body, no dates. State is stored, because
 * there is nothing to derive it from, and `position` is explicit because the
 * order on the panel is the order on the site — see add-transparency-module.
 */
export const transparencyDocuments = pgTable(
  "transparency_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    category: text("category").notNull(),
    title: text("title").notNull(),
    // Free text: "2026" or "vigência 19/03/2026". Never sorted on — the order
    // is `position` — so its shape does not matter to anything but the reader.
    yearLabel: text("year_label").notNull(),
    fileStoredName: text("file_stored_name").notNull(),
    fileDisplayName: text("file_display_name").notNull(),
    filePath: text("file_path").notNull(),
    fileMimeType: text("file_mime_type").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    // "draft" | "published" | "unpublished" — see core/transparency/documents.
    status: text("status").notNull().default("draft"),
    // The rank in the list, ascending. Moving swaps two rows' positions.
    position: integer("position").notNull(),
    // When it last left the site, for the "fora do site desde" line.
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("transparency_documents_tenant_position").on(
      t.tenantSlug,
      t.position,
    ),
  ],
);

/**
 * The monthly revenue bulletin. Four figures the office types plus a state;
 * the balance is never stored, it is arithmetic on the four
 * (core/transparency/bulletin). Money is centavos, in bigint: a busy month in
 * centavos passes the 2.1-billion ceiling of a 32-bit integer.
 *
 * One bulletin per (office, month) — the unique index is what makes
 * "publishing again replaces the month's bulletin" an upsert the database
 * enforces, not a race the application hopes to win.
 */
export const transparencyBulletins = pgTable(
  "transparency_bulletins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    // The first day of the month it covers; the day is always 01.
    referenceMonth: date("reference_month").notNull(),
    actsCount: integer("acts_count").notNull(),
    grossRevenueCents: bigint("gross_revenue_cents", {
      mode: "number",
    }).notNull(),
    taxesPaidCents: bigint("taxes_paid_cents", { mode: "number" }).notNull(),
    expensesCents: bigint("expenses_cents", { mode: "number" }).notNull(),
    // "preliminary" | "consolidated" — see core/transparency/bulletin.
    status: text("status").notNull().default("preliminary"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("transparency_bulletins_tenant_month").on(
      t.tenantSlug,
      t.referenceMonth,
    ),
  ],
);
