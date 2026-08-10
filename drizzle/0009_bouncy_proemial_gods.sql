ALTER TABLE "office_publications" ADD COLUMN "attachment_stored_name" text;--> statement-breakpoint
ALTER TABLE "office_publications" ADD COLUMN "attachment_display_name" text;--> statement-breakpoint
ALTER TABLE "office_publications" ADD COLUMN "attachment_path" text;--> statement-breakpoint
ALTER TABLE "office_publications" ADD COLUMN "attachment_mime_type" text;--> statement-breakpoint
ALTER TABLE "office_publications" ADD COLUMN "attachment_size_bytes" integer;