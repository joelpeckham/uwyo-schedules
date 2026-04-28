import Link from "next/link";

export function HeroSection() {
  return (
    <section
      className="border-b border-border bg-background px-4 py-14 sm:px-6 sm:py-20"
      aria-labelledby="landing-hero-heading"
    >
      <div className="mx-auto max-w-6xl lg:max-w-[90rem]">
        <p className="font-heading text-sm font-medium tracking-wide text-muted-foreground">
          University of Wyoming · Laramie
        </p>
        <h1
          id="landing-hero-heading"
          className="mt-3 max-w-3xl font-heading text-balance text-4xl font-medium tracking-tight text-foreground sm:text-5xl"
        >
          Build a UW class schedule that fits your life.
        </h1>
        <p className="mt-6 max-w-prose text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Add your courses from the live UW catalog. The planner keeps a
          conflict-free week in sync as you set preferences, mark busy times,
          and refine the calendar.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/planner"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-95"
          >
            Build a schedule
          </Link>
          <Link
            href="/courses"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Browse courses by subject
          </Link>
        </div>
      </div>
    </section>
  );
}
