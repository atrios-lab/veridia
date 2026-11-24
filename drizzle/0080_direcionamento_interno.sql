CREATE TABLE "service_request_routings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"request_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"from_user_id" text,
	"to_user_id" text,
	"sector_id" text,
	"sector_label" text,
	"purpose" text NOT NULL,
	"act_id" text,
	"priority" text DEFAULT 'normal' NOT NULL,
	"due_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone,
	"received_by" text,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_by" text,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "service_request_routings_request" ON "service_request_routings" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "service_request_routings_to" ON "service_request_routings" USING btree ("tenant_slug","to_user_id");