ALTER TABLE "messenger_members" ADD COLUMN "cleared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messenger_messages" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messenger_messages" ADD COLUMN "original_body" text;--> statement-breakpoint
ALTER TABLE "messenger_messages" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messenger_messages" ADD COLUMN "deleted_by" text;