import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createDb } from "@/db/index";
import { getLatestTermCode } from "@/lib/planner/data";
import { JsonLd } from "@/components/seo/JsonLd";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { absoluteUrl } from "@/lib/seo/site";
import {
  listCoursesForSubjectAndTermCached,
  pathSegmentToSubject,
  subjectToPathSegment,
} from "@/lib/seo/queries";

type Props = { params: Promise<{ subject: string }> };

export async function generateStaticParams() {
  const { createDb } = await import("@/db/index");
  const { getLatestTermCode } = await import("@/lib/planner/data");
  const { listSubjectsForTerm } = await import("@/lib/seo/queries");
  const db = createDb();
  const latest = await getLatestTermCode(db);
  if (!latest) return [];
  const subjects = await listSubjectsForTerm(db, latest);
  return subjects.map((s) => ({
    subject: subjectToPathSegment(s.subject),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subject: seg } = await params;
  const code = pathSegmentToSubject(seg);
  const canonical = `/courses/${subjectToPathSegment(code)}`;
  return {
    title: `${code} courses`,
    description: `University of Wyoming ${code} courses for the latest term — titles, numbers, and section counts.`,
    alternates: { canonical },
    openGraph: {
      url: absoluteUrl(canonical),
      title: `${code} courses · uwyoschedule`,
    },
  };
}

export default async function SubjectCoursesPage({ params }: Props) {
  const { subject: seg } = await params;
  const subject = pathSegmentToSubject(seg);
  const db = createDb();
  const latest = await getLatestTermCode(db);
  if (!latest) notFound();

  const courses = await listCoursesForSubjectAndTermCached(latest, subject);
  if (courses.length === 0) notFound();

  const canonicalPath = `/courses/${subjectToPathSegment(subject)}`;
  const collectionJson = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${subject} courses at the University of Wyoming`,
    description: `Browse ${subject} courses from the UW course catalog (term ${latest}).`,
    url: absoluteUrl(canonicalPath),
    isPartOf: { "@type": "WebSite", name: "uwyoschedule", url: absoluteUrl("/") },
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:max-w-[90rem]">
      <JsonLd data={collectionJson} />
      <SeoBreadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Courses", href: "/courses" },
          { name: subject, href: canonicalPath },
        ]}
      />
      <h1 className="mt-4 font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
        {subject} courses
      </h1>
      <p className="mt-3 max-w-prose text-pretty text-sm text-muted-foreground sm:text-base">
        Term <span className="font-mono text-foreground">{latest}</span>.
        Open a course for section-level meeting times and instructors.
      </p>
      <div className="mt-8 overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
          <thead className="bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3 text-right">Sections</th>
            </tr>
          </thead>
          <tbody>
            {courses.map((c) => (
              <tr key={c.courseNumber} className="border-t border-border">
                <td className="px-4 py-3 font-mono font-medium">
                  <Link
                    className="text-primary underline-offset-4 hover:underline"
                    href={`/courses/${encodeURIComponent(subjectToPathSegment(subject))}/${encodeURIComponent(c.courseNumber.toLowerCase())}`}
                  >
                    {c.subject} {c.courseNumber}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {c.title ?? "—"}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                  {c.sectionCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
