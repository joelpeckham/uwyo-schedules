import { PLANNER_WEEK_VIEWPORT_HEIGHT } from "./week-calendar/constants";

/**
 * Reserves the same vertical space as the mounted `WeekCalendar` card (toolbar +
 * grid viewport) so dynamic import and route Suspense do not cause large CLS
 * when the real component appears.
 */
export function WeekCalendarLoadingPlaceholder() {
  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
      aria-busy
      aria-label="Loading calendar"
    >
      <div className="border-b border-border p-3 sm:p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className="h-6 w-36 rounded bg-muted sm:h-7 sm:w-44" />
            <div className="h-7 w-14 rounded-full bg-muted/80" />
            <div className="h-7 w-16 rounded-full bg-muted/80" />
          </div>
          <div className="flex w-full min-w-0 flex-1 flex-wrap items-center justify-end gap-2 md:gap-3">
            <div className="h-9 w-20 rounded-md bg-muted/70" />
            <div className="h-9 w-24 rounded-md bg-muted/70" />
            <div className="h-9 w-9 rounded-md bg-muted/70" />
            <div className="h-9 w-9 rounded-md bg-muted/70" />
            <div className="h-9 w-9 rounded-md bg-muted/70" />
          </div>
        </div>
        <div className="mt-2 h-3 w-full max-w-md rounded bg-muted/50" />
      </div>
      <div
        className="flex items-center justify-center border-b border-border bg-muted/15 px-4 py-10 text-sm text-muted-foreground"
        style={{ height: PLANNER_WEEK_VIEWPORT_HEIGHT }}
        role="status"
        aria-live="polite"
      >
        Loading calendar…
      </div>
    </section>
  );
}
