ALTER TABLE "certificates" ALTER COLUMN "score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "certificate_kind" text DEFAULT 'completion' NOT NULL;