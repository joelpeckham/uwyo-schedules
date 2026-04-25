CREATE TABLE "planner_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planner_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"term_code" text NOT NULL,
	"subject" text NOT NULL,
	"course_number" text NOT NULL,
	"display_color" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"selection_kind" text NOT NULL,
	"anchor_crn" text NOT NULL,
	"linked_bundle_id" integer
);
--> statement-breakpoint
ALTER TABLE "planner_items" ADD CONSTRAINT "planner_items_session_id_planner_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."planner_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_items" ADD CONSTRAINT "planner_items_term_code_terms_code_fk" FOREIGN KEY ("term_code") REFERENCES "public"."terms"("code") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_items" ADD CONSTRAINT "planner_items_linked_bundle_id_linked_bundles_id_fk" FOREIGN KEY ("linked_bundle_id") REFERENCES "public"."linked_bundles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planner_items_session_term_idx" ON "planner_items" USING btree ("session_id","term_code");
