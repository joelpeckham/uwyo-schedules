import { AppLink } from "@/components/seo/AppLink";
import { Reveal } from "@/components/landing/motion";

import { SITE_TAGLINE } from "@/lib/seo/site";

export function HeroSection() {
  return (
    <section
      className="relative overflow-x-hidden border-b border-border bg-background px-4 py-16 sm:px-6 sm:py-24 lg:py-28"
      aria-labelledby="landing-hero-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-transparent to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        aria-hidden
        style={{
          backgroundImage: "url(/brand/topo-divider.svg)",
          backgroundRepeat: "repeat-x",
          backgroundPosition: "center top",
          backgroundSize: "auto 120%",
        }}
      />
      <div className="relative mx-auto max-w-6xl lg:max-w-[84rem]">
        <Reveal>
          <p className="font-heading text-sm font-medium tracking-wide text-muted-foreground">
            University of Wyoming · Laramie
          </p>
        </Reveal>
        <Reveal delay={0.08}>
          <h1
            id="landing-hero-heading"
            className="mt-4 max-w-4xl font-heading text-balance text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl lg:leading-[1.08]"
          >
            UW class schedule planner with a conflict-free week view
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <h2 className="mt-5 max-w-2xl font-heading text-balance text-xl font-medium tracking-tight text-foreground/90 sm:text-2xl">
            Browse the full University of Wyoming catalog and build your UW
            schedule
          </h2>
        </Reveal>
        <Reveal delay={0.22}>
          <p className="mt-6 max-w-prose text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Add Wyoming courses from the live catalog, block busy times, and set
            instructor preferences. The planner keeps your calendar in sync as
            you pin sections, try same-type swaps, compare alternate weeks, and
            share a link.
          </p>
        </Reveal>
        <Reveal delay={0.28}>
          <p className="mt-3 max-w-prose text-pretty text-base text-muted-foreground">
            {SITE_TAGLINE}
          </p>
        </Reveal>
        <Reveal delay={0.34}>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <AppLink
              href="/planner"
              prefetch
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-95"
            >
              Open the planner
            </AppLink>
            <AppLink
              href="/courses"
              prefetch
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-card px-6 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted/40"
            >
              Browse the UW catalog
            </AppLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
