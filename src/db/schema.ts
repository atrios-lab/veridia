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
    // the citizen's own submission: only the operator, working the request,
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
    // Set on a file sent inside a message of the requirement's conversation.
    // `requestId` stays filled alongside it: the owner is still the request,
    // which is how a future purge finds the file to delete by walking the
    // request. Without that, deleting the request would leave the bytes in
    // storage with nobody pointing at them.
    requirementMessageId: uuid("requirement_message_id").references(
      (): AnyPgColumn => serviceRequestRequirementMessages.id,
      { onDelete: "cascade" },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("service_request_attachments_request").on(t.requestId),
    index("service_request_attachments_requirement").on(t.requirementId),
    index("service_request_attachments_requirement_message").on(
      t.requirementMessageId,
    ),
  ],
);

/**
 * A requirement (exigência) the office raises on a service request: something
 * missing before the request can move forward. It has its own row, not a
 * field in `details`, because both sides write it (the office registers it,
 * the citizen resolves it from the protocol consult) and a JSON blob shared
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
 * The conversation inside a requirement: the citizen asks what the office
 * actually wants, the office answers, both in the card the requirement
 * already occupies on either screen. It exists because "anexe o documento" is
 * not always enough: the office's legacy system grew this exact feature
 * after the fact, which is the strongest evidence it was needed.
 *
 * `author` is its own column rather than a `authorUserId IS NULL` test: an
 * operator's account may be deactivated, which sets the id to null, and the
 * message would then present itself as the citizen's. Whoever spoke is a fact
 * about the message, not about the account that still exists.
 *
 * There is no status column: "awaiting the office", "answered" and "closed"
 * are read off the last message and the requirement's own state, the same way
 * a publication's state is computed and never stored.
 */
export const serviceRequestRequirementMessages = pgTable(
  "service_request_requirement_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    requirementId: uuid("requirement_id")
      .notNull()
      .references(() => serviceRequestRequirements.id, {
        onDelete: "cascade",
      }),
    // "citizen" | "staff".
    author: text("author").notNull(),
    // Null when the citizen wrote it (no account), or when the operator's
    // account was later removed.
    authorUserId: text("author_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("service_request_requirement_messages_requirement").on(
      t.requirementId,
      t.createdAt,
    ),
  ],
);

/**
 * What a serventia publishes to the "Proclamas e avisos" home section:
 * marriage banns, a general notice, or a formal notice. `publishAt` and
 * `expireAt` are calendar dates, not instants: a publication is on the site
 * for whole days, read on the wall calendar of the office, same discipline as
 * `IsoDate` in `src/core/scheduling/calendar.ts`. Null `publishAt` is a
 * draft; state (draft/scheduled/live/archived) is never stored, only
 * computed from these dates and `archivedAt`: see
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
    // body stays required: the document is the proof, not the reading.
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
 * Unlike the four kinds in `service_requests` (one submission, one eventual
 * reply), a conversation has many messages, an attendant that can change
 * mid-life (transfer), and both sides poll it at once. That shape is why it
 * is its own table instead of a fifth request kind: see
 * add-support-chat/design.md.
 *
 * There is deliberately no protocol number and no access key here: the
 * citizen only needs this to survive a reload of the same browser tab, not
 * to prove ownership from another device later (see design.md, "Sem
 * protocolo nem chave de acesso para a conversa"). The citizen's own token
 * is never stored: only its hash, in `chat_citizen_token_hash`, read the
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
    // this conversation again: same discipline as `access_key_hash`
    // elsewhere: the value itself never touches the database.
    citizenTokenHash: text("citizen_token_hash").notNull(),
    // What the citizen typed in the pre-chat, kept verbatim even if it
    // matches nothing: the attendant still sees what was typed.
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
    // the conversation, not read live from `user`: a transcript has to keep
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
 * carries `note` as its own value rather than a flag on top of `staff`: a
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
 * A public transparency document, a fee table, a cost table, a notice, the
 * office publishes to meet the Lei de Acesso à Informação. Same file columns
 * as `office_publications` (the document is the point, so it is required, not
 * optional here). What differs: no body, no dates. State is stored, because
 * there is nothing to derive it from, and `position` is explicit because the
 * order on the panel is the order on the site: see add-transparency-module.
 */
export const transparencyDocuments = pgTable(
  "transparency_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    category: text("category").notNull(),
    title: text("title").notNull(),
    // Free text: "2026" or "vigência 19/03/2026". Never sorted on, the order
    // is `position`, so its shape does not matter to anything but the reader.
    yearLabel: text("year_label").notNull(),
    fileStoredName: text("file_stored_name").notNull(),
    fileDisplayName: text("file_display_name").notNull(),
    filePath: text("file_path").notNull(),
    fileMimeType: text("file_mime_type").notNull(),
    fileSizeBytes: integer("file_size_bytes").notNull(),
    // "draft" | "published" | "unpublished": see core/transparency/documents.
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
 * An appointment: one citizen, one day, one time. Its own table rather than a
 * kind of `service_requests`, because it shares nothing with a filing: no
 * protocol, no access key, no attachments, no phases. What the citizen gets
 * back is an e-mail, and the link inside it is the only credential.
 *
 * The partial unique index is the whole capacity rule: one live appointment
 * per office, day and time. Two citizens racing for the last slot are decided
 * by the database, not by a count the application read a moment ago and hoped
 * was still true.
 *
 * Only a cancellation falls out of the index. An attended visit has spent
 * that hour of the counter's day and must keep holding it. Otherwise marking
 * an early-arriving citizen as served would put their slot back on sale.
 *
 * `serviceLabel` is stored next to `serviceId` on purpose: the office edits
 * its own service list, and a record has to survive a service being renamed
 * or dropped, same discipline as the act catalogue.
 */
export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    // The day on the office's wall calendar, and "HH:mm" on its wall clock.
    // Never an instant: an appointment at 09:00 is 09:00 at the counter,
    // whatever zone the server or the citizen's phone is in.
    date: date("date").notNull(),
    slotTime: text("slot_time").notNull(),
    citizenName: text("citizen_name").notNull(),
    // The channel for everything: confirmation, cancellation, the link that
    // lets the citizen call it off. Required, unlike every other channel here.
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    // Minimised on purpose: most counter visits do not need it before the
    // citizen shows up with the document in hand.
    cpf: text("cpf"),
    serviceId: text("service_id").notNull(),
    serviceLabel: text("service_label").notNull(),
    mode: text("mode").notNull(),
    // "booked" | "attended" | "no_show" | "cancelled", see
    // core/scheduling/appointment.
    status: text("status").notNull().default("booked"),
    // "site" when the citizen booked it, "desk" when the office reserved it
    // at the counter ("Reservado no balcão").
    origin: text("origin").notNull().default("site"),
    // AGD.2026.000071: the office's yearly counter, same book-keeping as
    // service_requests. Nullable: appointments predating the numbering have
    // none, and the panel simply omits it.
    protocolYear: integer("protocol_year"),
    protocolSequence: integer("protocol_sequence"),
    protocolNumber: text("protocol_number"),
    // Why the office called it off, sent to the citizen. Null when the
    // citizen cancelled it themselves.
    cancelReason: text("cancel_reason"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    // The citizen's only credential, hashed like every other one here. The
    // token itself lives in exactly one place: the e-mail that was sent.
    cancelTokenHash: text("cancel_token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("appointments_tenant_date_slot_live")
      .on(t.tenantSlug, t.date, t.slotTime)
      .where(sql`${t.status} <> 'cancelled'`),
    // Two bookings racing for the same number lose here, and the loser asks
    // for the next sequence. NULLs are distinct, so legacy rows coexist.
    uniqueIndex("appointments_tenant_year_sequence").on(
      t.tenantSlug,
      t.protocolYear,
      t.protocolSequence,
    ),
    uniqueIndex("appointments_tenant_protocol").on(
      t.tenantSlug,
      t.protocolNumber,
    ),
    index("appointments_tenant_date").on(t.tenantSlug, t.date),
    index("appointments_cancel_token").on(t.cancelTokenHash),
  ],
);

/**
 * The monthly revenue bulletin. Four figures the office types plus a state;
 * the balance is never stored, it is arithmetic on the four
 * (core/transparency/bulletin). Money is centavos, in bigint: a busy month in
 * centavos passes the 2.1-billion ceiling of a 32-bit integer.
 *
 * One bulletin per (office, month): the unique index is what makes
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
    // "preliminary" | "consolidated": see core/transparency/bulletin.
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

/**
 * Addresses a message came back from, keyed by the address itself.
 *
 * Not a column on the records that hold an e-mail: the same address shows up
 * in `service_requests`, `appointments`, `chat_conversations` and `user`,
 * four columns in four tables with nothing in common, and it is the mailbox
 * that bounces, not the pedido. One row per address answers "does this
 * address take mail?" for all of them at once, which is exactly the question
 * the sending path asks.
 *
 * No foreign key anywhere, for the same reason: the address outlives every
 * record that mentioned it, and it has to, or the trail is gone the moment
 * someone deletes the pedido that produced it.
 */
export const emailBounces = pgTable("email_bounces", {
  /** Lowercased by the endpoint before it lands here. */
  email: text("email").primaryKey(),
  /** The provider's own name for what happened ("HardBounce", "SpamComplaint"). */
  kind: text("kind").notNull(),
  /** What the receiving server said, as the provider relayed it. Text from
   * outside: it is shown as text and never interpreted. */
  detail: text("detail").notNull().default(""),
  /**
   * Whether this kind means the address will never take mail. Decided once,
   * on the way in, so the sending path reads a boolean off a primary key
   * instead of re-classifying a provider string on every message.
   */
  permanent: boolean("permanent").notNull(),
  /** The office whose message came back, when the provider tells us. Null is
   * expected: the address is the subject here, not the office. */
  tenantSlug: text("tenant_slug"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
