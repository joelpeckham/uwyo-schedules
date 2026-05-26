import Link from "next/link";
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
          <h2
            id="top-subjects-heading"
            className="font-heading text-2xl font-medium text-foreground"
          >
            Popular subjects
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            No term data yet. After ingest, the busiest subjects for the latest
            term will appear here.
          </p>
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
        <h2
          id="top-subjects-heading"
          className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl"
        >
          Popular subjects this term
        </h2>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">
          By section count in{" "}
          <span className="text-foreground">{latestTerm.description}</span>.{" "}
          <Link
            href="/planner"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Open the planner
          </Link>{" "}
          to build your week.
        </p>
        <ul className="mt-8 flex flex-wrap gap-2">
          {ranked.map((s) => (
            <li key={s.subject}>
              <Link
                href={`/courses/${encodeURIComponent(subjectToPathSegment(s.subject))}`}
                className="inline-flex items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-mono font-medium text-primary shadow-sm transition hover:bg-muted/40"
              >
                {s.subject}
                <span className="ml-2 text-xs font-sans font-normal text-muted-foreground">
                  {s.sectionCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
