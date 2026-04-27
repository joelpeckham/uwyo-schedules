ALTER TABLE "planner_items" ADD COLUMN "section_pins" jsonb DEFAULT '{"v":1,"byType":{}}'::jsonb NOT NULL;
