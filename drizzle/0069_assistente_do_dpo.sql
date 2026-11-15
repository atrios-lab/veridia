CREATE TABLE "dpo_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"user_id" text,
	"user_role" text NOT NULL,
	"kind" text DEFAULT 'chat' NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dpo_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"tenant_slug" text NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"masked_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"invalid_citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dpo_monthly_usage" (
	"tenant_slug" text NOT NULL,
	"month" text NOT NULL,
	"answered" integer DEFAULT 0 NOT NULL,
	"refused" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "dpo_monthly_usage_tenant_slug_month_pk" PRIMARY KEY("tenant_slug","month")
);
--> statement-breakpoint
CREATE TABLE "dpo_tenant_settings" (
	"tenant_slug" text PRIMARY KEY NOT NULL,
	"monthly_limit" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
ALTER TABLE "dpo_conversations" ADD CONSTRAINT "dpo_conversations_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpo_messages" ADD CONSTRAINT "dpo_messages_conversation_id_dpo_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."dpo_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dpo_conversations_owner" ON "dpo_conversations" USING btree ("tenant_slug","user_id","last_message_at");--> statement-breakpoint
CREATE INDEX "dpo_conversations_last_message_at" ON "dpo_conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "dpo_messages_conversation_created_at" ON "dpo_messages" USING btree ("conversation_id","created_at");