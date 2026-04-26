ALTER TABLE "planner_term_ui_state" ADD COLUMN "blackouts" jsonb DEFAULT '{"v":1,"items":[]}'::jsonb NOT NULL;
