"use client";

import { CalendarPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/track";
import { addCourseWithOptionalPinLocal } from "@/lib/planner/add-course-local";
import { plannerHasCourse, readTerm, subscribeLocalDoc } from "@/lib/planner/local-state";
import { normalizeScheduleTypeKey } from "@/lib/planner/swap-helpers";
import { cn } from "@/lib/utils";

type Props = {
  termCode: string;
  subject: string;
  courseNumber: string;
  courseLabel: string;
  crn?: string;
  scheduleTypeDescription?: string | null;
  className?: string;
};

function readInPlanner(
  termCode: string,
  subject: string,
  courseNumber: string,
): boolean {
  return plannerHasCourse(readTerm(termCode).items, subject, courseNumber);
}

export function AddToPlannerCta({
  termCode,
  subject,
  courseNumber,
  courseLabel,
  crn,
  scheduleTypeDescription,
  className,
}: Props) {
  const router = useRouter();
  const inPlanner = useSyncExternalStore(
    subscribeLocalDoc,
    () => readInPlanner(termCode, subject, courseNumber),
    () => false,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onClick = useCallback(() => {
    setPending(true);
    setError(null);

    const scheduleTypeKey = normalizeScheduleTypeKey(scheduleTypeDescription);
    const sectionPin =
      crn && scheduleTypeKey.length > 0
        ? { crn, scheduleTypeKey }
        : undefined;

    const res = addCourseWithOptionalPinLocal({
      termCode,
      subject,
      courseNumber,
      sectionPin,
    });

    if (!res.ok) {
      setError(res.error);
      setPending(false);
      return;
    }

    track("seo_add_to_planner_clicked", {
      source: crn ? "crn" : "course",
      subject,
      courseNumber,
      wasAdded: res.wasAdded,
    });

    router.push(`/planner?term=${encodeURIComponent(termCode)}`);
  }, [
    termCode,
    subject,
    courseNumber,
    crn,
    scheduleTypeDescription,
    router,
  ]);

  const label = inPlanner ? "Open in planner" : "Add to planner";

  return (
    <div className={cn("flex flex-col items-stretch gap-2 sm:items-end", className)}>
      <Button
        type="button"
        size="lg"
        className="min-h-11 shrink-0 px-6"
        disabled={pending || Boolean(error)}
        onClick={onClick}
        aria-label={
          inPlanner
            ? `Open ${courseLabel} in the planner`
            : `Add ${courseLabel} to the planner`
        }
      >
        <CalendarPlus aria-hidden />
        {label}
      </Button>
      {error ? (
        <p className="max-w-xs text-pretty text-xs text-muted-foreground sm:text-right">
          {error}
        </p>
      ) : null}
    </div>
  );
}
