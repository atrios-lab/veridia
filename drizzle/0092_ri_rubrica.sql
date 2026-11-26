ALTER TABLE "ri_settings" ADD COLUMN "rubric_image" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ri_settings" ADD COLUMN "rubric_updated_by" text;--> statement-breakpoint
ALTER TABLE "ri_settings" ADD COLUMN "rubric_updated_at" timestamp with time zone;