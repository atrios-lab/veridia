CREATE TABLE "daily_book_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"kind" text NOT NULL,
	"occurred_on" text NOT NULL,
	"specialty" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"act_code" text DEFAULT '' NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"amount_cents" bigint NOT NULL,
	"funds_cents" bigint DEFAULT 0 NOT NULL,
	"iss_cents" bigint DEFAULT 0 NOT NULL,
	"supplier" text DEFAULT '' NOT NULL,
	"document_ref" text DEFAULT '' NOT NULL,
	"fiscal_distinct" boolean DEFAULT false NOT NULL,
	"fiscal_note" text DEFAULT '' NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"attachment_path" text,
	"attachment_name" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"import_id" uuid,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	"remove_reason" text DEFAULT '' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_book_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"file_path" text,
	"file_name" text,
	"reading" jsonb,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	"remove_reason" text DEFAULT '' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_book_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"kind" text NOT NULL,
	"period_start" text NOT NULL,
	"period_end" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"signer" integer DEFAULT 0 NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	"remove_reason" text DEFAULT '' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "daily_book_entries_tenant_day" ON "daily_book_entries" USING btree ("tenant_slug","occurred_on");--> statement-breakpoint
CREATE INDEX "daily_book_entries_import" ON "daily_book_entries" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "daily_book_imports_tenant" ON "daily_book_imports" USING btree ("tenant_slug","period_start");--> statement-breakpoint
CREATE INDEX "daily_book_reports_tenant" ON "daily_book_reports" USING btree ("tenant_slug","period_end");