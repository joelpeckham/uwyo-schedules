import { LandingWeekCalendarPreview } from "@/components/landing/LandingWeekCalendarPreview";
import { Reveal } from "@/components/landing/motion";

export function PlannerPreview() {
  return (
    <section
      className="border-b border-border bg-muted/20 px-4 py-14 sm:px-6 sm:py-16"
      aria-labelledby="preview-heading"
    >
      <div className="mx-auto max-w-6xl lg:max-w-[90rem]">
        <Reveal>
          <h2
            id="preview-heading"
            className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
          >
            Your week, conflict-free
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-3 max-w-prose text-pretty text-base leading-relaxed text-muted-foreground">
            The planner lays out meetings on a week calendar and removes overlaps
            as you add courses and constraints.
          </p>
        </Reveal>
        <p className="sr-only">
          Sample week preview: MATH 2200 meets Monday, Wednesday, and Friday
          9 to 10 a.m. in the Engineering Building. ENGL 1010 meets Tuesday
          and Thursday 11 a.m. to 12:15 p.m. in the Classroom Building. COSC
          2030 meets Monday and Wednesday 2 to 3:15 p.m., with a Tuesday
          discussion and Thursday lab. Three courses, no overlaps.
        </p>
        <Reveal delay={0.14}>
          <figure className="mt-8" aria-hidden>
            <LandingWeekCalendarPreview />
            <figcaption className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
              Sample week only. Three courses, no overlaps, lab linked
              automatically—open the planner to build yours.
            </figcaption>
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
