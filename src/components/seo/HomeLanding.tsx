import { BookOpen, CalendarOff, UserRound } from "lucide-react";
import Link from "next/link";
import { HOME_FAQ_ITEMS } from "@/lib/seo/home-faq";

const features = [
  {
    title: "Conflict-free schedules",
    body: "We only show weekly combinations that actually work together — no overlapping meetings, no impossible labs.",
    icon: BookOpen,
  },
  {
    title: "Instructor preferences",
    body: "Prefer a section or instructor when Banner offers choices. The solver respects what it can and stays honest when it cannot.",
    icon: UserRound,
  },
  {
    title: "Busy-time blackouts",
    body: "Block the hours you are not on campus. The planner keeps your real life in the loop, not just your CRNs.",
    icon: CalendarOff,
  },
] as const;

export function HomeLanding({
  latestTermCode,
}: {
  latestTermCode: string | null;
}) {
  return (
    <section
      className="border-b border-border bg-muted/20"
      aria-labelledby="home-hero-heading"
    >
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:max-w-[90rem] lg:py-14">
        <p className="font-heading text-sm font-medium tracking-wide text-muted-foreground">
          University of Wyoming
        </p>
        <h1
          id="home-hero-heading"
          className="mt-2 max-w-3xl font-heading text-balance text-3xl font-medium tracking-tight text-foreground sm:text-4xl"
        >
          University of Wyoming class schedule planner
        </h1>
        <p className="mt-4 max-w-prose text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
          From course list to class schedule, in minutes. Pick your classes —
          we generate every conflict-free weekly schedule from the live UW Banner
          catalog.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <a
            href="#planner"
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-95"
          >
            Build a schedule
          </a>
          {latestTermCode ? (
            <Link
              href={`/terms/${encodeURIComponent(latestTermCode)}`}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Browse the {latestTermCode} catalog
            </Link>
          ) : null}
        </div>

        <ul className="mt-12 grid gap-6 sm:grid-cols-3">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <li
                key={f.title}
                className="rounded-lg border border-border bg-card p-5 shadow-sm"
              >
                <Icon
                  className="h-6 w-6 text-primary"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <h2 className="mt-3 font-heading text-lg font-medium text-foreground">
                  {f.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </li>
            );
          })}
        </ul>

        <div className="mt-16 border-t border-border pt-10">
          <h2 className="font-heading text-2xl font-medium text-foreground">
            Common questions
          </h2>
          <dl className="mt-6 space-y-6">
            {HOME_FAQ_ITEMS.map((item) => (
              <div key={item.question}>
                <dt className="font-medium text-foreground">{item.question}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.answer}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
