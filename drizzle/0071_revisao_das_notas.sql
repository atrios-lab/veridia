CREATE TABLE "qualification_document_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"file_hash" text NOT NULL,
	"file_name" text NOT NULL,
	"request_id" uuid,
	"attachment_id" uuid,
	"attribution" text,
	"result" jsonb NOT NULL,
	"ai_error" text,
	"reviewed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decision" text,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"learned_at" timestamp with time zone,
	"learned_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "qualification_library" ADD COLUMN "origin" text DEFAULT 'serventia' NOT NULL;--> statement-breakpoint
ALTER TABLE "qualification_document_reviews" ADD CONSTRAINT "qualification_document_reviews_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qualification_document_reviews" ADD CONSTRAINT "qualification_document_reviews_attachment_id_service_request_attachments_id_fk" FOREIGN KEY ("attachment_id") REFERENCES "public"."service_request_attachments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "qualification_document_reviews_file" ON "qualification_document_reviews" USING btree ("tenant_slug","file_hash");--> statement-breakpoint
CREATE INDEX "qualification_document_reviews_attachment" ON "qualification_document_reviews" USING btree ("attachment_id");