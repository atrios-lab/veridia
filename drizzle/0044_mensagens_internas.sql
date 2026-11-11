CREATE TABLE "messenger_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_slug" text NOT NULL,
	"pair_key" text,
	"title" text,
	"created_by" text NOT NULL,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messenger_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"last_read_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messenger_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"tenant_slug" text NOT NULL,
	"sender_id" text NOT NULL,
	"kind" text NOT NULL,
	"body" text,
	"file_path" text,
	"file_name" text,
	"mime_type" text,
	"size_bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messenger_profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tenant_slug" text NOT NULL,
	"photo_path" text,
	"status" text DEFAULT 'disponivel' NOT NULL,
	"personal_message" text,
	"color" text DEFAULT 'verde' NOT NULL,
	"sound" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messenger_members" ADD CONSTRAINT "messenger_members_conversation_id_messenger_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."messenger_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messenger_messages" ADD CONSTRAINT "messenger_messages_conversation_id_messenger_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."messenger_conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "messenger_conversations_pair" ON "messenger_conversations" USING btree ("tenant_slug","pair_key");--> statement-breakpoint
CREATE UNIQUE INDEX "messenger_members_unique" ON "messenger_members" USING btree ("conversation_id","user_id");--> statement-breakpoint
CREATE INDEX "messenger_members_user" ON "messenger_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "messenger_messages_conversation" ON "messenger_messages" USING btree ("conversation_id","created_at");