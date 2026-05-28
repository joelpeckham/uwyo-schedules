/**
 * Static planner page intro — shared by HomePlanner and PlannerSkeleton so
 * Suspense resolution does not shift the header.
 */
export function PlannerIntroHeader() {
  return (
    <div
      id="planner"
      tabIndex={-1}
      className="scroll-mt-24 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Planner
      </p>
      <h1 className="mt-1 font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
        Your week
      </h1>
      <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
        Add courses, set optional instructor preferences, and the planner keeps a
        conflict-free week ready. Pin sections you like, drag a block to try
        other times, or tap for details.
      </p>
    </div>
  );
}
