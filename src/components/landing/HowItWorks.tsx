import {
  CalendarCheck2,
  GitCompareArrows,
  ListPlus,
  SlidersHorizontal,
} from "lucide-react";

import { Reveal, Stagger, StaggerItem } from "@/components/landing/motion";

const steps = [
  {
    title: "Add your courses",
    body: "Search the UW catalog for your term and add each class to your list. Linked labs and discussions stay matched automatically.",
    icon: ListPlus,
  },
  {
    title: "Set constraints",
    body: "Mark busy times, limit sections by instructor, and turn on filters like open seats only. All optional—the planner finds conflict-free weeks that fit.",
    icon: SlidersHorizontal,
  },
  {
    title: "Refine your week",
    body: "See a conflict-free calendar that updates as you edit. Pin a section to keep it, or drag a block to try a same-type alternative.",
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
        <Reveal>
          <h2
            id="how-it-works-heading"
            className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
          >
            What the planner does
          </h2>
        </Reveal>
        <Stagger
          as="ol"
          className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4"
          stagger={0.12}
        >
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <StaggerItem
                key={step.title}
                hoverLift
                className="rounded-lg border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="font-mono text-xs font-medium text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Icon
                  className="mt-3 h-6 w-6 text-primary transition-transform duration-200 group-hover:scale-105"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <h3 className="mt-3 font-heading text-lg font-medium text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </section>
  );
}
