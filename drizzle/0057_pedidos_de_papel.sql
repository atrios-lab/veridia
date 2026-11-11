CREATE TABLE "paper_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"year" integer NOT NULL,
	"sequence" integer NOT NULL,
	"supplier_id" uuid NOT NULL,
	"supplier" jsonb NOT NULL,
	"order" jsonb NOT NULL,
	"status" text DEFAULT 'rascunho' NOT NULL,
	"sent_on" text DEFAULT '' NOT NULL,
	"received_on" text DEFAULT '' NOT NULL,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	"remove_reason" text DEFAULT '' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paper_suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"data" jsonb NOT NULL,
	"model_path" text,
	"model_name" text,
	"removed_at" timestamp with time zone,
	"removed_by" text,
	"remove_reason" text DEFAULT '' NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "security_paper_reports" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security_paper_reports" ADD COLUMN "removed_by" text;--> statement-breakpoint
ALTER TABLE "security_paper_reports" ADD COLUMN "remove_reason" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "security_paper_reports" ADD COLUMN "updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "paper_orders" ADD CONSTRAINT "paper_orders_supplier_id_paper_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."paper_suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "paper_orders_tenant_year_sequence" ON "paper_orders" USING btree ("tenant_slug","year","sequence");--> statement-breakpoint
CREATE INDEX "paper_orders_tenant" ON "paper_orders" USING btree ("tenant_slug","created_at");--> statement-breakpoint
CREATE INDEX "paper_suppliers_tenant" ON "paper_suppliers" USING btree ("tenant_slug");