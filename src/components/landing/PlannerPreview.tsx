import { LandingPlannerScrollDemo } from "@/components/landing/LandingPlannerScrollDemo";
import { Reveal } from "@/components/landing/motion";

export function PlannerPreview() {
  const heading = (
    <>
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
      <Reveal delay={0.14}>
        <p className="mt-4 max-w-prose text-sm leading-relaxed text-muted-foreground">
          Scroll to watch a section get dragged onto a conflicting slot—then
          see the planner rearrange around your pinned courses. Sample week
          only; open the planner to build yours.
        </p>
      </Reveal>
    </>
  );

  return (
    <section
      className="relative border-b border-border bg-muted/20 px-4 py-14 sm:px-6 sm:py-16"
      aria-labelledby="preview-heading"
    >
      <div className="mx-auto max-w-6xl lg:max-w-[90rem]">
        <p className="sr-only">
          Sample week preview: CHEM 1020 meets Monday, Wednesday, and Friday
          9 to 9:50 a.m. with a Tuesday lab and Thursday exam block. ENGL 1010
          meets Tuesday and Thursday 11 a.m. to 12:15 p.m. MATH 1400 meets
          Monday, Wednesday, and Friday 10 to 10:50 a.m. After rearranging,
          ENGL moves to Wednesday morning and MATH shifts to early afternoon.
          Three courses, no overlaps.
        </p>
        <LandingPlannerScrollDemo heading={heading} />
      </div>
    </section>
  );
}
