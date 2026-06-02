"use client";

import { ArrowRight, Loader2, Plus, SlidersHorizontal, Sparkles, Wand2 } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { addCourseLocal } from "@/lib/planner/add-course-local";
import { track } from "@/lib/analytics/track";
import { plannerHasCourse } from "@/lib/planner/local-state";
import { cn } from "@/lib/utils";

import { usePlannerData, usePlannerSolve } from "./PlannerContext";

const EXAMPLE_COURSES = [
  { subject: "CHEM", courseNumber: "1020" },
  { subject: "ENGL", courseNumber: "1010" },
  { subject: "MATH", courseNumber: "1400" },
] as const;

type Props = {
  termCode: string;
};

export function PlannerEmptyHero({ termCode }: Props) {
  const { plannerItems, setPlannerItems } = usePlannerData();
  const { recalculateSolutions } = usePlannerSolve();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onTryExample = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      let items = plannerItems;
      let added = 0;
      for (const course of EXAMPLE_COURSES) {
        if (plannerHasCourse(items, course.subject, course.courseNumber)) {
          continue;
        }
        const res = addCourseLocal({
          termCode,
          subject: course.subject,
          courseNumber: course.courseNumber,
        });
        if (res.ok) {
          items = res.items;
          added += 1;
        }
      }
      if (added > 0) {
        setPlannerItems(items);
        track("planner_example_courses_added", {
          courseCount: items.length,
        });
        await recalculateSolutions();
      }
    } catch {
      setError("Couldn't add the example courses.");
    } finally {
      setPending(false);
    }
  }, [termCode, plannerItems, setPlannerItems, recalculateSolutions]);

  return (
    <section
      aria-labelledby="planner-empty-heading"
      className="rounded-xl border border-border bg-card p-5 text-card-foreground shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="grid size-9 place-items-center rounded-md border border-border bg-muted/40 text-primary">
          <Sparkles className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h2
            id="planner-empty-heading"
            className="font-heading text-lg font-medium text-foreground"
          >
            Plan a working week in four steps
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            uwyoschedule reads UW&rsquo;s Banner schedule and finds the
            section combinations that fit. Add the courses you need and the
            week you see updates as you adjust.
          </p>

          <ol className="mt-4 grid gap-3 sm:grid-cols-2">
            <Step
              number={1}
              icon={<Plus className="size-4" />}
              title="Search"
              body='Tap "Add course" in the calendar toolbar, search by subject or number, and pick a result.'
            />
            <Step
              number={2}
              icon={<SlidersHorizontal className="size-4" />}
              title="Set preferences"
              body="Optional: choose an instructor, mark times you&rsquo;re busy, or set time-of-day rules."
            />
            <Step
              number={3}
              icon={<ArrowRight className="size-4" />}
              title="See your week"
              body="The planner picks compatible sections and shows them on the calendar."
            />
            <Step
              number={4}
              icon={<Wand2 className="size-4" />}
              title="Experiment"
              body="Pin a section to lock it, drag a block to try other times, and explore what fits."
            />
          </ol>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              onClick={onTryExample}
              disabled={pending}
              className="min-h-11"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              <span className="ml-2">Try a sample week</span>
            </Button>
            <p className="text-xs text-muted-foreground">
              Adds CHEM 1020, ENGL 1010, and MATH 1400 so you can see the
              planner work. Remove any of them anytime.
            </p>
          </div>

          {error ? (
            <p className="mt-3 text-xs text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function Step({
  number,
  icon,
  title,
  body,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li
      className={cn(
        "rounded-lg border border-border/70 bg-muted/20 p-3",
        "flex gap-3",
      )}
    >
      <div className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-background font-mono text-sm tabular-nums text-muted-foreground">
        {number}
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          {icon}
          {title}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {body}
        </p>
      </div>
    </li>
  );
}
