"use client";

import { track as vercelTrack } from "@vercel/analytics";

/**
 * Strongly-typed product analytics events for the planner.
 *
 * Keep names short, snake-case, and grouped by surface (planner_*, schedule_*).
 * Property values must be JSON-serializable scalars; Vercel's `track` strips
 * everything else.
 *
 * The wrapper exists so that:
 *   - we have one place to gate analytics in dev / private mode
 *   - we can swap providers later without crawling the codebase
 *   - the event taxonomy lives in one type union (not stringly-typed at call sites)
 */
export type PlannerAnalyticsEvent =
  | { name: "planner_course_added"; props: { subject: string; courseNumber: string; courseCount: number } }
  | { name: "planner_course_removed"; props: { subject: string; courseNumber: string; courseCount: number } }
  | { name: "planner_instructor_pref_set"; props: { kind: "primary" | "linked"; choseAny: boolean } }
  | { name: "planner_blackout_added"; props: { dayIndex: number; minutes: number } }
  | { name: "planner_blackout_edited"; props: { dayIndex: number; minutes: number } }
  | { name: "planner_blackout_removed"; props: Record<string, never> }
  | { name: "planner_blackouts_cleared"; props: { count: number } }
  | { name: "planner_section_pinned"; props: { scheduleTypeKey: string; viaDrag: boolean } }
  | { name: "planner_section_unpinned"; props: { scheduleTypeKey: string } }
  | { name: "planner_section_swapped"; props: { sourceCrn: string; targetCrn: string } }
  | { name: "planner_solutions_recalculated"; props: { itemCount: number; solutionCount: number; capped: boolean; timedOut: boolean; ms: number } }
  | { name: "planner_solutions_empty"; props: { itemCount: number; hintCount: number } }
  | { name: "planner_solution_changed"; props: { from: number; to: number; total: number; method: "next" | "prev" | "first" | "last" | "keep" | "drop" } }
  | { name: "planner_solution_kept"; props: { index: number; total: number } }
  | { name: "planner_solution_unkept"; props: { index: number; total: number } }
  | { name: "planner_compare_opened"; props: { kept: number } }
  | { name: "planner_time_pref_changed"; props: { kind: "noFridays" | "noBefore" | "noAfter" | "protectLunch"; on: boolean; minutes?: number } }
  | { name: "planner_exclude_full_toggled"; props: { on: boolean } }
  | { name: "planner_exclude_tba_toggled"; props: { on: boolean } }
  | { name: "planner_exclude_online_async_toggled"; props: { on: boolean } }
  | { name: "planner_export_used"; props: { format: "crns" | "crn_list" | "ics" | "print" } }
  | { name: "planner_share_link_copied"; props: { length: number } }
  | { name: "planner_section_detail_opened"; props: { source: "block" | "rail" | "course_picker" } }
  | { name: "planner_help_opened"; props: Record<string, never> }
  | { name: "planner_first_run_seeded"; props: { courses: number } }
  | { name: "planner_example_courses_added"; props: { courseCount: number } }
  | { name: "planner_tour_step_seen"; props: { step: number } }
  | { name: "planner_tour_dismissed"; props: { step: number } };

/**
 * Fire and forget; safe to call from any client component.
 *
 * No-ops outside the browser, in private mode (when Vercel's beacon is blocked
 * by the user agent), and during early hydration. Errors never bubble.
 */
export function track<E extends PlannerAnalyticsEvent>(
  event: E["name"],
  props: E["props"],
): void {
  if (typeof window === "undefined") return;
  try {
    // Vercel's `track` accepts `Record<string, AllowedPropertyValues>`; our
    // event union narrows that to scalar JSON values, which is exactly what
    // Vercel keeps. Cast is safe because the union members guarantee it.
    vercelTrack(event, props as Record<string, string | number | boolean | null>);
  } catch {
    /* analytics never throws into product code */
  }
}
