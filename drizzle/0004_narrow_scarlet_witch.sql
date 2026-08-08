CREATE TABLE "service_request_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"request_id" uuid NOT NULL,
	"text" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolution_attachment_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fulfilled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "amount_cents" integer;--> statement-breakpoint
ALTER TABLE "service_request_requirements" ADD CONSTRAINT "service_request_requirements_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_requirements" ADD CONSTRAINT "service_request_requirements_resolution_attachment_id_service_request_attachments_id_fk" FOREIGN KEY ("resolution_attachment_id") REFERENCES "public"."service_request_attachments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_request_requirements_request" ON "service_request_requirements" USING btree ("request_id");