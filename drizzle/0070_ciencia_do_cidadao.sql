CREATE TABLE "service_request_citizen_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"request_id" uuid NOT NULL,
	"target" text NOT NULL,
	"target_id" text NOT NULL,
	"action" text NOT NULL,
	"first_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_at" timestamp with time zone DEFAULT now() NOT NULL,
	"times" integer DEFAULT 1 NOT NULL,
	"first_ip" text,
	"first_user_agent" text
);
--> statement-breakpoint
ALTER TABLE "service_request_citizen_views" ADD CONSTRAINT "service_request_citizen_views_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_request_citizen_views_unique" ON "service_request_citizen_views" USING btree ("request_id","target","target_id","action");