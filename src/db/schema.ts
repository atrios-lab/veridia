import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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
    /** Why, for a sensitive act (an exclusion): typed by its author. */
    reason: text("reason"),
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
    // Whatever the channel asks for: an e-mail or a telephone in the ones
    // that take either. For a service request filed from the site it is
    // always an e-mail, which the form now requires; rows filed before that
    // may hold a telephone here, so a reader that means to send mail still
    // has to ask (`isEmailContact`). The telephone of a service request is
    // kept apart, in `details.phone`.
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
    // Why the office closed the request without delivering it: written when
    // the andamento moves to "cancelled" or "rejected", overwritten by the
    // next such move. Read by the citizen on the protocol consult, where a
    // closed request with no explanation is what makes someone call the
    // counter to ask why.
    statusReason: text("status_reason"),
    // Null until the office informs it. A service request is never priced by
    // the citizen's own submission: only the operator, working the request,
    // knows what band or table applies.
    amountCents: integer("amount_cents"),
    // When the protocol last moved into a closed andamento of its kind (see
    // `TERMINAL_STATUSES`): null while open, cleared when reopened, kept when
    // it moves between two closed ones. The protocol's files are kept 30
    // days from here (`src/core/request/attachment-retention.ts`).
    closedAt: timestamp("closed_at", { withTimezone: true }),
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
    // requerimento, "office" for what the office delivers back, plus a
    // handful of narrower kinds for one specific moment in the request's life
    // ("payment-receipt", "rejection-document") that need their own filter
    // but not their own column.
    kind: text("kind").notNull().default("citizen"),
    storedName: text("stored_name").notNull(),
    displayName: text("display_name").notNull(),
    // Null once the file is deleted by the 90-day rule; the row stays as
    // the record (name, kind, size, when it came, `purgedAt`).
    path: text("path"),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    // When the platform deleted the file, 90 days after the protocol closed
    // (see `src/core/request/attachment-retention.ts`).
    purgedAt: timestamp("purged_at", { withTimezone: true }),
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
    // which is how the 90-day purge (`purgeExpiredRequestFiles`) finds the
    // file to delete by walking the request. Without that, deleting the
    // request would leave the bytes in storage with nobody pointing at them.
    requirementMessageId: uuid("requirement_message_id").references(
      (): AnyPgColumn => serviceRequestRequirementMessages.id,
      { onDelete: "cascade" },
    ),
    /**
     * A file sent to the client with no digital signature, confirmed by the
     * clerk as a dematerialized document: signed by hand on paper and
     * scanned (decision of 11/11/2026). Who confirmed, by name, and when.
     */
    physicalSignatureAt: timestamp("physical_signature_at", {
      withTimezone: true,
    }),
    physicalSignatureBy: text("physical_signature_by"),
    /**
     * A PDF for the citizen held back until it is signed digitally on the
     * request's page (decision of 11/11/2026): while set, the citizen does
     * not see it. Cleared when signed, or when the clerk sends it unsigned.
     */
    heldForSignatureAt: timestamp("held_for_signature_at", {
      withTimezone: true,
    }),
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
 * The citizen's ciência (decision of 16/11/2026): when the citizen first saw
 * what the office put on the request (an exigência, a document, the amount,
 * the answer to a consultation) and when they first opened or downloaded a
 * document. It certifies the delivery, so the first moment is never
 * overwritten: a later visit only moves `lastAt` and `times`. One row per
 * thing and action. `targetId` is the row's id, or the amount in cents for
 * "amount" (a new value is a new thing to see). The address and the browser
 * of the first time are kept as evidence of who opened it; the citizen is
 * told on the consult that this is recorded.
 */
export const serviceRequestCitizenViews = pgTable(
  "service_request_citizen_views",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    // "requirement" | "document" | "amount" | "answer".
    target: text("target").notNull(),
    targetId: text("target_id").notNull(),
    // "viewed" | "downloaded".
    action: text("action").notNull(),
    firstAt: timestamp("first_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastAt: timestamp("last_at", { withTimezone: true }).notNull().defaultNow(),
    times: integer("times").notNull().default(1),
    firstIp: text("first_ip"),
    firstUserAgent: text("first_user_agent"),
  },
  (t) => [
    uniqueIndex("service_request_citizen_views_unique").on(
      t.requestId,
      t.target,
      t.targetId,
      t.action,
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
    // Which edital, inside the sector: "usucapiao-terceiros",
    // "loteamento"... A key of NOTICE_TYPES in
    // src/core/publications/notice-types.ts, which holds the legal rule
    // (how many runs, the term) the dates are computed from. Null on
    // notices, on an edital the catalog has no rule for, and on rows older
    // than the column.
    noticeType: text("notice_type"),
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
    // When the current file was sent: it is kept 90 days from then (see
    // src/core/publications/attachment-retention.ts), then deleted.
    attachmentUploadedAt: timestamp("attachment_uploaded_at", {
      withTimezone: true,
    }),
    // When that deletion happened. The path is cleared then, and the name,
    // type and size stay as the record of which file the publication had.
    attachmentPurgedAt: timestamp("attachment_purged_at", {
      withTimezone: true,
    }),
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
    // Which of the time's vacancies this appointment holds (1, 2, ... up to
    // the time's capacity): the unique index below is per vacancy, so as
    // many citizens as the office has attendants can share 08:00, and two
    // bookings racing for the same vacancy still meet the database.
    seat: integer("seat").notNull().default(1),
    citizenName: text("citizen_name").notNull(),
    // The channel for everything: confirmation, cancellation, the link that
    // lets the citizen call it off. Required, unlike every other channel here.
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    // Minimised on purpose: most counter visits do not need it before the
    // citizen shows up with the document in hand.
    cpf: text("cpf"),
    // Which of the office's two agendas: "geral" (the counter) or
    // "tabeliao" (the notary in person), see core/scheduling/agenda. Every
    // appointment from before the split was the counter's, hence the default.
    agenda: text("agenda").notNull().default("geral"),
    serviceId: text("service_id").notNull(),
    serviceLabel: text("service_label").notNull(),
    mode: text("mode").notNull(),
    // What the citizen needs within the chosen service, in their own words.
    // Required on the site, but nullable here: appointments from before the
    // field existed and the ones the office reserves at the counter have none.
    serviceDetails: text("service_details"),
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
    // When the day-before reminder went to the citizen. Set by the same
    // statement that claims it, so two runs of the job never send it twice.
    reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
    // The citizen's only credential, hashed like every other one here. The
    // token itself lives in exactly one place: the e-mail that was sent.
    cancelTokenHash: text("cancel_token_hash").notNull(),
    // The access key that opens the appointment on the protocol consult
    // (details, and documents the citizen sends ahead), hashed like the
    // service request's. Null on appointments booked before it existed and
    // on the ones the office reserves at the counter: the citizen gets one
    // through "perdi a chave", with the e-mail on the booking.
    accessKeyHash: text("access_key_hash"),
    // When the office took the appointment off the agenda ("Excluir"): the
    // row stays, cancelled and out of every list, so the record and its
    // audit trail survive and the hour is free again.
    removedAt: timestamp("removed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("appointments_tenant_date_slot_seat_live")
      .on(t.tenantSlug, t.date, t.slotTime, t.seat)
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
 * A file the citizen sent ahead of an appointment, from the protocol consult
 * opened with the appointment's key: a document they want the office to see
 * before coming. Same columns as a service request's attachment, kept apart
 * because an appointment is not a service request.
 */
export const appointmentAttachments = pgTable(
  "appointment_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    storedName: text("stored_name").notNull(),
    displayName: text("display_name").notNull(),
    path: text("path"),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    // The panel user who attached it, for a file the office keeps with the
    // appointment; null for what the citizen sent from the consult. Only
    // the citizen's own files go back to the consult.
    uploadedBy: text("uploaded_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("appointment_attachments_appointment").on(t.appointmentId)],
);

/**
 * The office's own notes on an appointment, from the panel's detail screen:
 * what the citizen said on the phone, what to check at the counter. Internal:
 * never shown to the citizen. One row per note, with who wrote it and when,
 * so the trail reads like the request's history.
 */
export const appointmentNotes = pgTable(
  "appointment_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    authorId: text("author_id"),
    /** The author's name as it was when they wrote it. */
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("appointment_notes_appointment").on(t.appointmentId)],
);

/**
 * What the office and the citizen say to each other about an appointment
 * (decision of 24/11/2026), shown on the panel's detail and on the
 * citizen's consult:
 *
 * - `requirement`: an exigência, what the office needs before the visit
 *   (usually a document, sent through the consult's upload). Open until
 *   `resolved_at`.
 * - `message`: a question or an answer, from either side, while the office
 *   keeps the questions open.
 * - `open` / `close`: the office opening and closing the questions; the
 *   latest one says whether the citizen may write.
 *
 * Nothing is deleted: an edit keeps the old text in `history`, and
 * "apagar" sets `hidden_at`.
 */
export const appointmentMessages = pgTable(
  "appointment_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    appointmentId: uuid("appointment_id")
      .notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    // "requirement" | "message" | "open" | "close"
    kind: text("kind").notNull(),
    // "office" | "citizen"
    authorType: text("author_type").notNull(),
    authorId: text("author_id"),
    /** The author's name as it was when they wrote it. */
    authorName: text("author_name").notNull(),
    body: text("body").notNull().default(""),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
    /** Earlier texts: [{ body, at, by }]. */
    history: jsonb("history").notNull().default([]),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
    hiddenBy: text("hidden_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("appointment_messages_appointment").on(t.appointmentId)],
);

/**
 * The monthly revenue bulletin. What was paid into each fund of the office's
 * state, keyed by fund (never by rubric: the rubric is read from the map in
 * core/transparency/rubrics when shown, so a reclassification needs no
 * migration), the ISS, and, when the office publishes them, gross revenue and
 * expenses. The taxes total and the balance are never stored, they are
 * arithmetic (core/transparency/bulletin), except for the old bulletins that
 * predate the funds (see taxes_paid_cents). Money is centavos, in bigint: a
 * busy month in centavos passes the 2.1-billion ceiling of a 32-bit integer.
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
    // { fdj: 123456, frmp: 32100, ... }: every fund of the state, centavos.
    // Read back through parseFundAmounts, never trusted as stored.
    fundAmountsCents: jsonb("fund_amounts_cents")
      .$type<Record<string, number>>()
      .notNull()
      .default({}),
    issCents: bigint("iss_cents", { mode: "number" }).notNull().default(0),
    // Null when the office does not publish its private figures.
    grossRevenueCents: bigint("gross_revenue_cents", { mode: "number" }),
    // The single taxes total of a bulletin published before Res. CNJ
    // 670/2025, which had no funds (fund_amounts_cents = {}). Kept because
    // that total cannot be split into funds after the fact; null on every
    // bulletin in the current format, whose taxes are the funds plus ISS.
    taxesPaidCents: bigint("taxes_paid_cents", { mode: "number" }),
    expensesCents: bigint("expenses_cents", { mode: "number" }),
    // "preliminary" | "consolidated": see core/transparency/bulletin.
    status: text("status").notNull().default("preliminary"),
    // Signed before publishing (decision of 11/11/2026): the signed copy,
    // its verification code, and what it covers (lib/bulletin-pdf.ts
    // bulletinFingerprint). Served only while the fingerprint still holds.
    signedPdfPath: text("signed_pdf_path"),
    signedCode: text("signed_code"),
    signedFingerprint: text("signed_fingerprint"),
    // "Excluir" (decision of 11/11/2026): off the site and the panel's
    // list, the row kept with its audit. Publishing the month again brings
    // it back with the new figures.
    removedAt: timestamp("removed_at", { withTimezone: true }),
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
/**
 * The Provimento 243 intake: what the office answers, section by section, so
 * the Átrios can generate its compliance documents outside the panel. One row
 * per office. `answers` is keyed by section id then field name, the shape
 * `src/core/compliance/sections.ts` declares; `sectionUpdatedAt` records when
 * each section was last saved, which is what tells "não iniciada" from
 * "concluída" and, after submission, which sections changed after the fact.
 *
 * Submission is a stamp, never a lock: the office keeps editing, and the
 * version counter grows on every submission so a later stage (published
 * PDFs, the Justiça Aberta protocol, the yearly renewal) can hang off a
 * specific set of answers without this table changing shape.
 */
export const complianceIntakes = pgTable(
  "compliance_intakes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    answers: jsonb("answers").notNull().default(sql`'{}'::jsonb`),
    sectionUpdatedAt: jsonb("section_updated_at")
      .notNull()
      .default(sql`'{}'::jsonb`),
    // Same shape as a stored attachment elsewhere (stored name, display
    // name, path, MIME type, size), plus an id and a date, in a list: the
    // files hang off the intake and go when it goes.
    attachments: jsonb("attachments").notNull().default(sql`'[]'::jsonb`),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    submittedVersion: integer("submitted_version").notNull().default(0),
    submittedBy: text("submitted_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text("updated_by"),
  },
  (t) => [uniqueIndex("compliance_intakes_tenant_slug_key").on(t.tenantSlug)],
);

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

/**
 * The platform's courses: the shelf a tutorial sits on. Global like the
 * tutorials (no tenant slug, written only with `tutorials.manage`). A
 * reference course ("Uso do painel") is watched in any order; a sequential
 * one (LGPD) opens each video only after the one before it. A course is a
 * draft until `published_at` is set, and its videos stay hidden with it.
 *
 * `slug` is the course's address, `/admin/ajuda/<slug>`; "gerenciar" is
 * taken by the management screen, which the form refuses.
 */
export const courses = pgTable(
  "courses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** Cover image and the support PDF, public URLs like the videos'. */
    posterPath: text("poster_path"),
    materialPath: text("material_path"),
    sequential: boolean("sequential").notNull().default(false),
    /** Assessment: the minimum share of right answers, in percent. */
    passingScore: integer("passing_score").notNull().default(70),
    /** Hours on the certificate; null means the course has none. */
    workloadHours: integer("workload_hours"),
    /** How long after a failed attempt the next one opens. */
    retryHours: integer("retry_hours").notNull().default(5),
    /** What the certificate attests. "completion": a passed assessment.
     * "participation": every video watched, no assessment at all. */
    certificateKind: text("certificate_kind")
      .$type<"completion" | "participation">()
      .notNull()
      .default("completion"),
    position: integer("position").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text("created_by"),
  },
  (t) => [uniqueIndex("courses_slug").on(t.slug)],
);

/**
 * The platform's video tutorials: what the Treinamento screen of every
 * office lists. No tenant slug, and the first table in this schema whose
 * rows are written from the panel without one. The rule that makes that
 * safe, for this table and any global one after it: writing requires a
 * platform permission (`tutorials.manage`, held by the superadmin role
 * alone, see src/core/auth/roles.ts), and reading returns the same rows to
 * every office. A row is a draft until `published_at` is set; only
 * published rows reach an office.
 *
 * The files live in the deploy's Blob store under `treinamento/` (or under
 * `public/uploads/treinamento/` in development); the row keeps the public
 * URL, as the brand images do.
 */
export const tutorials = pgTable(
  "tutorials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** Read from the file in the browser at upload time; never typed. */
    durationSeconds: integer("duration_seconds").notNull(),
    videoPath: text("video_path").notNull(),
    /** Null: uploaded without captions. */
    captionsPath: text("captions_path"),
    /** The cover image; null shows a cover drawn from the title. */
    posterPath: text("poster_path"),
    /** The panel route the video teaches; null for the panel as a whole. */
    route: text("route"),
    /** Part of the "Primeiros passos" trail the overview walks through. */
    trail: boolean("trail").notNull().default(true),
    /** The course this video belongs to. Deleting a course that still has
     * videos is refused, so nobody's progress goes by accident. */
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    /** "intro" (Apresentação) and "outro" (Encerramento) frame a course,
     * one of each at most; every "lesson" in between is numbered. */
    kind: text("kind").notNull().default("lesson"),
    /** Order inside the course. Moving a video swaps this with the
     * neighbour's in the same course; a new one takes the course's highest
     * value plus one. */
    position: integer("position").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** user.id of the platform account that uploaded it. */
    createdBy: text("created_by"),
  },
  (t) => [
    index("tutorials_published_at").on(t.publishedAt),
    index("tutorials_position").on(t.position),
    index("tutorials_course").on(t.courseId),
    // At most one Apresentação and one Encerramento per course.
    uniqueIndex("tutorials_course_frame")
      .on(t.courseId, t.kind)
      .where(sql`${t.kind} in ('intro', 'outro')`),
  ],
);

/**
 * A course's assessment questions: four alternatives, one right. Global like
 * the course. The right one (`correct_index`) never leaves the server: the
 * attempt hands the browser the prompts and the alternatives in a shuffled
 * order, and grades on the server. A question that has appeared in an
 * attempt is deactivated, never deleted, so the attempt can still be read.
 */
export const courseQuestions = pgTable(
  "course_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    /** Exactly four, in the order they were written. */
    options: jsonb("options").$type<string[]>().notNull(),
    /** 0..3, into `options`. */
    correctIndex: integer("correct_index").notNull(),
    active: boolean("active").notNull().default(true),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("course_questions_course").on(t.courseId)],
);

/**
 * One go at a course's assessment by one person. The draw (question order
 * and each question's alternative order) is written when the attempt
 * starts, so a reload shows the same thing; the answers are stored as the
 * ORIGINAL alternative index, so grading never depends on the draw. Open
 * while `submitted_at` is null; at most one open attempt per person and
 * course.
 */
export const quizAttempts = pgTable(
  "quiz_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "cascade" }),
    questionIds: jsonb("question_ids").$type<string[]>().notNull(),
    /** Per question, the original indexes in the order shown. */
    optionOrders: jsonb("option_orders").$type<number[][]>().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    answers: jsonb("answers").$type<number[]>(),
    correct: integer("correct"),
    total: integer("total"),
    passed: boolean("passed"),
  },
  (t) => [
    index("quiz_attempts_user_course").on(t.userId, t.courseId),
    uniqueIndex("quiz_attempts_one_open")
      .on(t.userId, t.courseId)
      .where(sql`${t.submittedAt} is null`),
  ],
);

/**
 * A course certificate. What it says is a snapshot taken at issue (name,
 * CPF, role, office, course title, hours, score), so renaming the course or
 * the office later never changes one already issued. One per person and
 * course. The CPF is here only to be printed on the person's own PDF; the
 * public check shows it masked. The account going away keeps the
 * certificate (`set null`): checking it is the point.
 */
export const certificates = pgTable(
  "certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** XXXX-XXXX-XXXX, Crockford base32, random. */
    code: text("code").notNull(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    attemptId: uuid("attempt_id").references(() => quizAttempts.id, {
      onDelete: "set null",
    }),
    fullName: text("full_name").notNull(),
    cpf: text("cpf").notNull(),
    roleTitle: text("role_title").notNull(),
    tenantSlug: text("tenant_slug").notNull(),
    tenantName: text("tenant_name").notNull(),
    /** The host the certificate was issued from: the check's address. */
    issuedHost: text("issued_host").notNull(),
    courseTitle: text("course_title").notNull(),
    workloadHours: integer("workload_hours").notNull(),
    /** The passed attempt's score; null on a participation certificate. */
    score: integer("score"),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("certificates_code").on(t.code),
    uniqueIndex("certificates_user_course").on(t.userId, t.courseId),
  ],
);

/**
 * Which video tutorials a person has watched, and when they first finished
 * each one. Keyed by a person rather than by an office, and on purpose:
 * the progress belongs to the account, not to the serventia, so it follows
 * the person to any machine they sign in on (a counter shares its
 * computer; localStorage would show one clerk the other's progress, or
 * none). There is no tenant slug because a user belongs to exactly one
 * office and every read and write here goes through the session's own user
 * id, which getSession() has already bound to the office of the host (see
 * src/lib/session.ts).
 *
 * Deleting the video deletes the progress of everyone in it; unpublishing
 * it does not, so a video taken down and put back keeps its ticks. Rows go
 * with the account too.
 */
export const tutorialProgress = pgTable(
  "tutorial_progress",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    videoId: uuid("video_id")
      .notNull()
      .references(() => tutorials.id, { onDelete: "cascade" }),
    /** The first time the video reached its end, or was marked by hand.
     * Marking again never moves it: "assistido em" is the first time. */
    watchedAt: timestamp("watched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.videoId] })],
);

/**
 * A course cohort: one office that is not a client yet, invited to take a
 * course through a link. The link carries only the random `code`; the
 * office's name printed on its learners' certificates lives here, typed by
 * the platform account, never by the learner and never read from the URL.
 * Not tenant-scoped: every learner lands in the courses office
 * (src/core/tenant/courses-tenant.ts), and the cohort is what tells their
 * offices apart. A cohort with learners is never deleted (`restrict` from
 * cohort_members): closing it is `closed_at`.
 */
export const courseCohorts = pgTable(
  "course_cohorts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** XXXX-XXXX, Crockford base32, random. */
    code: text("code").notNull(),
    /** The course the link opens and whose progress the cohort screen shows. */
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    officeName: text("office_name").notNull(),
    officeCity: text("office_city").notNull(),
    contactName: text("contact_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    seats: integer("seats").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text("created_by"),
  },
  (t) => [uniqueIndex("course_cohorts_code").on(t.code)],
);

/**
 * A learner in a cohort. Its own table rather than a column on `user`: the
 * user table is the auth library's, the primary key on `user_id` is what
 * keeps an account in one cohort at most, and the consent to be contacted
 * belongs to the cohort sign-up, not to the account. The account going away
 * takes the row with it.
 */
export const cohortMembers = pgTable(
  "cohort_members",
  {
    userId: text("user_id")
      .primaryKey()
      .references(() => user.id, { onDelete: "cascade" }),
    cohortId: uuid("cohort_id")
      .notNull()
      .references(() => courseCohorts.id, { onDelete: "restrict" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** When the learner agreed to hear from the Átrios about the platform;
     * null when they did not tick the box. */
    contactConsentAt: timestamp("contact_consent_at", { withTimezone: true }),
  },
  (t) => [index("cohort_members_cohort").on(t.cohortId)],
);

/**
 * A guia de transmissão de bens the office issued from the panel's Utilitários: the
 * requerimento the notary signs and the party takes to the fisco (the
 * prefeitura for the ITIV/ITBI and the municipal laudêmio, the state's
 * tax office for the ITCD), which then issues the payment slip. Kept so the
 * office can reprint it and so its number ("Nº 03/2025") follows the
 * office's own yearly count, as on the papers it issued by hand.
 *
 * What was filled in travels as one JSON document (`payload`, the shape of
 * core/guides): the parties, the property and the values differ by kind of
 * guia, and the paper is drawn from it whole, never queried field by field.
 */
export const taxGuides = pgTable(
  "tax_guides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    // "itiv", "itcd-doacao", "itcd-causa-mortis", "laudemio-municipal",
    // "certidao-imobiliaria": see core/guides/catalog.
    kind: text("kind").notNull(),
    year: integer("year").notNull(),
    sequence: integer("sequence").notNull(),
    payload: jsonb("payload").notNull(),
    // The citizen's request the guia answers, when it came from the site's
    // Notas services; null for one the clerk issued at the counter.
    serviceRequestId: uuid("service_request_id").references(
      () => serviceRequests.id,
      { onDelete: "set null" },
    ),
    createdBy: text("created_by"),
    // When the office deleted it ("Excluir", for a guia issued by mistake):
    // the row stays, out of every list, with its audit trail, and its
    // number is free for the next guia.
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One live guia per number in the office's year. Two issued at once
    // race for it and the loser takes the next one; a deleted guia leaves
    // its number free.
    uniqueIndex("tax_guides_tenant_year_sequence_live")
      .on(t.tenantSlug, t.year, t.sequence)
      .where(sql`${t.deletedAt} is null`),
    index("tax_guides_tenant_created").on(t.tenantSlug, t.createdAt),
  ],
);

/**
 * Declaração de ISS (decision of 11/11/2026): one per month the office
 * declares to the municipal tax office. The figures are the month's
 * emolumentos (the ISS base); the book or cash report of the month goes
 * attached. Numbered per year, like the guias.
 */
export const issDeclarations = pgTable(
  "iss_declarations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    year: integer("year").notNull(),
    sequence: integer("sequence").notNull(),
    /** "2026-10": the month declared. */
    competence: text("competence").notNull(),
    emolumentsCents: bigint("emoluments_cents", { mode: "number" }).notNull(),
    rateBasisPoints: integer("rate_basis_points").notNull(),
    issCents: bigint("iss_cents", { mode: "number" }).notNull(),
    /** The ISS came worked out act by act from the system's report. */
    issFromReport: boolean("iss_from_report").notNull().default(false),
    /** Who signs: an index into the office's signers (decision of 11/11/2026). */
    signer: integer("signer").notNull().default(0),
    damNumber: text("dam_number").notNull().default(""),
    dueDate: text("due_date").notNull().default(""),
    paidOn: text("paid_on").notNull().default(""),
    notes: text("notes").notNull().default(""),
    /** The Livro Diário Auxiliar (or the cash report) of the month, PDF. */
    attachmentPath: text("attachment_path"),
    attachmentName: text("attachment_name"),
    /**
     * Every paper behind the declaration, in order: the book and the
     * system's reports (productivity, taxes). Null on the declarations of
     * before, which had only `attachmentPath`.
     */
    attachments: jsonb("attachments").$type<{ path: string; name: string }[]>(),
    /**
     * When the declaration reached the prefeitura ("YYYY-MM-DD") and the
     * reference it got there: the SEMUT's protocol, or the portal's.
     */
    filedOn: text("filed_on").notNull().default(""),
    filingReference: text("filing_reference").notNull().default(""),
    createdBy: text("created_by"),
    /** "Excluir": the row stays, out of the lists, and frees its number. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("iss_declarations_tenant_year_sequence_live")
      .on(t.tenantSlug, t.year, t.sequence)
      .where(sql`${t.deletedAt} is null`),
    index("iss_declarations_tenant_competence").on(t.tenantSlug, t.competence),
  ],
);

/**
 * Papel de segurança (decision of 11/11/2026; Provimento CGJ/RN 156/2016,
 * arts. 59 and 60): the lots the office receives, numbered sheet by sheet.
 * Nothing here is ever deleted: a lot typed wrong is voided, with the
 * reason, and stays in the classificador.
 */
export const securityPaperLots = pgTable(
  "security_paper_lots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** core/security-paper: certidao-rcpn, traslado, apostila, outro... */
    kind: text("kind").notNull(),
    kindLabel: text("kind_label").notNull().default(""),
    prefix: text("prefix").notNull().default(""),
    firstNumber: bigint("first_number", { mode: "number" }).notNull(),
    lastNumber: bigint("last_number", { mode: "number" }).notNull(),
    digits: integer("digits").notNull().default(6),
    /** "YYYY-MM-DD": arrived, or counted (opening stock). */
    receivedOn: text("received_on").notNull(),
    /** Stock the office had before the control began here. */
    opening: boolean("opening").notNull().default(false),
    /** Optional: the printer, the nota fiscal and the requisition. */
    supplier: text("supplier").notNull().default(""),
    invoice: text("invoice").notNull().default(""),
    requisition: text("requisition").notNull().default(""),
    notes: text("notes").notNull().default(""),
    /** The nota fiscal or the receipt, scanned (optional). */
    invoicePath: text("invoice_path"),
    invoiceName: text("invoice_name"),
    createdBy: text("created_by"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: text("voided_by"),
    voidReason: text("void_reason").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("security_paper_lots_tenant").on(t.tenantSlug, t.receivedOn)],
);

/**
 * What happened to a range of a lot's sheets: used in an act, spoiled,
 * damaged, lost or stolen. Voided, never deleted.
 */
export const securityPaperMovements = pgTable(
  "security_paper_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    lotId: uuid("lot_id")
      .notNull()
      .references(() => securityPaperLots.id),
    type: text("type").notNull(),
    firstNumber: bigint("first_number", { mode: "number" }).notNull(),
    lastNumber: bigint("last_number", { mode: "number" }).notNull(),
    occurredOn: text("occurred_on").notNull(),
    /** The act, the book and page, the police report. */
    reference: text("reference").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: text("voided_by"),
    voidReason: text("void_reason").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("security_paper_movements_tenant").on(t.tenantSlug, t.occurredOn),
    index("security_paper_movements_lot").on(t.lotId),
  ],
);

/**
 * The ofícios to the Corregedoria and the classificador's reports, each
 * with what it said frozen in `snapshot`, kept for good. The ofícios are
 * numbered by year (series "oficio-papel"); the report is not.
 */
export const securityPaperReports = pgTable(
  "security_paper_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** extravio | prestacao | relatorio */
    kind: text("kind").notNull(),
    year: integer("year").notNull(),
    sequence: integer("sequence"),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    /** The movements an ofício of art. 59 told (no reminder after). */
    movementIds: jsonb("movement_ids").$type<string[]>().notNull().default([]),
    signer: integer("signer").notNull().default(0),
    /** When and how it reached the Corregedoria (malote, e-mail, protocol). */
    sentOn: text("sent_on").notNull().default(""),
    sentReference: text("sent_reference").notNull().default(""),
    /** "Excluir": out of the lists, kept, with the reason. */
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removeReason: text("remove_reason").notNull().default(""),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("security_paper_reports_tenant_year_sequence")
      .on(t.tenantSlug, t.year, t.sequence)
      .where(sql`${t.sequence} is not null`),
    index("security_paper_reports_tenant").on(t.tenantSlug, t.periodEnd),
  ],
);

/**
 * Solicitação de papéis de segurança (decision of 11/11/2026): the
 * suppliers the office orders from, each with its items, texts and,
 * optionally, its own Word form. "Excluir" keeps the row.
 */
export const paperSuppliers = pgTable(
  "paper_suppliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** core/paper-orders SupplierSchema. */
    data: jsonb("data").notNull(),
    modelPath: text("model_path"),
    modelName: text("model_name"),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removeReason: text("remove_reason").notNull().default(""),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("paper_suppliers_tenant").on(t.tenantSlug)],
);

/** An order to a supplier, numbered by year; "Excluir" keeps the row. */
export const paperOrders = pgTable(
  "paper_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    year: integer("year").notNull(),
    sequence: integer("sequence").notNull(),
    supplierId: uuid("supplier_id")
      .notNull()
      .references(() => paperSuppliers.id),
    /** The supplier as it was when the order was last saved. */
    supplier: jsonb("supplier").notNull(),
    /** core/paper-orders OrderInputSchema. */
    order: jsonb("order").notNull(),
    status: text("status").notNull().default("rascunho"),
    sentOn: text("sent_on").notNull().default(""),
    receivedOn: text("received_on").notNull().default(""),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removeReason: text("remove_reason").notNull().default(""),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("paper_orders_tenant_year_sequence").on(
      t.tenantSlug,
      t.year,
      t.sequence,
    ),
    index("paper_orders_tenant").on(t.tenantSlug, t.createdAt),
  ],
);

/**
 * Livro Diário Auxiliar da Receita e da Despesa (decision of 11/11/2026;
 * Provimento CNJ nº 149/2023, arts. 189 to 195, with the wording of the
 * Provimento CNJ nº 259/2026). One row per line of the book: a revenue (an
 * act, or acts of one code on one day) or an expense. "Excluir" keeps it.
 */
export const dailyBookEntries = pgTable(
  "daily_book_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** receita | despesa */
    kind: text("kind").notNull(),
    occurredOn: text("occurred_on").notNull(),
    specialty: text("specialty").notNull().default(""),
    /** Expense: a category of art. 191-A, § 1º. */
    category: text("category").notNull().default(""),
    actCode: text("act_code").notNull().default(""),
    description: text("description").notNull(),
    quantity: integer("quantity").notNull().default(1),
    amountCents: bigint("amount_cents", { mode: "number" }).notNull(),
    /** Revenue: the State's funds and the ISS, shown, not revenue. */
    fundsCents: bigint("funds_cents", { mode: "number" }).notNull().default(0),
    issCents: bigint("iss_cents", { mode: "number" }).notNull().default(0),
    supplier: text("supplier").notNull().default(""),
    documentRef: text("document_ref").notNull().default(""),
    /** Art. 193-A, § 2º. */
    fiscalDistinct: boolean("fiscal_distinct").notNull().default(false),
    fiscalNote: text("fiscal_note").notNull().default(""),
    explanation: text("explanation").notNull().default(""),
    /** The receipt (art. 191-A, § 3º: kept 5 years). */
    attachmentPath: text("attachment_path"),
    attachmentName: text("attachment_name"),
    /** manual | produtividade | comprovante */
    source: text("source").notNull().default("manual"),
    importId: uuid("import_id"),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removeReason: text("remove_reason").notNull().default(""),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("daily_book_entries_tenant_day").on(t.tenantSlug, t.occurredOn),
    index("daily_book_entries_import").on(t.importId),
  ],
);

/** A report the office attached (the productivity), kept as sent. */
export const dailyBookImports = pgTable(
  "daily_book_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    filePath: text("file_path"),
    fileName: text("file_name"),
    /** What was read, as read (for a later check). */
    reading: jsonb("reading"),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removeReason: text("remove_reason").notNull().default(""),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("daily_book_imports_tenant").on(t.tenantSlug, t.periodStart)],
);

/** A page generated (the day, the month, the year), frozen in `snapshot`. */
export const dailyBookReports = pgTable(
  "daily_book_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** dia | mes | ano */
    kind: text("kind").notNull(),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    signer: integer("signer").notNull().default(0),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removeReason: text("remove_reason").notNull().default(""),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("daily_book_reports_tenant").on(t.tenantSlug, t.periodEnd)],
);

/**
 * The office's A1 certificates (assinador digital, product decision of
 * 10/11/2026): any number of them, e-CPF or e-CNPJ. The .pfx is kept
 * encrypted with the platform's key (lib/signature/vault.ts) on top of its
 * own password, which is never stored: the signer types it every time. The
 * holder's data is read from the certificate on upload, for the lists.
 */
export const signingCertificates = pgTable(
  "signing_certificates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** What the office calls it: "Titular", "e-CNPJ da serventia". */
    label: text("label").notNull(),
    holderName: text("holder_name").notNull(),
    /** CPF or CNPJ digits, as the certificate states them. */
    holderDocument: text("holder_document").notNull(),
    /** "cpf", "cnpj" or "outro". */
    kind: text("kind").notNull(),
    issuerName: text("issuer_name").notNull(),
    serialHex: text("serial_hex").notNull(),
    fingerprint: text("fingerprint").notNull(),
    notBefore: timestamp("not_before", { withTimezone: true }).notNull(),
    notAfter: timestamp("not_after", { withTimezone: true }).notNull(),
    /** base64 of iv, tag and ciphertext (AES-256-GCM). */
    encryptedPfx: text("encrypted_pfx").notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Taken out of use ("Desativar"): kept for the record, never signs. */
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
  },
  (t) => [
    index("signing_certificates_tenant").on(t.tenantSlug),
    uniqueIndex("signing_certificates_tenant_fingerprint_live")
      .on(t.tenantSlug, t.fingerprint)
      .where(sql`${t.disabledAt} is null`),
  ],
);

/** Who the administrator allowed to sign with each certificate. */
export const signingCertificateSigners = pgTable(
  "signing_certificate_signers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    certificateId: uuid("certificate_id")
      .notNull()
      .references(() => signingCertificates.id),
    tenantSlug,
    userId: text("user_id").notNull(),
    grantedBy: text("granted_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Authorization withdrawn: the row stays as the history. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("signing_certificate_signers_cert").on(t.certificateId),
    uniqueIndex("signing_certificate_signers_live")
      .on(t.certificateId, t.userId)
      .where(sql`${t.revokedAt} is null`),
  ],
);

/**
 * A computer of the office where an A3 token stays plugged, lent to the
 * whole office (decision of 16/11/2026: "um gerenciador de compartilhamento
 * de certificado"). The Assinador Veridia there calls the platform with its
 * key (only the hash is kept), reports the certificates plugged in and signs
 * what is asked. Switched off by a mark, never deleted.
 */
export const signingStations = pgTable(
  "signing_stations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** What the office calls the computer: "Balcão 1", "Sala do Tabelião". */
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    version: text("version"),
    /** The public part of each certificate plugged in, as last reported. */
    certificates: jsonb("certificates").notNull().default([]),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: text("revoked_by"),
  },
  (t) => [
    uniqueIndex("signing_stations_key").on(t.keyHash),
    index("signing_stations_tenant").on(t.tenantSlug),
  ],
);

/**
 * How one certificate of a station is shared (decision of 16/11/2026: the
 * Tabelião chooses per certificate): who may ask and, for each person, what
 * kinds of document, at what hours and until when (`grants`, see
 * core/signature/station StationGrant), and whether each use is confirmed
 * at the station ("cada") or released for a while ("periodo", until
 * `releasedUntil`).
 */
export const stationCertificatePolicies = pgTable(
  "station_certificate_policies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    stationId: uuid("station_id")
      .notNull()
      .references(() => signingStations.id),
    /** The certificate's SHA-1 fingerprint, as the station reports it. */
    certificateKey: text("certificate_key").notNull(),
    shared: boolean("shared").notNull().default(false),
    mode: text("mode").notNull().default("cada"),
    grants: jsonb("grants").notNull().default([]),
    releasedUntil: timestamp("released_until", { withTimezone: true }),
    updatedBy: text("updated_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("station_certificate_policies_cert").on(
      t.stationId,
      t.certificateKey,
    ),
  ],
);

/**
 * One signature asked of a station: who asked, for what, and how it ended.
 * Only the bytes to be signed travel (the signed attributes), never the
 * document; the row stays as the record of the use.
 */
export const stationSignJobs = pgTable(
  "station_sign_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    stationId: uuid("station_id")
      .notNull()
      .references(() => signingStations.id),
    certificateKey: text("certificate_key").notNull(),
    /** Whose certificate it is, as it read when asked. */
    holderName: text("holder_name").notNull().default(""),
    requestedBy: text("requested_by").notNull(),
    requestedByName: text("requested_by_name").notNull(),
    /** The kind of document, by the screen it came from (SIGN_KINDS). */
    kind: text("kind").notNull().default("outros"),
    title: text("title").notNull(),
    /** The signed document it became, when the platform knows it. */
    signedDocumentId: uuid("signed_document_id"),
    signedCode: text("signed_code"),
    toBeSigned: text("to_be_signed").notNull(),
    mode: text("mode").notNull(),
    /** pendente, enviada, assinada, recusada, expirada. */
    status: text("status").notNull().default("pendente"),
    signature: text("signature"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
  },
  (t) => [
    index("station_sign_jobs_station").on(t.stationId, t.status),
    index("station_sign_jobs_tenant").on(t.tenantSlug, t.createdAt),
  ],
);

/**
 * A document signed in the platform. The record is kept for good (anyone
 * may verify years later); the signed PDF only for six months (decision of
 * 10/11/2026), then its file goes and `filePurgedAt` says when.
 */
export const signedDocuments = pgTable(
  "signed_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** "AB12CD34EF56": the verification code, upper case, no dashes. */
    code: text("code").notNull(),
    title: text("title").notNull(),
    originalName: text("original_name").notNull(),
    originalSha256: text("original_sha256").notNull(),
    pageCount: integer("page_count").notNull(),
    /** The latest signed file; null once purged. */
    filePath: text("file_path"),
    fileExpiresAt: timestamp("file_expires_at", {
      withTimezone: true,
    }).notNull(),
    filePurgedAt: timestamp("file_purged_at", { withTimezone: true }),
    /**
     * Taken off the office's list (decision of 11/11/2026): nothing is
     * erased. The file stops being served, here and on the public page;
     * the record still answers the verification, and the office can put
     * it back.
     */
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("signed_documents_code").on(t.code),
    index("signed_documents_tenant_created").on(t.tenantSlug, t.createdAt),
  ],
);

/** Each signature on a signed document, in order, with what it produced. */
export const signedDocumentSignatures = pgTable(
  "signed_document_signatures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => signedDocuments.id),
    tenantSlug,
    certificateId: uuid("certificate_id").references(
      () => signingCertificates.id,
    ),
    // The certificate as it was, so the record outlives a removed one.
    holderName: text("holder_name").notNull(),
    holderDocument: text("holder_document").notNull(),
    issuerName: text("issuer_name").notNull(),
    serialHex: text("serial_hex").notNull(),
    policyOid: text("policy_oid").notNull(),
    /** SHA-256 of the whole file after this signature. */
    resultSha256: text("result_sha256").notNull(),
    signedBy: text("signed_by"),
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    index("signed_document_signatures_document").on(t.documentId),
    index("signed_document_signatures_result").on(t.resultSha256),
  ],
);

/**
 * The Tabelião/Registrador's notes on entries of the audit trail
 * (Auditoria, decision of 11/11/2026). The trail itself never changes.
 */
export const auditNotes = pgTable(
  "audit_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    auditId: uuid("audit_id")
      .notNull()
      .references(() => auditLog.id),
    authorId: text("author_id"),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** The holder corrected the note (decision of 11/11/2026). */
    editedAt: timestamp("edited_at", { withTimezone: true }),
    /** "Excluir": the note leaves the screen and stays in the database. */
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
  },
  (t) => [index("audit_notes_audit").on(t.auditId)],
);

/**
 * A formal notification asking a person of the office to explain acts of
 * the audit trail, with 24 hours to answer (decision of 11/11/2026). Numbered
 * per year like the other documents (Configurações › Numeração).
 */
export const auditNotifications = pgTable(
  "audit_notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    year: integer("year").notNull(),
    sequence: integer("sequence").notNull(),
    targetUserId: text("target_user_id").notNull(),
    createdBy: text("created_by"),
    subject: text("subject").notNull(),
    facts: text("facts").notNull(),
    legalBasis: text("legal_basis").notNull(),
    /** The audit_log entries the notification is about. */
    auditIds: jsonb("audit_ids").notNull().default([]),
    deadlineAt: timestamp("deadline_at", { withTimezone: true }).notNull(),
    /** "aberta", "respondida" or "encerrada". */
    status: text("status").notNull().default("aberta"),
    response: text("response"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closingNote: text("closing_note"),
    /** The signed PDF, when the Tabelião signed it in the assinador. */
    signedDocumentId: uuid("signed_document_id").references(
      () => signedDocuments.id,
    ),
    emailedAt: timestamp("emailed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("audit_notifications_tenant_year_sequence").on(
      t.tenantSlug,
      t.year,
      t.sequence,
    ),
    index("audit_notifications_target").on(t.tenantSlug, t.targetUserId),
  ],
);

/** Images and files of a notification: the Tabelião's evidence or the answer's. */
export const auditNotificationFiles = pgTable(
  "audit_notification_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    notificationId: uuid("notification_id")
      .notNull()
      .references(() => auditNotifications.id),
    tenantSlug,
    /** "titular" (evidence) or "notificado" (sent with the answer). */
    side: text("side").notNull(),
    displayName: text("display_name").notNull(),
    storedName: text("stored_name").notNull(),
    path: text("path").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: text("uploaded_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("audit_notification_files_notification").on(t.notificationId)],
);

/**
 * The Tabelião/Registrador saw an urgent act (decision of 11/11/2026): the
 * panel's alert for it ends. One per entry; the entry itself never changes.
 */
export const auditReviews = pgTable(
  "audit_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    auditId: uuid("audit_id")
      .notNull()
      .references(() => auditLog.id),
    reviewedBy: text("reviewed_by").notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * Taken off the trail's list by the holder (decision of 11/11/2026):
     * nothing is erased, the entry stays and comes back from "Arquivados".
     */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedBy: text("archived_by"),
  },
  (t) => [uniqueIndex("audit_reviews_audit").on(t.auditId)],
);

/* ---------------------------------------------------- mensagens internas */

/**
 * Each person's face in the internal messenger: photo, status, the line
 * under the name, the window's colour and whether it rings. One per account.
 */
export const messengerProfiles = pgTable("messenger_profiles", {
  userId: text("user_id").primaryKey(),
  tenantSlug,
  photoPath: text("photo_path"),
  status: text("status").notNull().default("disponivel"),
  personalMessage: text("personal_message"),
  color: text("color").notNull().default("verde"),
  sound: boolean("sound").notNull().default(true),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  /**
   * The daily lunch window, "HH:MM" and up to 60 minutes, as the
   * Tabelião/Registrador approved it (decision of 11/11/2026). Inside it
   * the person shows "Horário de almoço"; after it, available again.
   */
  lunchStart: text("lunch_start"),
  lunchMinutes: integer("lunch_minutes"),
  /** A change asked for, waiting for the holder's yes or no. */
  lunchPendingStart: text("lunch_pending_start"),
  lunchPendingMinutes: integer("lunch_pending_minutes"),
  lunchRequestedAt: timestamp("lunch_requested_at", { withTimezone: true }),
  /** The holder turned this person's messenger off. */
  chatDisabledAt: timestamp("chat_disabled_at", { withTimezone: true }),
  chatDisabledBy: text("chat_disabled_by"),
  /** When the status last changed: an away one lapses after 60 minutes. */
  statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
  /** "Voltei do almoço": unlocks the chat inside today's window. */
  lunchReturnedAt: timestamp("lunch_returned_at", { withTimezone: true }),
  /**
   * "Digitando…" (decision of 19/11/2026): the conversation this person is
   * writing in and when they last typed. A ping, not history: it is
   * overwritten every few seconds and read only while fresh.
   */
  typingConversationId: uuid("typing_conversation_id"),
  typingAt: timestamp("typing_at", { withTimezone: true }),
  /**
   * The person's own sounds (decision of 19/11/2026). Null means "o som da
   * serventia" (Configurações › Notificações) for the message tone and the
   * standard one for "Chamar atenção".
   */
  messageSound: text("message_sound"),
  nudgeSound: text("nudge_sound"),
  soundVolume: integer("sound_volume").notNull().default(80),
  /** Also ring for the conversation that is open on screen. */
  soundInChat: boolean("sound_in_chat").notNull().default(true),
  /** Also ring while the panel is in a tab out of sight. */
  soundInBackground: boolean("sound_in_background").notNull().default(true),
  /** The tone comes back every few seconds while anything waits unread. */
  repeatUntilRead: boolean("repeat_until_read").notNull().default(true),
  /** "Não perturbe": no sound until then. */
  quietUntil: timestamp("quiet_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** A conversation between two people of the office (or a group). */
export const messengerConversations = pgTable(
  "messenger_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** "a:b" with the two account ids sorted: one direct conversation per pair. */
    pairKey: text("pair_key"),
    title: text("title"),
    createdBy: text("created_by").notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("messenger_conversations_pair").on(t.tenantSlug, t.pairKey),
  ],
);

export const messengerMembers = pgTable(
  "messenger_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => messengerConversations.id),
    userId: text("user_id").notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    /**
     * "Limpar conversa" (decision of 11/11/2026): messages up to here are
     * hidden from this member only; the other one and the holder keep them.
     */
    clearedAt: timestamp("cleared_at", { withTimezone: true }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("messenger_members_unique").on(t.conversationId, t.userId),
    index("messenger_members_user").on(t.userId),
  ],
);

export const messengerMessages = pgTable(
  "messenger_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => messengerConversations.id),
    tenantSlug,
    senderId: text("sender_id").notNull(),
    /** "texto" | "arquivo" | "audio" | "chamar" (core/messages/rules.ts). */
    kind: text("kind").notNull(),
    body: text("body"),
    filePath: text("file_path"),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * Edited by its author: the text as first sent stays here, for the
     * holder's oversight (decision of 11/11/2026).
     */
    editedAt: timestamp("edited_at", { withTimezone: true }),
    originalBody: text("original_body"),
    /** "Apagar": hidden from the conversation, kept for the holder. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by"),
    /** "Responder" (decision of 19/11/2026): the message this one answers. */
    replyToId: uuid("reply_to_id"),
  },
  (t) => [
    index("messenger_messages_conversation").on(t.conversationId, t.createdAt),
  ],
);

/**
 * A reaction to a message, one per person per message, like the phone
 * messengers (decision of 19/11/2026). Taking it back stamps `removedAt`
 * instead of erasing the row; choosing again brings it back.
 */
export const messengerReactions = pgTable(
  "messenger_reactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    // No foreign key on purpose: the demonstration's cleaning erases the
    // messages and keeps this table (DEMO_RESET_KEPT), and a reaction whose
    // message is gone is simply never read again.
    messageId: uuid("message_id").notNull(),
    userId: text("user_id").notNull(),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Any change (new emoji, taken back): what an open screen follows. */
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("messenger_reactions_one").on(t.messageId, t.userId),
    index("messenger_reactions_updated").on(t.updatedAt),
  ],
);

/**
 * RCPN index (change `consulta-de-registro-rcpn`): each file the office sends
 * from its registry system. The reading waits here, with its conference,
 * until someone publishes it or discards it; the original file is kept only
 * while the import is open and removed after (design, decision 5): the
 * office keeps its own original in its registry system.
 */
export const rcpnImports = pgTable(
  "rcpn_imports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    fileName: text("file_name").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    /** SHA-256 of the file: the same file is never imported twice. */
    sha256: text("sha256").notNull(),
    /** Blob URL or disk path while open; null once published or discarded. */
    storedPath: text("stored_path"),
    /** What the reader recognised: "cartosoft-access", "carga-xml"... */
    format: text("format").notNull().default(""),
    /** lida | nao-lida | publicada | descartada */
    status: text("status").notNull(),
    /** The readable notes: what was read, what was not and why. */
    notes: jsonb("notes").notNull().default(sql`'[]'::jsonb`),
    /** The records read (core/rcpn RcpnRecord[]), until published. */
    records: jsonb("records"),
    publishedCount: integer("published_count"),
    uploadedBy: text("uploaded_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: text("closed_by"),
  },
  (t) => [index("rcpn_imports_tenant").on(t.tenantSlug, t.createdAt)],
);

/** One registro of the index: nascimento, casamento or óbito. */
export const rcpnRecords = pgTable(
  "rcpn_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    kind: text("kind").notNull(),
    /** "natimorto" for an óbito of the Livro C Auxiliar; "" otherwise. */
    subtype: text("subtype").notNull().default(""),
    /** core/rcpn recordKey: the matrícula, or book/page/term without one. */
    recordKey: text("record_key").notNull(),
    matricula: text("matricula").notNull().default(""),
    book: text("book").notNull().default(""),
    page: text("page").notNull().default(""),
    term: text("term").notNull().default(""),
    registeredOn: text("registered_on").notNull().default(""),
    eventOn: text("event_on").notNull().default(""),
    /**
     * The rest of the registro, as the certidão prints it (core/rcpn
     * RcpnRecord.details): kept so the certidão comes out ready.
     */
    details: jsonb("details").notNull().default(sql`'{}'::jsonb`),
    importId: uuid("import_id").references(() => rcpnImports.id),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /**
     * Corrected by hand in the panel (decision of 14/11/2026): a later
     * import does not write over it unless the person chooses to.
     */
    editedAt: timestamp("edited_at", { withTimezone: true }),
    editedBy: text("edited_by"),
    /**
     * Cancelled in the panel (decision of 14/11/2026, "como no sistema
     * atual"): the registro stays, marked, and can be restored (estorno).
     */
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    canceledBy: text("canceled_by"),
    cancelReason: text("cancel_reason"),
  },
  (t) => [
    uniqueIndex("rcpn_records_key").on(t.tenantSlug, t.kind, t.recordKey),
  ],
);

/**
 * Every correction, cancellation and estorno of a registro of the index:
 * who, when, why, and the fields before and after. Only added to.
 */
export const rcpnRecordChanges = pgTable(
  "rcpn_record_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    recordId: uuid("record_id")
      .notNull()
      .references(() => rcpnRecords.id),
    /** edicao | cancelamento | estorno */
    kind: text("kind").notNull(),
    reason: text("reason").notNull(),
    /** [{ key, label, before, after }] (core/rcpn/ficha FichaChange). */
    changes: jsonb("changes").notNull().default(sql`'[]'::jsonb`),
    actorId: text("actor_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("rcpn_record_changes_record").on(t.recordId, t.createdAt)],
);

/** A person of a registro: the one searched by name, mother and birth. */
export const rcpnPeople = pgTable(
  "rcpn_people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    recordId: uuid("record_id")
      .notNull()
      .references(() => rcpnRecords.id),
    /** registrado | conjuge1 | conjuge2 | falecido */
    role: text("role").notNull(),
    name: text("name").notNull(),
    /** core/rcpn normalizeName: what the lookups compare. */
    nameNorm: text("name_norm").notNull(),
    marriedName: text("married_name").notNull().default(""),
    motherName: text("mother_name").notNull().default(""),
    motherNorm: text("mother_norm").notNull().default(""),
    fatherName: text("father_name").notNull().default(""),
    birthDate: text("birth_date").notNull().default(""),
    profession: text("profession").notNull().default(""),
    fatherProfession: text("father_profession").notNull().default(""),
    motherProfession: text("mother_profession").notNull().default(""),
  },
  (t) => [
    uniqueIndex("rcpn_people_role").on(t.recordId, t.role),
    index("rcpn_people_lookup").on(t.tenantSlug, t.nameNorm, t.birthDate),
    index("rcpn_people_birth").on(t.tenantSlug, t.birthDate),
  ],
);

/**
 * A certidão of the Registro Civil issued from the panel, in the national
 * standard (change consulta-de-registro-rcpn, decision of 14/11/2026): the
 * fields as the person checked them against the book, the selo pasted from
 * the TJRN lot, and the signed or scanned file attached later. Edited with a
 * justification, removed by a mark: never deleted.
 */
export const rcpnCertidoes = pgTable(
  "rcpn_certidoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    kind: text("kind").notNull(),
    /** "natimorto" when issued for one; "" otherwise. */
    subtype: text("subtype").notNull().default(""),
    /** core/rcpn/certidao CertidaoForm: "breve" or "inteiro-teor". */
    form: text("form").notNull().default("breve"),
    recordId: uuid("record_id").references(() => rcpnRecords.id),
    /** core/rcpn/certidao field key → value, as printed. */
    fields: jsonb("fields").notNull(),
    /** The selo code pasted from the TJRN lot (no caixa yet). */
    seal: text("seal").notNull().default(""),
    /** Normal or isento, as the lot says. */
    sealKind: text("seal_kind").notNull().default(""),
    /** The amounts line, as the office prints it (optional). */
    fees: text("fees").notNull().default(""),
    /** Who signs: name and title. */
    signerName: text("signer_name").notNull().default(""),
    signerTitle: text("signer_title").notNull().default(""),
    attachmentPath: text("attachment_path"),
    attachmentName: text("attachment_name"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removedReason: text("removed_reason"),
  },
  (t) => [index("rcpn_certidoes_tenant").on(t.tenantSlug, t.createdAt)],
);

/**
 * A processo de habilitação para o casamento (change
 * habilitacao-de-casamento, decision of 14/11/2026): numbered per year, its
 * data typed once as fields (core/rcpn/habilitacao), every document drawn
 * from them. Canceled by a mark, with who, when and why: never deleted.
 */
export const rcpnHabilitacoes = pgTable(
  "rcpn_habilitacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    year: integer("year").notNull(),
    sequence: integer("sequence").notNull(),
    /** core/rcpn/habilitacao field key → value. */
    fields: jsonb("fields").notNull().default(sql`'{}'::jsonb`),
    /** The edital published on the site from here, when it was. */
    publicationId: uuid("publication_id"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    canceledBy: text("canceled_by"),
    cancelReason: text("cancel_reason"),
  },
  (t) => [
    uniqueIndex("rcpn_habilitacoes_tenant_year_sequence").on(
      t.tenantSlug,
      t.year,
      t.sequence,
    ),
    index("rcpn_habilitacoes_tenant").on(t.tenantSlug, t.createdAt),
  ],
);

/**
 * Everything done to a habilitação: opened, corrected, edital published,
 * canceled, restored. Who, when, why and each field before and after.
 * Only added to.
 */
export const rcpnHabilitacaoChanges = pgTable(
  "rcpn_habilitacao_changes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    habilitacaoId: uuid("habilitacao_id")
      .notNull()
      .references(() => rcpnHabilitacoes.id),
    /** abertura | edicao | edital | cancelamento | estorno */
    kind: text("kind").notNull(),
    reason: text("reason").notNull().default(""),
    /** [{ key, label, before, after }] (core/rcpn/habilitacao). */
    changes: jsonb("changes").notNull().default(sql`'[]'::jsonb`),
    actorId: text("actor_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("rcpn_habilitacao_changes_habilitacao").on(
      t.habilitacaoId,
      t.createdAt,
    ),
  ],
);

/**
 * An act that changed the ownership of an imóvel, to be told to the
 * prefeitura (CNN, art. 184-A; change comunicacao-titularidade-prefeitura,
 * decision of 14/11/2026): read from the escritura or the registro, checked
 * by the person, kept by competence (the act's month). Removed by a mark,
 * with who, when and why: never deleted.
 */
export const titleTransfers = pgTable(
  "title_transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** "YYYY-MM": the month of the act. */
    competence: text("competence").notNull(),
    /** core/titularidade TitleTransfer. */
    data: jsonb("data").notNull(),
    /** The file it was read from, when it was. */
    sourceName: text("source_name").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removedReason: text("removed_reason"),
  },
  (t) => [index("title_transfers_competence").on(t.tenantSlug, t.competence)],
);

/**
 * The month's ofício to the Secretaria Municipal de Tributação: numbered,
 * with the acts as they stood when it was made (so the paper can be drawn
 * again the same), and the sending: when, how and the receipt.
 */
export const titleTransferFilings = pgTable(
  "title_transfer_filings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    competence: text("competence").notNull(),
    year: integer("year").notNull(),
    sequence: integer("sequence").notNull(),
    /** core/titularidade TitleTransfer[] as sent. */
    transfers: jsonb("transfers").notNull().default(sql`'[]'::jsonb`),
    /** The ofício's date (ISO). */
    issuedOn: text("issued_on").notNull(),
    /**
     * The electronic sending with its receipt (CNN, art. 184-A, § 2º): the
     * day, the platform (core/titularidade CHANNELS: cnb, onr, cnb-onr), the
     * receipt's number and, when attached, the receipt itself.
     */
    sentOn: text("sent_on").notNull().default(""),
    channel: text("channel").notNull().default(""),
    receipt: text("receipt").notNull().default(""),
    receiptPath: text("receipt_path"),
    receiptName: text("receipt_name"),
    /** The signed ofício delivered to the SEMUT too, when it was. */
    semutOn: text("semut_on").notNull().default(""),
    semutReceipt: text("semut_receipt").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removedReason: text("removed_reason"),
  },
  (t) => [
    uniqueIndex("title_transfer_filings_tenant_year_sequence").on(
      t.tenantSlug,
      t.year,
      t.sequence,
    ),
  ],
);

/**
 * A source of the legal base the AI is taught with (change
 * qualificacao-de-titulos, decision of 15/11/2026): a law, a provimento, a
 * decision, a model. The file it came in is never kept; only its text, in
 * knowledge_passages. Removed by a mark, with who, when and why.
 */
export const knowledgeSources = pgTable(
  "knowledge_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** core/conhecimento SourceMeta. */
    meta: jsonb("meta").notNull(),
    /** Where the text came from: the file's name, "colado" or the URL. */
    origin: text("origin").notNull().default(""),
    characters: integer("characters").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removedReason: text("removed_reason"),
  },
  (t) => [index("knowledge_sources_tenant").on(t.tenantSlug)],
);

/** A source's text, split by article or passage, for the search. */
export const knowledgePassages = pgTable(
  "knowledge_passages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    sourceId: uuid("source_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    heading: text("heading").notNull(),
    text: text("text").notNull(),
  },
  (t) => [
    index("knowledge_passages_source").on(t.sourceId, t.ordinal),
    index("knowledge_passages_tenant").on(t.tenantSlug),
  ],
);

/**
 * A título under qualificação (change qualificacao-de-titulos, decision of
 * 15/11/2026), in any attribution: the presentation, the rounds and their
 * exigências as items (core/qualificacao QualificationData). The documents
 * presented are not kept here. Removed by a mark, with who, when and why.
 */
export const qualifications = pgTable(
  "qualifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** core/qualificacao Attribution. */
    attribution: text("attribution").notNull(),
    /** core/qualificacao QualificationStatus, kept for the list. */
    status: text("status").notNull(),
    data: jsonb("data").notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removedReason: text("removed_reason"),
  },
  (t) => [index("qualifications_tenant").on(t.tenantSlug, t.status)],
);

/**
 * A nota devolutiva or a termo de qualificação positiva issued, numbered
 * per year, with the qualificação as it was when issued (so the paper is
 * drawn again exactly). Excluded by a mark; the number is never reused.
 */
export const qualificationNotes = pgTable(
  "qualification_notes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    qualificationId: uuid("qualification_id").notNull(),
    /** devolutiva or positiva. */
    kind: text("kind").notNull(),
    year: integer("year").notNull(),
    sequence: integer("sequence").notNull(),
    roundIndex: integer("round_index").notNull(),
    snapshot: jsonb("snapshot").notNull(),
    /** ISO day the paper is dated. */
    issuedOn: text("issued_on").notNull(),
    signerName: text("signer_name").notNull().default(""),
    signerRole: text("signer_role").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removedReason: text("removed_reason"),
  },
  (t) => [
    uniqueIndex("qualification_notes_number").on(
      t.tenantSlug,
      t.kind,
      t.year,
      t.sequence,
    ),
    index("qualification_notes_qualification").on(t.qualificationId),
  ],
);

/**
 * The office's library of exigências, by attribution and act: seeded from
 * core/qualificacao/biblioteca once, then the office's own (edited,
 * added, excluded by a mark). `uses` puts the most used first.
 */
export const qualificationLibrary = pgTable(
  "qualification_library",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    attribution: text("attribution").notNull(),
    /** ACTS keys it serves; empty: all. */
    acts: jsonb("acts").notNull().default([]),
    title: text("title").notNull(),
    description: text("description").notNull(),
    howToComply: text("how_to_comply").notNull(),
    basis: text("basis").notNull(),
    /** The seed it came from (core/qualificacao/biblioteca), when it did. */
    seedKey: text("seed_key"),
    /**
     * "serventia": written or kept by the office (and the seeds);
     * "aprendida": learned from a note the team attached (decision of
     * 16/11/2026: "sempre aprenda"), generic and with no personal data.
     */
    origin: text("origin").notNull().default("serventia"),
    uses: integer("uses").notNull().default(0),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removedReason: text("removed_reason"),
  },
  (t) => [
    index("qualification_library_tenant").on(t.tenantSlug, t.attribution),
    uniqueIndex("qualification_library_seed").on(t.tenantSlug, t.seedKey),
  ],
);

/**
 * The review of a note (or any document) the team attaches to an exigência
 * (decision of 16/11/2026): what the office's legal base and the AI found
 * against the law, what the clerk decided, and what was learned from it.
 * One per file per office (by the file's hash): the same file attached
 * twice is reviewed once. Nothing of the file itself is kept here, only
 * the findings and the generic models, with no personal data.
 */
export const qualificationDocumentReviews = pgTable(
  "qualification_document_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    fileHash: text("file_hash").notNull(),
    fileName: text("file_name").notNull(),
    requestId: uuid("request_id").references(() => serviceRequests.id, {
      onDelete: "set null",
    }),
    attachmentId: uuid("attachment_id").references(
      () => serviceRequestAttachments.id,
      { onDelete: "set null" },
    ),
    attribution: text("attribution"),
    /** core/qualificacao/revisao ReviewResult. */
    result: jsonb("result").notNull(),
    /** Why the AI did not review it, when it did not (the base still did). */
    aiError: text("ai_error"),
    reviewedBy: text("reviewed_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** "manteve" | "alterou": the clerk's call, after the warning. */
    decision: text("decision"),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    learnedAt: timestamp("learned_at", { withTimezone: true }),
    learnedCount: integer("learned_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("qualification_document_reviews_file").on(
      t.tenantSlug,
      t.fileHash,
    ),
    index("qualification_document_reviews_attachment").on(t.attachmentId),
  ],
);

/**
 * The analysis of a cédula de crédito (decision of 21/11/2026, change
 * analise-de-cedulas): the data read from the cédula and its aditivos,
 * checked by the clerk, and the models of the acts as the office edited
 * them. The files are read and dropped (only their names are kept); a
 * pedido's attachments stay in the pedido. Edits keep the previous value
 * in `history`; "apagar" is a mark, never a deleted row.
 */
export const cedulaAnalyses = pgTable(
  "cedula_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    requestId: uuid("request_id").references(() => serviceRequests.id, {
      onDelete: "set null",
    }),
    /** core/cedulas CedulaKind, kept for the list. */
    kind: text("kind").notNull(),
    title: text("title").notNull().default(""),
    /** core/cedulas CedulaData. */
    data: jsonb("data").notNull(),
    /** The models the office edited, by id: { [id]: text }. */
    models: jsonb("models").notNull().default({}),
    /** [{ at, by, what, previous }], newest last, at most 50. */
    history: jsonb("history").notNull().default([]),
    /** The names of the files read, never the files. */
    files: jsonb("files").notNull().default([]),
    /** "assistente" | "leitura" | "manual": how the data was read. */
    source: text("source").notNull(),
    /** Why the assistente virtual did not read it, when it did not. */
    aiNote: text("ai_note"),
    /** What the reading suggested, for the learning: the kind and its cue. */
    detectedKind: text("detected_kind"),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removedReason: text("removed_reason"),
  },
  (t) => [
    index("cedula_analyses_tenant").on(t.tenantSlug, t.createdAt),
    index("cedula_analyses_request").on(t.requestId),
  ],
);

/**
 * What the office taught by correcting a cédula's kind (decision of
 * 21/11/2026: "salvar o que aprendeu"): only the words of the title that
 * say the kind (core/cedulas cueOf), no number, no name. Excluded by a
 * mark, like the rest.
 */
export const cedulaLearnedCues = pgTable(
  "cedula_learned_cues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    cue: text("cue").notNull(),
    kind: text("kind").notNull(),
    uses: integer("uses").notNull().default(1),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
  },
  (t) => [uniqueIndex("cedula_learned_cues_cue").on(t.tenantSlug, t.cue)],
);

/**
 * What the AI asks the office for the legal base (decision of 15/11/2026:
 * "caso ela precise, ela pergunte se o cartório gostaria de inserir um
 * documento, leis etc. atualizada, mas que ela sempre busque na base legal
 * da rede"): a norma missing or changed, found on the official sites. Not
 * a chat: the office answers with a button (import, send, dismiss with a
 * reason). Kept with how it was answered; never deleted.
 */
export const knowledgeRequests = pgTable(
  "knowledge_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** "Lei nº 6.015/1973 alterada pela Lei nº 14.382/2022". */
    topic: text("topic").notNull(),
    /** Why the AI asks, with what it found on the official site. */
    detail: text("detail").notNull().default(""),
    /** The official address of the text in force, when found. */
    officialUrl: text("official_url").notNull().default(""),
    /** The source it concerns, when it is an update. */
    sourceId: uuid("source_id"),
    /** open, done or dismissed. */
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdBy: text("created_by").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by"),
    resolvedNote: text("resolved_note"),
  },
  (t) => [index("knowledge_requests_tenant").on(t.tenantSlug, t.status)],
);

/**
 * An act told to the CENSEC (CNN, arts. 265 to 272; change
 * cargas-censec, decision of 14/11/2026): read from the escritura,
 * procuração, ata or testamento attached, which is never kept; checked by
 * the person and kept by quinzena and central. Removed by a mark, with
 * who, when and why: never deleted.
 */
export const censecActs = pgTable(
  "censec_acts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** "YYYY-MM-1" or "YYYY-MM-2": the act's fortnight. */
    quinzena: text("quinzena").notNull(),
    /** core/censec Central: cep, cesdi, rcto. */
    central: text("central").notNull(),
    /** core/censec CensecAct. */
    data: jsonb("data").notNull(),
    /** The name of the file it was read from (the file is not kept). */
    sourceName: text("source_name").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removedReason: text("removed_reason"),
  },
  (t) => [index("censec_acts_quinzena").on(t.tenantSlug, t.quinzena)],
);

/**
 * The fechamento of a central's quinzena in the CENSEC, positive or
 * negative (CNN, arts. 267, 270 and 272: "arquivando-se digitalmente o
 * comprovante"): the day, the protocol the CENSEC gave and how many acts
 * went. Removed by a mark, with the reason.
 */
export const censecClosings = pgTable(
  "censec_closings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    quinzena: text("quinzena").notNull(),
    central: text("central").notNull(),
    /** How many acts went; 0 is the informação negativa. */
    acts: integer("acts").notNull().default(0),
    sentOn: text("sent_on").notNull(),
    protocol: text("protocol").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removedReason: text("removed_reason"),
  },
  (t) => [index("censec_closings_quinzena").on(t.tenantSlug, t.quinzena)],
);

/**
 * Files sent to an attribution (decision of 14/11/2026: "em todos deixe o
 * campo de importar os arquivos"): any format, kept as it came. An
 * exclusion only marks the row, with who, when and why.
 */
export const attributionFiles = pgTable(
  "attribution_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** core/attributions/guides slug: "registro-de-imoveis", "notas"... */
    attribution: text("attribution").notNull(),
    fileName: text("file_name").notNull(),
    /** What the person says the file is (optional). */
    description: text("description").notNull().default(""),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: text("sha256").notNull(),
    storedPath: text("stored_path").notNull(),
    /** core/attributions/files recognizeFile label. */
    format: text("format").notNull(),
    uploadedBy: text("uploaded_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
    removedReason: text("removed_reason"),
  },
  (t) => [
    index("attribution_files_list").on(
      t.tenantSlug,
      t.attribution,
      t.createdAt,
    ),
  ],
);

/**
 * The DPO assistant's conversations (change `assistente-do-dpo`). Every
 * text stored here went through `core/dpo/mask.ts` first: what a person
 * typed is never kept as typed. Each person sees only their own; the
 * platform account reads all of them.
 */
export const dpoConversations = pgTable(
  "dpo_conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    userId: text("user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** The position at the time, so the platform reads it without a name. */
    userRole: text("user_role").notNull(),
    /** "chat", "reply-draft" (the draft button) or "data-rights" (a requerimento's conversation). */
    kind: text("kind").notNull().default("chat"),
    /** The first question, already masked, cut short. */
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("dpo_conversations_owner").on(
      t.tenantSlug,
      t.userId,
      t.lastMessageAt,
    ),
    index("dpo_conversations_last_message_at").on(t.lastMessageAt),
  ],
);

export const dpoMessages = pgTable(
  "dpo_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => dpoConversations.id, { onDelete: "cascade" }),
    tenantSlug,
    /** "user", "assistant" or "refusal". */
    role: text("role").notNull(),
    content: text("content").notNull(),
    /** core/dpo/mask MaskCounts: what was hidden from a "user" message. */
    maskedCounts: jsonb("masked_counts").notNull().default(sql`'{}'::jsonb`),
    /** Knowledge base ids the answer cites, validated by the platform. */
    sources: jsonb("sources").notNull().default(sql`'[]'::jsonb`),
    /** Ids the model wrote that were not delivered to it: for review. */
    invalidCitations: jsonb("invalid_citations")
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("dpo_messages_conversation_created_at").on(
      t.conversationId,
      t.createdAt,
    ),
  ],
);

/** Answered and refused questions per office and month (office's clock). */
export const dpoMonthlyUsage = pgTable(
  "dpo_monthly_usage",
  {
    tenantSlug,
    /** "2026-11". */
    month: text("month").notNull(),
    answered: integer("answered").notNull().default(0),
    refused: integer("refused").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.tenantSlug, t.month] })],
);

/** The office's own monthly ceiling; absent or null means the default. */
export const dpoTenantSettings = pgTable("dpo_tenant_settings", {
  tenantSlug: text("tenant_slug").primaryKey(),
  monthlyLimit: integer("monthly_limit"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedBy: text("updated_by"),
});

/**
 * What the demonstration office would have sent and did not (change
 * painel-livre-para-alunos). In an office with `demo` on, a message of the
 * office (to the citizen, to the applicant, to the team) lands here instead
 * of at the provider: the address on it was typed by a course participant
 * and may belong to someone who never asked for it. The participant reads
 * the text from the history of the record it is about.
 *
 * The text only, not the HTML: it is all the screen shows, and the HTML
 * would keep the whole layout of the e-mail once per message.
 */
export const demoOutbox = pgTable(
  "demo_outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    text: text("text").notNull(),
    /** The record the message is about, when there is one: "request" (a
     * service request of any kind: pedido, LGPD, ouvidoria) or
     * "appointment", and its protocol, unique within the office in each of
     * the two tables. The protocol, not a foreign key: it is what every
     * sending path already holds, and what the screens link by. */
    relatedKind: text("related_kind"),
    relatedProtocol: text("related_protocol"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("demo_outbox_tenant_created_at").on(t.tenantSlug, t.createdAt),
    index("demo_outbox_related").on(
      t.tenantSlug,
      t.relatedKind,
      t.relatedProtocol,
    ),
  ],
);

/**
 * The office's team (decision of 18/11/2026): the people of the serventia, by
 * level, shown on the site and kept in the panel by the Tabelião/Registrador.
 * Apart from the panel accounts (a person of serviços gerais may never log
 * in). Nothing here is deleted: a person leaves the lists by being archived,
 * and the stored files are named by their own columns.
 *
 * The levels (their names and order) are the office's own, kept in
 * `tenant_content`; `level_id` points at one of them by its id, not by a
 * foreign key.
 */
export const officeStaff = pgTable(
  "office_staff",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    name: text("name").notNull(),
    levelId: text("level_id").notNull(),
    profession: text("profession").notNull().default(""),
    /** "Portaria/Matrícula", free text: it also reads on the signed documents. */
    registration: text("registration").notNull().default(""),
    portariaDate: date("portaria_date"),
    /** Place inside the level, set by the Tabelião. */
    position: integer("position").notNull().default(0),
    /** On the site only when marked. */
    showOnSite: boolean("show_on_site").notNull().default(false),
    /** The photo is public only with the image authorization recorded. */
    imageConsent: boolean("image_consent").notNull().default(false),
    imageConsentAt: timestamp("image_consent_at", { withTimezone: true }),
    /** Listed in "Quem assina" (guias, ISS, declarações). */
    canSign: boolean("can_sign").notNull().default(false),
    /**
     * The place in "Quem assina": the documents keep who signs by its place
     * in that list, so it is given once and kept, never the hierarchy's order.
     */
    signerOrder: integer("signer_order"),
    photoPath: text("photo_path"),
    photoMime: text("photo_mime"),
    photoUpdatedAt: timestamp("photo_updated_at", { withTimezone: true }),
    /** How the photo sits in its frame (shape, fit, centre, zoom); null = centred circle. */
    photoFrame: jsonb("photo_frame"),
    /** The portaria's PDF: attaching it is what publishes it. */
    portariaPath: text("portaria_path"),
    portariaName: text("portaria_name"),
    portariaUpdatedAt: timestamp("portaria_updated_at", { withTimezone: true }),
    /** The Word of the portaria: the panel only, never the site. */
    wordPath: text("word_path"),
    wordName: text("word_name"),
    wordMime: text("word_mime"),
    wordUpdatedAt: timestamp("word_updated_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedBy: text("archived_by"),
    /**
     * Excluded (decision of 24/11/2026): out of the team, the archive, the
     * site and "Quem assina". The row stays, with the audit; it can be undone.
     */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("office_staff_tenant_level").on(t.tenantSlug, t.levelId)],
);

/**
 * The office's notice board (decision of 19/11/2026): community weddings,
 * social events, correição visits and other news the serventia posts on its
 * site, kept in the panel by whoever the Tabelião lets. Apart from the formal
 * publications (proclamas, avisos e editais). Nothing is deleted: a post
 * leaves the lists by being archived, and a file taken off only gets
 * `removed_at`.
 */
export const officeNews = pgTable(
  "office_news",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    title: text("title").notNull(),
    /** One of the categories of `core/news/news.ts`, by its id. */
    category: text("category").notNull().default("outros"),
    eventDate: date("event_date"),
    summary: text("summary").notNull().default(""),
    body: text("body").notNull().default(""),
    /** On the site only when marked. */
    published: boolean("published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    /** The photos are public only with the image authorisation recorded. */
    imageConsent: boolean("image_consent").notNull().default(false),
    imageConsentAt: timestamp("image_consent_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    archivedBy: text("archived_by"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("office_news_tenant_date").on(t.tenantSlug, t.eventDate)],
);

/** The photos and the PDF of a post. A file taken off keeps its row. */
export const officeNewsFiles = pgTable(
  "office_news_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    newsId: uuid("news_id").notNull(),
    /** "photo" or "pdf". */
    kind: text("kind").notNull(),
    position: integer("position").notNull().default(0),
    path: text("path").notNull(),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
  },
  (t) => [index("office_news_files_news").on(t.newsId)],
);

/**
 * Who came to pick up the document at the counter (decision of 19/11/2026):
 * written when the pickup is registered and the request is closed. Kept as
 * proof of the delivery; nothing here is deleted or edited, a correction is
 * a new row and the latest one is read. The citizen's screens never read it.
 */
export const serviceRequestPickups = pgTable(
  "service_request_pickups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    requestId: uuid("request_id").notNull(),
    personName: text("person_name").notNull(),
    /** "applicant", "attorney", "authorized", "relative" or "other". */
    relation: text("relation").notNull(),
    /** "cpf", "rg", "cnh" or "other". */
    documentType: text("document_type").notNull(),
    /** A CPF as digits; the other documents as typed. */
    documentNumber: text("document_number").notNull(),
    note: text("note").notNull().default(""),
    pickedUpAt: timestamp("picked_up_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    registeredBy: text("registered_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("service_request_pickups_request").on(t.requestId)],
);

/**
 * The internal routing of a pedido (change direcionamento-interno-de-pedidos):
 * each time it is sent to someone or to a sector's queue, taken ("Pegar para
 * mim") or sent back. With whom it is now is the latest row not undone.
 * Changing a row keeps the old values in `history`; undoing it marks
 * `withdrawn_at`: nothing here is ever deleted. No foreign key to the pedido,
 * like the pickups: the cleaning of the demonstration office keeps it.
 */
export const serviceRequestRoutings = pgTable(
  "service_request_routings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    requestId: uuid("request_id").notNull(),
    /** "route", "take" or "return". */
    kind: text("kind").notNull(),
    fromUserId: text("from_user_id"),
    /** Null: the sector's queue, the first who receives keeps it. */
    toUserId: text("to_user_id"),
    sectorId: text("sector_id"),
    /** The sector's name when it was sent, kept as the history reads it. */
    sectorLabel: text("sector_label"),
    /** "execute", "review" or "sign". */
    purpose: text("purpose").notNull(),
    /** The service, from the acts of the office's attributions. */
    actId: text("act_id"),
    /** "normal", "attention" or "urgent". */
    priority: text("priority").notNull().default("normal"),
    dueAt: timestamp("due_at", { withTimezone: true }),
    note: text("note").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    receivedBy: text("received_by"),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    withdrawnBy: text("withdrawn_by"),
    /** Each change: when, who, and the values it had before. */
    history: jsonb("history").notNull().default(sql`'[]'::jsonb`),
  },
  (t) => [
    index("service_request_routings_request").on(t.requestId),
    index("service_request_routings_to").on(t.tenantSlug, t.toUserId),
  ],
);

// ------------------------------------------------- Registro de Imóveis

/**
 * The Registro de Imóveis of the office (change registro-de-imoveis-acervo):
 * what the module needs beyond the tenant config, one row per office. The
 * IBGE code of the município goes in the Indicador Real of the ONR.
 */
export const riSettings = pgTable("ri_settings", {
  tenantSlug: text("tenant_slug").primaryKey(),
  ibgeCity: text("ibge_city").notNull().default(""),
  /** Who signs the RI's documents: the place in "Quem assina" (0 = first). */
  signerIndex: integer("signer_index").notNull().default(0),
  /**
   * The signer's handwritten signature as a black-on-transparent PNG,
   * base64, drawn over the name when the document goes out "com a minha
   * assinatura" (decision of 25/11/2026). Empty: none.
   */
  signatureImage: text("signature_image").notNull().default(""),
  signatureUpdatedBy: text("signature_updated_by"),
  signatureUpdatedAt: timestamp("signature_updated_at", { withTimezone: true }),
  updatedBy: text("updated_by"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * A matrícula (Livro 2), registro auxiliar (Livro 3) or transcrição of the
 * acervo (core/ri/property). Not unique by number on purpose: while the
 * acervo migrates to fichas the same number can show up twice, and that is
 * a pendência to resolve (CNN art. 338), not a row to refuse. "Apagar"
 * marks `deleted_at`; every change keeps the values it had in `history`.
 */
export const riProperties = pgTable(
  "ri_properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** 2 Registro Geral, 3 Registro Auxiliar. */
    book: integer("book").notNull().default(2),
    number: integer("number").notNull(),
    /** ONR "registro tipo": 1 matrícula, 2 matrícula-mãe, 4 transcrição. */
    recordKind: integer("record_kind").notNull().default(1),
    /** PGV-CNM situação: 0 ativa … 4 inexistente (core/ri/codes). */
    status: integer("status").notNull().default(0),
    cnm: text("cnm").notNull().default(""),
    /** The CNM is already in the PGV-CNM: out of the next lote. */
    cnmInPgv: boolean("cnm_in_pgv").notNull().default(false),
    openedOn: date("opened_on"),
    origin: text("origin").notNull().default(""),
    ficha: text("ficha").notNull().default(""),
    /** 0 urbano, 1 rural. */
    location: integer("location").notNull().default(0),
    propertyKind: integer("property_kind"),
    streetKind: integer("street_kind"),
    street: text("street").notNull().default(""),
    streetNumber: text("street_number").notNull().default(""),
    district: text("district").notNull().default(""),
    cep: text("cep").notNull().default(""),
    complement: text("complement").notNull().default(""),
    quadra: text("quadra").notNull().default(""),
    setor: text("setor").notNull().default(""),
    conjunto: text("conjunto").notNull().default(""),
    lote: text("lote").notNull().default(""),
    loteamento: text("loteamento").notNull().default(""),
    contributors: jsonb("contributors").notNull().default(sql`'[]'::jsonb`),
    /** { car, nirf, ccir, incra, sigef, denominacao, acidente }. */
    rural: jsonb("rural").notNull().default(sql`'{}'::jsonb`),
    /** { nome, bloco, conjunto, torre, apto, vaga }. */
    condo: jsonb("condo").notNull().default(sql`'{}'::jsonb`),
    area: text("area").notNull().default(""),
    /** Livro 3: what is registered (Lei nº 6.015/1973, art. 178). */
    auxKind: text("aux_kind").notNull().default(""),
    /** Livro 3: the matrículas the registro refers to, as written. */
    linkedNumbers: text("linked_numbers").notNull().default(""),
    /** Lançamentos the ficha had before the system: R/AV go on from here. */
    priorActs: integer("prior_acts").notNull().default(0),
    /**
     * Livro 3 (Registro Auxiliar): what a registro there has instead of an
     * imóvel: título, partes, valor, vencimento, garantias and where the
     * goods are, the pacto (core/ri/auxiliary AuxData).
     */
    aux: jsonb("aux").notNull().default(sql`'{}'::jsonb`),
    description: text("description").notNull().default(""),
    notes: text("notes").notNull().default(""),
    /** Where it came from: "manual" or "planilha". */
    source: text("source").notNull().default("manual"),
    history: jsonb("history").notNull().default(sql`'[]'::jsonb`),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by"),
  },
  (t) => [index("ri_properties_number").on(t.tenantSlug, t.book, t.number)],
);

/**
 * The people of the Registro de Imóveis (the Indicador Pessoal, Livro 5):
 * one row per person, linked to the atos where they appear.
 */
export const riPeople = pgTable(
  "ri_people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    name: text("name").notNull(),
    /** CPF or CNPJ, digits only; empty when unknown. */
    document: text("document").notNull().default(""),
    notes: text("notes").notNull().default(""),
    history: jsonb("history").notNull().default(sql`'[]'::jsonb`),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by"),
  },
  (t) => [index("ri_people_document").on(t.tenantSlug, t.document)],
);

/**
 * A lançamento of a matrícula (core/ri/acts): R or AV with its order
 * number (Lei nº 6.015/1973, art. 232), or "M", the situação the
 * matrícula had when it came into the system.
 */
export const riActs = pgTable(
  "ri_acts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    propertyId: uuid("property_id")
      .notNull()
      .references(() => riProperties.id),
    kind: text("kind").notNull(),
    seq: integer("seq").notNull(),
    effect: text("effect").notNull(),
    nature: text("nature").notNull().default(""),
    registeredOn: date("registered_on"),
    summary: text("summary").notNull().default(""),
    cancelsActId: uuid("cancels_act_id"),
    protocol: text("protocol").notNull().default(""),
    /** The selo, typed by hand (decision of 25/11/2026). */
    seal: text("seal").notNull().default(""),
    valueCents: bigint("value_cents", { mode: "number" }),
    history: jsonb("history").notNull().default(sql`'[]'::jsonb`),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by"),
  },
  (t) => [index("ri_acts_property").on(t.propertyId)],
);

/**
 * Who is in a lançamento and how (adquirente, transmitente, credor…). A
 * party taken off an ato is marked `removed_at`, never deleted.
 */
export const riActParties = pgTable(
  "ri_act_parties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    actId: uuid("act_id")
      .notNull()
      .references(() => riActs.id),
    personId: uuid("person_id")
      .notNull()
      .references(() => riPeople.id),
    role: text("role").notNull(),
    share: text("share").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    removedBy: text("removed_by"),
  },
  (t) => [
    index("ri_act_parties_act").on(t.actId),
    index("ri_act_parties_person").on(t.personId),
  ],
);

/**
 * Every file generated for the ONR (lote CNM, Indicador Real, Indicador
 * Pessoal): the content as it was, who generated it and when. "Apagar"
 * withdraws it from the list; the row stays for the audit.
 */
export const riExports = pgTable(
  "ri_exports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** "cnm", "indicador-real" or "indicador-pessoal". */
    kind: text("kind").notNull(),
    mode: text("mode").notNull().default(""),
    fileName: text("file_name").notNull(),
    content: text("content").notNull(),
    recordCount: integer("record_count").notNull().default(0),
    skipped: jsonb("skipped").notNull().default(sql`'[]'::jsonb`),
    sha256: text("sha256").notNull(),
    note: text("note").notNull().default(""),
    importedAt: timestamp("imported_at", { withTimezone: true }),
    importedBy: text("imported_by"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    withdrawnBy: text("withdrawn_by"),
  },
  (t) => [index("ri_exports_kind").on(t.tenantSlug, t.kind)],
);

/**
 * The files of the Registro de Imóveis (change registro-de-imoveis-acervo):
 * the ficha's images, the títulos and any document attached to a matrícula
 * or to one of its atos. "Apagar" marks `deleted_at`; the file stays.
 */
export const riFiles = pgTable(
  "ri_files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    propertyId: uuid("property_id").references(() => riProperties.id),
    actId: uuid("act_id").references(() => riActs.id),
    /** The protocolo whose título this is (Livro 1). */
    protocolId: uuid("protocol_id"),
    /** "ficha", "titulo" or "documento". */
    kind: text("kind").notNull().default("documento"),
    name: text("name").notNull(),
    mime: text("mime").notNull().default("application/octet-stream"),
    size: integer("size").notNull().default(0),
    path: text("path").notNull(),
    /** What the assistente virtual read from it, when it read. */
    reading: jsonb("reading"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by"),
  },
  (t) => [
    index("ri_files_property").on(t.propertyId),
    index("ri_files_tenant").on(t.tenantSlug),
  ],
);

/**
 * The geometry of an imóvel (change registro-de-imoveis-mapa): the
 * vértices of its perímetro from the memorial descritivo or the Sigef
 * (Lei nº 6.015/1973, art. 176, §§ 3º a 5º), with área, perímetro and
 * fuso. One matrícula may have several over time (each averbação of
 * georreferenciamento or retificação); the newest in force is the one on
 * the map. "Apagar" only marks it.
 */
export const riGeometries = pgTable(
  "ri_geometries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    propertyId: uuid("property_id")
      .notNull()
      .references(() => riProperties.id),
    actId: uuid("act_id").references(() => riActs.id),
    /** "memorial", "sigef" or "manual". */
    source: text("source").notNull().default("memorial"),
    /** The text it was read from (memorial or table), for conferência. */
    sourceText: text("source_text").notNull().default(""),
    /** [{ code, lat, lon }] in SIRGAS 2000, decimal degrees. */
    vertices: jsonb("vertices").notNull().default(sql`'[]'::jsonb`),
    zone: integer("zone").notNull(),
    areaM2: doublePrecision("area_m2").notNull(),
    perimeterM: doublePrecision("perimeter_m").notNull(),
    /** The Sigef certification (code of the parcela), when there is one. */
    sigefCode: text("sigef_code").notNull().default(""),
    notes: text("notes").notNull().default(""),
    history: jsonb("history").notNull().default(sql`'[]'::jsonb`),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by"),
  },
  (t) => [
    index("ri_geometries_property").on(t.propertyId),
    index("ri_geometries_tenant").on(t.tenantSlug),
  ],
);

/**
 * The Protocolo of the Registro de Imóveis (Livro 1, Lei nº 6.015/1973,
 * arts. 174 and 175): every título presented, with its order number (one
 * series for the prenotações, another for exame e cálculo, art. 12,
 * parágrafo único), the prazos in dias úteis (arts. 9º, 188 and 205), the
 * nota devolutiva and what became of it. An entry of the Livro 1 is never
 * deleted: "apagar" marks it as lançado por engano, with the reason.
 */
export const riProtocols = pgTable(
  "ri_protocols",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** "prenotacao" or "exame". */
    kind: text("kind").notNull().default("prenotacao"),
    number: integer("number").notNull(),
    presentedAt: timestamp("presented_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    presentedOn: date("presented_on").notNull(),
    presenterName: text("presenter_name").notNull(),
    presenterDocument: text("presenter_document").notNull().default(""),
    presenterContact: text("presenter_contact").notNull().default(""),
    titleKind: text("title_kind").notNull(),
    /** The atos it asks for, resumidamente (art. 175, V). */
    actsSummary: text("acts_summary").notNull().default(""),
    /** The matrículas involved (ri_properties ids). */
    propertyIds: jsonb("property_ids").notNull().default(sql`'[]'::jsonb`),
    /** One of the cases of art. 188, § 1º (5 dias úteis). */
    fast: boolean("fast").notNull().default(false),
    /** Reurb of interesse social (art. 205, parágrafo único: 40 dias). */
    reurb: boolean("reurb").notNull().default(false),
    qualifyBy: date("qualify_by"),
    prenotationEnds: date("prenotation_ends"),
    /** core/ri/protocol ProtocolStatus. */
    status: text("status").notNull().default("prenotado"),
    /** The exigências of the nota devolutiva: [{ text, source }]. */
    requirements: jsonb("requirements").notNull().default(sql`'[]'::jsonb`),
    requirementIssuedAt: timestamp("requirement_issued_at", {
      withTimezone: true,
    }),
    requirementIssuedBy: text("requirement_issued_by"),
    reentryOn: date("reentry_on"),
    /** Emolumentos as the office charged them: códigos and values. */
    fees: text("fees").notNull().default(""),
    feeCents: bigint("fee_cents", { mode: "number" }),
    notes: text("notes").notNull().default(""),
    /** What the assistente virtual proposed from the título. */
    reading: jsonb("reading"),
    history: jsonb("history").notNull().default(sql`'[]'::jsonb`),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: text("voided_by"),
  },
  (t) => [
    uniqueIndex("ri_protocols_number").on(t.tenantSlug, t.kind, t.number),
    index("ri_protocols_status").on(t.tenantSlug, t.status),
  ],
);

/**
 * The books of the Registro de Imóveis as volumes (change
 * registro-de-imoveis-livros): each opened, numbered and closed by the
 * oficial (Lei nº 6.015/1973, art. 4º), the number kept with letters (art.
 * 6º), in fichas (art. 173, parágrafo único), folhas or meio eletrônico
 * (arts. 1º, § 3º, and 7º-A). "Apagar" hides the volume; its history stays.
 */
export const riBooks = pgTable(
  "ri_books",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantSlug,
    /** 1 to 5 (art. 173). */
    book: integer("book").notNull(),
    /** "2", "2-A", "1-B"… */
    volume: text("volume").notNull(),
    /** "fichas", "folhas" or "eletronico". */
    form: text("form").notNull().default("fichas"),
    sheetCount: integer("sheet_count").notNull().default(0),
    /** The first and last matrícula, registro or número de ordem. */
    firstItem: integer("first_item"),
    lastItem: integer("last_item"),
    openedOn: date("opened_on").notNull(),
    closedOn: date("closed_on"),
    lastSheet: integer("last_sheet"),
    openingNotes: text("opening_notes").notNull().default(""),
    closingNotes: text("closing_notes").notNull().default(""),
    history: jsonb("history").notNull().default(sql`'[]'::jsonb`),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    deletedBy: text("deleted_by"),
  },
  (t) => [index("ri_books_tenant").on(t.tenantSlug, t.book)],
);
