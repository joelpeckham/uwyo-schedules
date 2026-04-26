import { CalendarCheck2, ListPlus, SlidersHorizontal } from "lucide-react";

const steps = [
  {
    title: "Pick your classes",
    body: "Search the catalog for the term you care about, then add each course to your list.",
    icon: ListPlus,
  },
  {
    title: "Set preferences and blackouts",
    body: "Optional instructor picks and busy times keep the solver honest about what “fits” really means for you.",
    icon: SlidersHorizontal,
  },
  {
    title: "Page through valid weeks",
    body: "We generate every conflict-free weekly schedule so you can compare options without spreadsheet gymnastics.",
    icon: CalendarCheck2,
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
          How it works
        </h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
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
