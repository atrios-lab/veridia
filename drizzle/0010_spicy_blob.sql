CREATE TABLE "transparency_bulletins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"reference_month" date NOT NULL,
	"acts_count" integer NOT NULL,
	"gross_revenue_cents" bigint NOT NULL,
	"taxes_paid_cents" bigint NOT NULL,
	"expenses_cents" bigint NOT NULL,
	"status" text DEFAULT 'preliminary' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transparency_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"year_label" text NOT NULL,
	"file_stored_name" text NOT NULL,
	"file_display_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_mime_type" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"position" integer NOT NULL,
	"unpublished_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "transparency_bulletins_tenant_month" ON "transparency_bulletins" USING btree ("tenant_slug","reference_month");--> statement-breakpoint
CREATE INDEX "transparency_documents_tenant_position" ON "transparency_documents" USING btree ("tenant_slug","position");