CREATE TABLE "service_request_requirement_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"requirement_id" uuid NOT NULL,
	"author" text NOT NULL,
	"author_user_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_request_attachments" ADD COLUMN "requirement_message_id" uuid;--> statement-breakpoint
ALTER TABLE "service_request_requirement_messages" ADD CONSTRAINT "service_request_requirement_messages_requirement_id_service_request_requirements_id_fk" FOREIGN KEY ("requirement_id") REFERENCES "public"."service_request_requirements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_request_requirement_messages" ADD CONSTRAINT "service_request_requirement_messages_author_user_id_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_request_requirement_messages_requirement" ON "service_request_requirement_messages" USING btree ("requirement_id","created_at");--> statement-breakpoint
ALTER TABLE "service_request_attachments" ADD CONSTRAINT "service_request_attachments_requirement_message_id_service_request_requirement_messages_id_fk" FOREIGN KEY ("requirement_message_id") REFERENCES "public"."service_request_requirement_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_request_attachments_requirement_message" ON "service_request_attachments" USING btree ("requirement_message_id");