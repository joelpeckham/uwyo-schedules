import { SiteChrome } from "@/components/seo/SiteChrome";

import { WeekCalendarLoadingPlaceholder } from "./WeekCalendarLoadingPlaceholder";

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
          <div className="space-y-2">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="h-8 w-48 rounded bg-muted" />
            <div className="h-4 w-full max-w-prose rounded bg-muted/70" />
          </div>
          <div className="lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-6">
            <div className="min-w-0 space-y-4">
              <div className="h-10 rounded-lg border border-dashed border-border bg-muted/30" />
              <div className="h-32 rounded-lg border border-dashed border-border bg-muted/20" />
              <div className="h-32 rounded-lg border border-dashed border-border bg-muted/20" />
            </div>
            <div className="mt-6 flex min-w-0 flex-col gap-4 lg:mt-0">
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: "0fr" }}
                aria-hidden
              >
                <div className="min-h-0 overflow-hidden" />
              </div>
              <WeekCalendarLoadingPlaceholder />
            </div>
          </div>
        </div>
      </div>
    </SiteChrome>
  );
}
