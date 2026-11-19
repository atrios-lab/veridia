CREATE TABLE "service_request_pickups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"request_id" uuid NOT NULL,
	"person_name" text NOT NULL,
	"relation" text NOT NULL,
	"document_type" text NOT NULL,
	"document_number" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"picked_up_at" timestamp with time zone DEFAULT now() NOT NULL,
	"registered_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "service_request_pickups_request" ON "service_request_pickups" USING btree ("request_id");