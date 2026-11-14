CREATE TABLE "attribution_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"attribution" text NOT NULL,
	"file_name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"stored_path" text NOT NULL,
	"format" text NOT NULL,
	"uploaded_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	"removed_reason" text
);
--> statement-breakpoint
CREATE INDEX "attribution_files_list" ON "attribution_files" USING btree ("tenant_slug","attribution","created_at");