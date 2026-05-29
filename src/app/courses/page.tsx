import type { Metadata } from "next";
import { AppLink } from "@/components/seo/AppLink";
import { absoluteUrl } from "@/lib/seo/site";
import {
  getLatestTermRowForSeo,
  listSubjectsForTermForSeo,
  subjectToPathSegment,
} from "@/lib/seo/queries";

export const metadata: Metadata = {
  title: "UW courses by subject",
  description:
    "Browse University of Wyoming subjects for the latest term. Open a subject to see courses and section counts.",
  alternates: { canonical: "/courses" },
  openGraph: {
    url: absoluteUrl("/courses"),
    title: "UW courses by subject · uwyoschedule",
  },
};

export default async function CoursesIndexPage() {
  const termRow = await getLatestTermRowForSeo();
  if (!termRow) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 className="font-heading text-3xl font-medium text-foreground">
          Courses by subject
        </h1>
        <p className="mt-4 text-muted-foreground">
          No terms in the database yet. Run an ingest job, then reload this
          page.
        </p>
      </div>
    );
  }

  const subjects = await listSubjectsForTermForSeo(termRow.code);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:max-w-[90rem]">
      <h1 className="font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
        Courses by subject
      </h1>
      <p className="mt-3 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
        Subjects for {termRow.description}. Pick a subject to browse course numbers
        and titles from the UW course catalog.
      </p>
      <ul className="mt-8 columns-1 gap-3 sm:columns-2 lg:columns-3">
        {subjects.map((s) => (
          <li
            key={s.subject}
            className="mb-2 break-inside-avoid rounded-md border border-border bg-card px-3 py-2 shadow-sm"
          >
            <AppLink
              href={`/courses/${encodeURIComponent(subjectToPathSegment(s.subject))}`}
              className="font-mono text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {s.subject}
            </AppLink>
            <span className="ml-2 text-xs text-muted-foreground">
              {s.sectionCount} sections
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
