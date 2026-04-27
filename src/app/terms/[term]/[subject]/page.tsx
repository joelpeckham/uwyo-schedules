import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createDb } from "@/db/index";
import { listTerms } from "@/lib/planner/data";
import { getTermDescriptionByCode } from "@/lib/terms/labels";
import { JsonLd } from "@/components/seo/JsonLd";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { absoluteUrl } from "@/lib/seo/site";
import {
  listCoursesForSubjectAndTermCached,
  pathSegmentToSubject,
  subjectToPathSegment,
} from "@/lib/seo/queries";

type Props = { params: Promise<{ term: string; subject: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { term, subject: seg } = await params;
  const subject = pathSegmentToSubject(seg);
  const canonical = `/terms/${encodeURIComponent(term)}/${encodeURIComponent(subjectToPathSegment(subject))}`;
  const label = (await getTermDescriptionByCode(term)) ?? term;
  return {
    title: `${subject} · ${label}`,
    description: `University of Wyoming ${subject} courses for ${label}.`,
    alternates: { canonical },
    openGraph: {
      url: absoluteUrl(canonical),
      title: `${subject} · ${label} · uwyoschedule`,
    },
  };
}

export default async function TermSubjectPage({ params }: Props) {
  const { term, subject: seg } = await params;
  const subject = pathSegmentToSubject(seg);
  const db = createDb();
  const terms = await listTerms(db);
  if (!terms.some((t) => t.code === term)) notFound();

  const courses = await listCoursesForSubjectAndTermCached(term, subject);
  if (courses.length === 0) notFound();

  const label = (await getTermDescriptionByCode(term)) ?? term;
  const canonicalPath = `/terms/${encodeURIComponent(term)}/${encodeURIComponent(subjectToPathSegment(subject))}`;
  const collectionJson = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${subject} courses — ${label}`,
    description: `University of Wyoming ${subject} courses for ${label}.`,
    url: absoluteUrl(canonicalPath),
    isPartOf: { "@type": "WebSite", name: "uwyoschedule", url: absoluteUrl("/") },
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:max-w-[90rem]">
      <JsonLd data={collectionJson} />
      <SeoBreadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Terms", href: "/terms" },
          { name: label, href: `/terms/${encodeURIComponent(term)}` },
          { name: subject, href: canonicalPath },
        ]}
      />
      <h1 className="mt-4 font-heading text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
        {subject} — {label}
      </h1>
      <p className="mt-3 max-w-prose text-sm text-muted-foreground sm:text-base">
        Evergreen course pages (all terms) live under{" "}
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href={`/courses/${encodeURIComponent(subjectToPathSegment(subject))}`}
        >
          /courses/{subjectToPathSegment(subject)}
        </Link>
        .
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
    </div>
  );
}
