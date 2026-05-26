import { WeekCalendarGridSkeleton } from "./week-calendar/WeekCalendarGridSkeleton";

/**
 * Reserves the same vertical space as the mounted `WeekCalendar` card (alerts +
 * toolbar + pager + grid) so dynamic import and route Suspense do not cause CLS.
 */
export function WeekCalendarLoadingPlaceholder() {
  return (
    <section
      className="min-w-0 overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm"
      aria-busy
      aria-label="Loading calendar"
    >
      <div className="h-10 border-b border-border bg-muted/10" aria-hidden />
      <div className="border-b border-border p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between xl:gap-4">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="h-7 w-full rounded bg-muted sm:h-8 sm:w-44" />
            <div className="h-7 w-14 rounded-full bg-muted/80" />
            <div className="h-7 w-16 rounded-full bg-muted/80" />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between xl:shrink-0 xl:justify-end xl:gap-3">
            <div className="h-9 w-32 rounded-md bg-muted/70 sm:w-36" />
            <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
              <div className="h-9 w-24 rounded-md bg-muted/70 sm:w-28" />
              <div className="h-9 w-9 rounded-md bg-muted/70" />
              <div className="h-9 w-9 rounded-md bg-muted/70" />
            </div>
          </div>
        </div>
        <div className="mt-2 h-4 w-full max-w-md rounded bg-muted/50" />
      </div>
      <div
        className="flex min-h-20 items-center border-b border-border bg-muted/15 px-3 sm:min-h-11 sm:px-4"
        aria-hidden
      >
        <div className="h-3 w-40 rounded bg-muted/60" />
      </div>
      <WeekCalendarGridSkeleton />
    </section>
  );
}
