CREATE TABLE "office_news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT 'outros' NOT NULL,
	"event_date" date,
	"summary" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"image_consent" boolean DEFAULT false NOT NULL,
	"image_consent_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"archived_by" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "office_news_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"news_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"path" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" text
);
--> statement-breakpoint
CREATE INDEX "office_news_tenant_date" ON "office_news" USING btree ("tenant_slug","event_date");--> statement-breakpoint
CREATE INDEX "office_news_files_news" ON "office_news_files" USING btree ("news_id");