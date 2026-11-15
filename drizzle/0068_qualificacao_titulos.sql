CREATE TABLE "qualification_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"attribution" text NOT NULL,
	"acts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"how_to_comply" text NOT NULL,
	"basis" text NOT NULL,
	"seed_key" text,
	"uses" integer DEFAULT 0 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	"removed_reason" text
);
--> statement-breakpoint
CREATE TABLE "qualification_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"qualification_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"year" integer NOT NULL,
	"sequence" integer NOT NULL,
	"round_index" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"issued_on" text NOT NULL,
	"signer_name" text DEFAULT '' NOT NULL,
	"signer_role" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	"removed_reason" text
);
--> statement-breakpoint
CREATE TABLE "qualifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"attribution" text NOT NULL,
	"status" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	"updated_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	"removed_reason" text
);
--> statement-breakpoint
CREATE INDEX "qualification_library_tenant" ON "qualification_library" USING btree ("tenant_slug","attribution");--> statement-breakpoint
CREATE UNIQUE INDEX "qualification_library_seed" ON "qualification_library" USING btree ("tenant_slug","seed_key");--> statement-breakpoint
CREATE UNIQUE INDEX "qualification_notes_number" ON "qualification_notes" USING btree ("tenant_slug","kind","year","sequence");--> statement-breakpoint
CREATE INDEX "qualification_notes_qualification" ON "qualification_notes" USING btree ("qualification_id");--> statement-breakpoint
CREATE INDEX "qualifications_tenant" ON "qualifications" USING btree ("tenant_slug","status");