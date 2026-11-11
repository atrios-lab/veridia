ALTER TABLE "audit_notes" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_notes" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_notes" ADD COLUMN "removed_by" text;--> statement-breakpoint
ALTER TABLE "audit_reviews" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_reviews" ADD COLUMN "archived_by" text;--> statement-breakpoint
ALTER TABLE "messenger_profiles" ADD COLUMN "lunch_start" text;--> statement-breakpoint
ALTER TABLE "messenger_profiles" ADD COLUMN "lunch_minutes" integer;--> statement-breakpoint
ALTER TABLE "messenger_profiles" ADD COLUMN "lunch_pending_start" text;--> statement-breakpoint
ALTER TABLE "messenger_profiles" ADD COLUMN "lunch_pending_minutes" integer;--> statement-breakpoint
ALTER TABLE "messenger_profiles" ADD COLUMN "lunch_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messenger_profiles" ADD COLUMN "chat_disabled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messenger_profiles" ADD COLUMN "chat_disabled_by" text;