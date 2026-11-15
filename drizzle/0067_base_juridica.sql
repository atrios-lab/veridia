CREATE TABLE "knowledge_passages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"source_id" uuid NOT NULL,
	"ordinal" integer NOT NULL,
	"heading" text NOT NULL,
	"text" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"topic" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"official_url" text DEFAULT '' NOT NULL,
	"source_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"resolved_note" text
);
--> statement-breakpoint
CREATE TABLE "knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"meta" jsonb NOT NULL,
	"origin" text DEFAULT '' NOT NULL,
	"characters" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	"removed_reason" text
);
--> statement-breakpoint
CREATE INDEX "knowledge_passages_source" ON "knowledge_passages" USING btree ("source_id","ordinal");--> statement-breakpoint
CREATE INDEX "knowledge_passages_tenant" ON "knowledge_passages" USING btree ("tenant_slug");--> statement-breakpoint
CREATE INDEX "knowledge_requests_tenant" ON "knowledge_requests" USING btree ("tenant_slug","status");--> statement-breakpoint
CREATE INDEX "knowledge_sources_tenant" ON "knowledge_sources" USING btree ("tenant_slug");