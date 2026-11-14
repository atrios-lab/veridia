CREATE TABLE "censec_acts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"quinzena" text NOT NULL,
	"central" text NOT NULL,
	"data" jsonb NOT NULL,
	"source_name" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	"removed_reason" text
);
--> statement-breakpoint
CREATE TABLE "censec_closings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"quinzena" text NOT NULL,
	"central" text NOT NULL,
	"acts" integer DEFAULT 0 NOT NULL,
	"sent_on" text NOT NULL,
	"protocol" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	"removed_reason" text
);
--> statement-breakpoint
CREATE INDEX "censec_acts_quinzena" ON "censec_acts" USING btree ("tenant_slug","quinzena");--> statement-breakpoint
CREATE INDEX "censec_closings_quinzena" ON "censec_closings" USING btree ("tenant_slug","quinzena");