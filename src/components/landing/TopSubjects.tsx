import { AppLink } from "@/components/seo/AppLink";
import { Reveal, Stagger, StaggerChipItem } from "@/components/landing/motion";
import { listSubjectsForTermForSeo, subjectToPathSegment } from "@/lib/seo/queries";

const TOP_N = 18;

export async function TopSubjects({
  latestTerm,
}: {
  latestTerm: { code: string; description: string } | null;
}) {
  if (!latestTerm) {
    return (
      <section
        className="border-b border-border px-4 py-12 sm:px-6"
        aria-labelledby="top-subjects-heading"
      >
        <div className="mx-auto max-w-6xl lg:max-w-[90rem]">
          <Reveal>
            <h2
              id="top-subjects-heading"
              className="font-heading text-2xl font-medium text-foreground"
            >
              Popular Wyoming courses by subject
            </h2>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mt-3 text-sm text-muted-foreground">
              No term data yet. After ingest, the busiest subjects for the latest
              term will appear here.
            </p>
          </Reveal>
        </div>
      </section>
    );
  }

  const subjects = await listSubjectsForTermForSeo(latestTerm.code);
  const ranked = [...subjects]
    .sort((a, b) => b.sectionCount - a.sectionCount)
    .slice(0, TOP_N);

  if (ranked.length === 0) {
    return null;
  }

  return (
    <section
      className="border-b border-border px-4 py-14 sm:px-6 sm:py-16"
      aria-labelledby="top-subjects-heading"
    >
      <div className="mx-auto max-w-6xl lg:max-w-[90rem]">
        <Reveal>
          <h2
            id="top-subjects-heading"
            className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
          >
            Popular Wyoming courses this term
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            By section count in{" "}
            <span className="text-foreground">{latestTerm.description}</span>.{" "}
            <AppLink
              href="/planner"
              prefetch
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Open the planner
            </AppLink>{" "}
            to build your UW schedule.
          </p>
        </Reveal>
        <Stagger as="ul" className="mt-8 flex flex-wrap gap-2" stagger={0.04}>
          {ranked.map((s) => (
            <StaggerChipItem key={s.subject}>
              <AppLink
                href={`/courses/${encodeURIComponent(subjectToPathSegment(s.subject))}`}
                className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-mono font-medium text-primary shadow-sm transition hover:bg-muted/40"
              >
                {s.subject}
                <span className="ml-2 text-xs font-sans font-normal text-muted-foreground">
                  {s.sectionCount}
                </span>
              </AppLink>
            </StaggerChipItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
