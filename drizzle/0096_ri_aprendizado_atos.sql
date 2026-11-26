CREATE TABLE "ri_learned_acts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"cue" text NOT NULL,
	"kind" text NOT NULL,
	"effect" text NOT NULL,
	"uses" integer DEFAULT 1 NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"removed_at" timestamp with time zone,
	"removed_by" text
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ri_learned_acts_cue" ON "ri_learned_acts" USING btree ("tenant_slug","cue");