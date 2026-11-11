CREATE TABLE "audit_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"audit_id" uuid NOT NULL,
	"author_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_notification_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"tenant_slug" text NOT NULL,
	"side" text NOT NULL,
	"display_name" text NOT NULL,
	"stored_name" text NOT NULL,
	"path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"year" integer NOT NULL,
	"sequence" integer NOT NULL,
	"target_user_id" text NOT NULL,
	"created_by" text,
	"subject" text NOT NULL,
	"facts" text NOT NULL,
	"legal_basis" text NOT NULL,
	"audit_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'aberta' NOT NULL,
	"response" text,
	"responded_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"closing_note" text,
	"signed_document_id" uuid,
	"emailed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_notes" ADD CONSTRAINT "audit_notes_audit_id_audit_log_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."audit_log"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_notification_files" ADD CONSTRAINT "audit_notification_files_notification_id_audit_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "public"."audit_notifications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_notifications" ADD CONSTRAINT "audit_notifications_signed_document_id_signed_documents_id_fk" FOREIGN KEY ("signed_document_id") REFERENCES "public"."signed_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_notes_audit" ON "audit_notes" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "audit_notification_files_notification" ON "audit_notification_files" USING btree ("notification_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_notifications_tenant_year_sequence" ON "audit_notifications" USING btree ("tenant_slug","year","sequence");--> statement-breakpoint
CREATE INDEX "audit_notifications_target" ON "audit_notifications" USING btree ("tenant_slug","target_user_id");