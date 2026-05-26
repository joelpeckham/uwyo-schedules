import {
  CalendarCheck2,
  GitCompareArrows,
  ListPlus,
  SlidersHorizontal,
} from "lucide-react";

const steps = [
  {
    title: "Add your courses",
    body: "Search the UW catalog for your term and add each class to your list. Linked labs and discussions stay matched automatically.",
    icon: ListPlus,
  },
  {
    title: "Set constraints",
    body: "Mark busy times, rank instructor preferences, and turn on filters like no Fridays or open seats only. All optional—the planner ranks weeks that fit you higher.",
    icon: SlidersHorizontal,
  },
  {
    title: "Refine your week",
    body: "See a conflict-free calendar that updates as you edit. Pin sections you want to keep, or drag a block to try a same-type alternative.",
    icon: CalendarCheck2,
  },
  {
    title: "Compare and share",
    body: "Page through other conflict-free weeks, keep favorites, and compare two side by side. Copy a share link so a friend can open your course list and constraints in the planner.",
    icon: GitCompareArrows,
  },
] as const;

export function HowItWorks() {
  return (
    <section
      className="border-b border-border bg-muted/15 px-4 py-14 sm:px-6 sm:py-16"
      aria-labelledby="how-it-works-heading"
    >
      <div className="mx-auto max-w-6xl lg:max-w-[90rem]">
        <h2
          id="how-it-works-heading"
          className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
        >
          What the planner does
        </h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={step.title}
                className="rounded-lg border border-border bg-card p-6 shadow-sm"
              >
                <span className="font-mono text-xs font-medium text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Icon
                  className="mt-3 h-6 w-6 text-primary"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <h3 className="mt-3 font-heading text-lg font-medium text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
