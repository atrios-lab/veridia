ALTER TABLE "signed_documents" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "signed_documents" ADD COLUMN "removed_by" text;