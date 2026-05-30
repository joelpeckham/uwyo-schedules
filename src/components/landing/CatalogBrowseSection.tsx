import { AppLink } from "@/components/seo/AppLink";
import { Reveal } from "@/components/landing/motion";

export function CatalogBrowseSection({
  latestTerm,
}: {
  latestTerm: { code: string; description: string } | null;
}) {
  return (
    <section
      className="border-b border-border bg-muted/10 px-4 py-14 sm:px-6 sm:py-16"
      aria-labelledby="catalog-browse-heading"
    >
      <div className="mx-auto max-w-6xl lg:max-w-[90rem]">
        <Reveal>
          <h2
            id="catalog-browse-heading"
            className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
          >
            Browse the University of Wyoming catalog
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-4 max-w-prose text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Search Wyoming courses by subject, open section details from the
            live University of Wyoming course catalog, then send your picks to
            the planner to build a conflict-free UW schedule.
          </p>
        </Reveal>
        <Reveal delay={0.14}>
          <div className="mt-8 flex flex-wrap gap-3">
            <AppLink
              href="/courses"
              prefetch
              className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-95"
            >
              Browse Wyoming courses
            </AppLink>
            {latestTerm ? (
              <AppLink
                href={`/terms/${encodeURIComponent(latestTerm.code)}`}
                prefetch
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-card px-5 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted/40"
              >
                {latestTerm.description} catalog
              </AppLink>
            ) : null}
            <AppLink
              href="/planner"
              prefetch
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-card px-5 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted/40"
            >
              Build your UW schedule
            </AppLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
