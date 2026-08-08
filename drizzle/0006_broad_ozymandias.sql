CREATE TABLE "chat_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"citizen_name" text NOT NULL,
	"citizen_contact" text NOT NULL,
	"subject" text NOT NULL,
	"citizen_token_hash" text NOT NULL,
	"informed_protocol_number" text,
	"matched_request_id" uuid,
	"source_path" text,
	"assigned_user_id" text,
	"assigned_sector" text,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"waiting_since" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_reason" text,
	"linked_request_id" uuid,
	"rating" integer,
	"rating_comment" text,
	"wants_transcript_email" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"tenant_slug" text NOT NULL,
	"author_type" text NOT NULL,
	"author_user_id" text,
	"body" text DEFAULT '' NOT NULL,
	"attachment_stored_name" text,
	"attachment_display_name" text,
	"attachment_path" text,
	"attachment_mime_type" text,
	"attachment_size_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "chat_status" text DEFAULT 'available' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "chat_sector" text;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_matched_request_id_service_requests_id_fk" FOREIGN KEY ("matched_request_id") REFERENCES "public"."service_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_conversations" ADD CONSTRAINT "chat_conversations_linked_request_id_service_requests_id_fk" FOREIGN KEY ("linked_request_id") REFERENCES "public"."service_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_id_chat_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chat_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_conversations_tenant_status" ON "chat_conversations" USING btree ("tenant_slug","status");--> statement-breakpoint
CREATE INDEX "chat_conversations_tenant_waiting_since" ON "chat_conversations" USING btree ("tenant_slug","waiting_since");--> statement-breakpoint
CREATE INDEX "chat_messages_conversation_created_at" ON "chat_messages" USING btree ("conversation_id","created_at");