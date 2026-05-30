import { AppLink } from "@/components/seo/AppLink";
import { ParallaxTopo, Reveal } from "@/components/landing/motion";

export function PlannerCtaBand() {
  return (
    <section
      className="relative overflow-hidden border-b border-border bg-primary/8 px-4 py-14 sm:px-6 sm:py-16"
      aria-labelledby="planner-cta-heading"
    >
      <ParallaxTopo className="pointer-events-none absolute inset-0" opacity={0.14} />
      <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-8 sm:flex-row sm:items-center sm:justify-between lg:max-w-[90rem]">
        <Reveal className="max-w-xl">
          <h2
            id="planner-cta-heading"
            className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl lg:text-4xl"
          >
            Ready to plan your UW schedule?
          </h2>
          <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Pick a term, add Wyoming courses from the catalog, and let the
            planner find a conflict-free week that fits.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <AppLink
            href="/planner"
            prefetch
            className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-md bg-primary px-8 text-sm font-medium text-primary-foreground shadow-md transition hover:opacity-95"
          >
            Open the planner
          </AppLink>
        </Reveal>
      </div>
    </section>
  );
}
