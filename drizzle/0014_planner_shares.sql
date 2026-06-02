CREATE TABLE IF NOT EXISTS "planner_shares" (
	"code" text PRIMARY KEY NOT NULL,
	"term_code" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "planner_shares" ADD CONSTRAINT "planner_shares_term_code_terms_code_fk" FOREIGN KEY ("term_code") REFERENCES "public"."terms"("code") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
