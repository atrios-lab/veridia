CREATE TABLE "attribution_book_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"attribution" text NOT NULL,
	"book" text NOT NULL,
	"number" integer NOT NULL,
	"entry_date" date,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"origin" text DEFAULT 'manual' NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE INDEX "attribution_book_entries_book" ON "attribution_book_entries" USING btree ("tenant_slug","attribution","book","number");