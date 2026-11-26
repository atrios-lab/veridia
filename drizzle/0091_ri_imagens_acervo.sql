ALTER TABLE "ri_onr_images" ADD COLUMN "reading" jsonb;--> statement-breakpoint
ALTER TABLE "ri_onr_images" ADD COLUMN "changes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ri_onr_images" ADD COLUMN "applied_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ri_onr_images" ADD COLUMN "applied_by" text;