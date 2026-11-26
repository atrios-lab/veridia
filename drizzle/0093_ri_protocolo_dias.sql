CREATE TABLE "ri_protocol_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"day" date NOT NULL,
	"kind" text NOT NULL,
	"why" text DEFAULT '' NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"first_number" integer,
	"last_number" integer,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_by" text,
	"reopened_at" timestamp with time zone,
	"reopened_by" text,
	"reopen_reason" text
);
--> statement-breakpoint
CREATE INDEX "ri_protocol_days_tenant" ON "ri_protocol_days" USING btree ("tenant_slug","day");