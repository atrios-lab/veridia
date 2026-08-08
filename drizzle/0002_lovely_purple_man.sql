CREATE TABLE "service_request_attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"request_id" uuid NOT NULL,
	"kind" text DEFAULT 'citizen' NOT NULL,
	"stored_name" text NOT NULL,
	"display_name" text NOT NULL,
	"path" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"protocol_year" integer NOT NULL,
	"protocol_sequence" integer NOT NULL,
	"protocol_number" text NOT NULL,
	"act_id" text NOT NULL,
	"attribution" text NOT NULL,
	"applicant_name" text NOT NULL,
	"contact" text NOT NULL,
	"cpf" text,
	"description" text,
	"purpose" text,
	"parameter_value" text,
	"access_key_hash" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "service_request_attachments_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_request_attachments_request" ON "service_request_attachments" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "service_requests_tenant_year_sequence" ON "service_requests" USING btree ("tenant_slug","protocol_year","protocol_sequence");--> statement-breakpoint
CREATE UNIQUE INDEX "service_requests_tenant_protocol" ON "service_requests" USING btree ("tenant_slug","protocol_number");--> statement-breakpoint
CREATE INDEX "service_requests_tenant_created_at" ON "service_requests" USING btree ("tenant_slug","created_at");