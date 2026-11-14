CREATE TABLE "title_transfer_filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"competence" text NOT NULL,
	"year" integer NOT NULL,
	"sequence" integer NOT NULL,
	"transfers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"issued_on" text NOT NULL,
	"sent_on" text DEFAULT '' NOT NULL,
	"channel" text DEFAULT '' NOT NULL,
	"receipt" text DEFAULT '' NOT NULL,
	"receipt_path" text,
	"receipt_name" text,
	"semut_on" text DEFAULT '' NOT NULL,
	"semut_receipt" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	"removed_reason" text
);
--> statement-breakpoint
CREATE TABLE "title_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"competence" text NOT NULL,
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
CREATE UNIQUE INDEX "title_transfer_filings_tenant_year_sequence" ON "title_transfer_filings" USING btree ("tenant_slug","year","sequence");--> statement-breakpoint
CREATE INDEX "title_transfers_competence" ON "title_transfers" USING btree ("tenant_slug","competence");