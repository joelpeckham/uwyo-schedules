import Link from "next/link";

export function PlannerCtaBand() {
  return (
    <section
      className="border-b border-border bg-primary/5 px-4 py-12 sm:px-6 sm:py-14"
      aria-labelledby="planner-cta-heading"
    >
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between lg:max-w-[90rem]">
        <div className="max-w-xl">
          <h2
            id="planner-cta-heading"
            className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
          >
            Ready to plan your week?
          </h2>
          <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
            Pick a term, add your courses, and let the planner find a schedule
            that fits.
          </p>
        </div>
        <Link
          href="/planner"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-95"
        >
          Open the planner
        </Link>
      </div>
    </section>
  );
}
