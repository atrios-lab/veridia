ALTER TABLE "ri_settings" ADD COLUMN "pgv_client_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ri_settings" ADD COLUMN "pgv_hash_sealed" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "ri_settings" ADD COLUMN "pgv_updated_by" text;--> statement-breakpoint
ALTER TABLE "ri_settings" ADD COLUMN "pgv_updated_at" timestamp with time zone;