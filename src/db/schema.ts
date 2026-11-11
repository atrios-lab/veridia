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
    // Null once the file is deleted by the 30-day rule; the row stays as
    // the record (name, kind, size, when it came, `purgedAt`).
    path: text("path"),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    // When the platform deleted the file, 30 days after the protocol closed
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
    // which is how the 30-day purge (`purgeExpiredRequestFiles`) finds the
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
    // When the current file was sent: it is kept 30 days from then (see
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
    score: integer("score").notNull(),
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
  },
  (t) => [
    index("messenger_messages_conversation").on(t.conversationId, t.createdAt),
  ],
);
