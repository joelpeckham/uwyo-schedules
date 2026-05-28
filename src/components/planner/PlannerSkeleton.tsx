import { SiteChrome } from "@/components/seo/SiteChrome";

import { PlannerGridPlaceholder } from "./PlannerGridPlaceholder";
import { PlannerIntroHeader } from "./PlannerIntroHeader";

const headerTermSelectStub = (
  <div
    aria-hidden
    className="h-9 min-w-48 rounded-md border border-border bg-muted/30 sm:w-56"
  />
);

/**
 * Suspense fallback that mirrors the planner page shell and reserves the
 * same vertical real estate as the eventual `<WeekCalendar />`.
 */
export function PlannerSkeleton() {
  return (
    <SiteChrome actions={headerTermSelectStub}>
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:max-w-[90rem]">
          <PlannerIntroHeader />
          <PlannerGridPlaceholder />
        </div>
      </div>
    </SiteChrome>
  );
}
