CREATE TABLE "certificates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"user_id" text,
	"course_id" uuid NOT NULL,
	"attempt_id" uuid,
	"full_name" text NOT NULL,
	"cpf" text NOT NULL,
	"role_title" text NOT NULL,
	"tenant_slug" text NOT NULL,
	"tenant_name" text NOT NULL,
	"issued_host" text NOT NULL,
	"course_title" text NOT NULL,
	"workload_hours" integer NOT NULL,
	"score" integer NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"question_ids" jsonb NOT NULL,
	"option_orders" jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submitted_at" timestamp with time zone,
	"answers" jsonb,
	"correct" integer,
	"total" integer,
	"passed" boolean
);
--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "passing_score" integer DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "workload_hours" integer;--> statement-breakpoint
ALTER TABLE "courses" ADD COLUMN "retry_hours" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "course_questions" ADD CONSTRAINT "course_questions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_code" ON "certificates" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "certificates_user_course" ON "certificates" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE INDEX "course_questions_course" ON "course_questions" USING btree ("course_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_course" ON "quiz_attempts" USING btree ("user_id","course_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempts_one_open" ON "quiz_attempts" USING btree ("user_id","course_id") WHERE "quiz_attempts"."submitted_at" is null;