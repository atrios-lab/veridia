ALTER TABLE "ri_settings" ADD COLUMN "signer_images" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ri_settings" ADD COLUMN "legacy_owner" text DEFAULT '' NOT NULL;