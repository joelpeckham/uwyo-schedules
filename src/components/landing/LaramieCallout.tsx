import { AppLink } from "@/components/seo/AppLink";
import { ParallaxTopo, Reveal } from "@/components/landing/motion";

export function LaramieCallout() {
  return (
    <section
      className="relative overflow-hidden  border-border bg-muted px-4 py-14 sm:px-6 sm:py-16"
      aria-labelledby="laramie-heading"
    >
      <ParallaxTopo className="pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-3xl text-center">
        <Reveal>
          <h2
            id="laramie-heading"
            className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
          >
            Built for UW students in Laramie
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Independent and free. Not affiliated with the University of Wyoming.
            You register through official UW systems when your window opens.
          </p>
        </Reveal>
        <Reveal delay={0.14}>
          <p className="mt-6">
            <AppLink
              href="/planner"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Open the planner
            </AppLink>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
