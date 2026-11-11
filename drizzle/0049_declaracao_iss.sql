CREATE TABLE "iss_declarations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"year" integer NOT NULL,
	"sequence" integer NOT NULL,
	"competence" text NOT NULL,
	"emoluments_cents" bigint NOT NULL,
	"rate_basis_points" integer NOT NULL,
	"iss_cents" bigint NOT NULL,
	"dam_number" text DEFAULT '' NOT NULL,
	"due_date" text DEFAULT '' NOT NULL,
	"paid_on" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"attachment_path" text,
	"attachment_name" text,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "iss_declarations_tenant_year_sequence_live" ON "iss_declarations" USING btree ("tenant_slug","year","sequence") WHERE "iss_declarations"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "iss_declarations_tenant_competence" ON "iss_declarations" USING btree ("tenant_slug","competence");