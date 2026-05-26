import Link from "next/link";

import { SITE_TAGLINE } from "@/lib/seo/site";

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
          UW class schedule planner with a conflict-free week view
        </h1>
        <p className="mt-6 max-w-prose text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
          Add courses from the live catalog, block busy times, and set instructor
          preferences. The planner keeps your calendar in sync as you pin
          sections, try same-type swaps, compare alternate weeks, and share a
          link.
        </p>
        <p className="mt-3 max-w-prose text-pretty text-base text-muted-foreground">
          {SITE_TAGLINE}
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href="/planner"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-95"
          >
            Open the planner
          </Link>
        </div>
      </div>
    </section>
  );
}
