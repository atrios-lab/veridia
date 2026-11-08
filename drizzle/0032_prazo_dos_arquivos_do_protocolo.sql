ALTER TABLE "service_request_attachments" ALTER COLUMN "path" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "service_request_attachments" ADD COLUMN "purged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
-- Protocols already closed get their 30 days from today, not from when they
-- closed: the offices have to be told first, and download what they want to
-- keep, before anything is deleted. Closed statuses per kind mirror
-- TERMINAL_STATUSES in src/core/request/kinds.ts.
UPDATE "service_requests" SET "closed_at" = now() WHERE
  ("kind" = 'service-request' AND "status" IN ('done', 'rejected', 'cancelled', 'archived'))
  OR ("kind" = 'appointment' AND "status" IN ('done', 'cancelled'))
  OR ("kind" = 'data-rights' AND "status" IN ('answered', 'cancelled'))
  OR ("kind" = 'ombudsman' AND "status" IN ('answered', 'done', 'archived'));
