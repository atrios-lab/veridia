CREATE TABLE "ri_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"book" integer NOT NULL,
	"volume" text NOT NULL,
	"form" text DEFAULT 'fichas' NOT NULL,
	"sheet_count" integer DEFAULT 0 NOT NULL,
	"first_item" integer,
	"last_item" integer,
	"opened_on" date NOT NULL,
	"closed_on" date,
	"last_sheet" integer,
	"opening_notes" text DEFAULT '' NOT NULL,
	"closing_notes" text DEFAULT '' NOT NULL,
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" text
);
--> statement-breakpoint
CREATE INDEX "ri_books_tenant" ON "ri_books" USING btree ("tenant_slug","book");