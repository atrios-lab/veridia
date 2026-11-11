ALTER TABLE "iss_declarations" ADD COLUMN "iss_from_report" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "iss_declarations" ADD COLUMN "attachments" jsonb;