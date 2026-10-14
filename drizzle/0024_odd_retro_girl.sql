ALTER TABLE "transparency_bulletins" ALTER COLUMN "gross_revenue_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transparency_bulletins" ALTER COLUMN "taxes_paid_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transparency_bulletins" ALTER COLUMN "expenses_cents" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "transparency_bulletins" ADD COLUMN "fund_amounts_cents" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "transparency_bulletins" ADD COLUMN "iss_cents" bigint DEFAULT 0 NOT NULL;