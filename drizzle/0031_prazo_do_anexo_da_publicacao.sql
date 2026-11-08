ALTER TABLE "office_publications" ADD COLUMN "attachment_uploaded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "office_publications" ADD COLUMN "attachment_purged_at" timestamp with time zone;--> statement-breakpoint
-- Files already attached get their 30 days from today, not from when they
-- were sent: the office has to be told first, and download what it wants
-- to keep, before anything is deleted.
UPDATE "office_publications" SET "attachment_uploaded_at" = now() WHERE "attachment_path" IS NOT NULL;
