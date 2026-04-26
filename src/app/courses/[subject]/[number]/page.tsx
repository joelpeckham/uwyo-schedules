import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createDb } from "@/db/index";
import { getLatestTermCode } from "@/lib/planner/data";
import { JsonLd } from "@/components/seo/JsonLd";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { absoluteUrl } from "@/lib/seo/site";
import {
  getCourseSeoDetailCached,
  listSectionTableRowsForCourseTermCached,
  pathSegmentToSubject,
  subjectToPathSegment,
} from "@/lib/seo/queries";
import { uwyoOrganization } from "@/lib/seo/schema-org";

type Props = { params: Promise<{ subject: string; number: string }> };

export async function generateStaticParams() {
  const { createDb } = await import("@/db/index");
  const { listTopCourseKeysBySectionCount, subjectToPathSegment } =
    await import("@/lib/seo/queries");
  const db = createDb();
  const rows = await listTopCourseKeysBySectionCount(db, 200);
  return rows.map((r) => ({
    subject: subjectToPathSegment(r.subject),
    number: r.courseNumber.toLowerCase(),
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subject: seg, number } = await params;
  const subject = pathSegmentToSubject(seg);
  const num = number.trim();
  const detail = await getCourseSeoDetailCached(subject, num);
  if (!detail) {
    return { title: "Course not found" };
  }
  const title = detail.title ?? `${detail.subject} ${detail.courseNumber}`;
  const canonical = `/courses/${subjectToPathSegment(detail.subject)}/${encodeURIComponent(detail.courseNumber.toLowerCase())}`;
  const latestTerm = detail.terms[0];
  const sectionHint = latestTerm
    ? `${latestTerm.sectionCount} section(s) in ${latestTerm.termDescription} (${latestTerm.termCode}).`
    : "";
  return {
    title: `${detail.subject} ${detail.courseNumber} — ${title}`,
    description: `University of Wyoming ${detail.subject} ${detail.courseNumber}: ${title}. ${sectionHint}`.trim(),
    alternates: { canonical },
    openGraph: {
      url: absoluteUrl(canonical),
      title: `${detail.subject} ${detail.courseNumber} · uwyoschedule`,
      description: title,
    },
  };
}

export default async function CourseDetailPage({ params }: Props) {
  const { subject: seg, number } = await params;
  const subject = pathSegmentToSubject(seg);
  const num = number.trim();
  const detail = await getCourseSeoDetailCached(subject, num);
  if (!detail) notFound();

  const db = createDb();
  const latest = await getLatestTermCode(db);
  const primaryTerm = detail.terms[0]?.termCode ?? latest;
  if (!primaryTerm) notFound();

  const sectionRows =
    (await listSectionTableRowsForCourseTermCached(
      primaryTerm,
      detail.subject,
      detail.courseNumber,
    )) ?? [];

  const displayTitle =
    detail.title ?? `${detail.subject} ${detail.courseNumber}`;
  const canonicalPath = `/courses/${subjectToPathSegment(detail.subject)}/${encodeURIComponent(detail.courseNumber.toLowerCase())}`;

  const courseJson = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `${detail.subject} ${detail.courseNumber} — ${displayTitle}`,
    description: `University of Wyoming course ${detail.subject} ${detail.courseNumber}: ${displayTitle}.`,
    provider: uwyoOrganization,
    courseCode: `${detail.subject} ${detail.courseNumber}`,
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:max-w-[90rem]">
      <JsonLd data={courseJson} />
      <SeoBreadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Courses", href: "/courses" },
          {
            name: detail.subject,
            href: `/courses/${subjectToPathSegment(detail.subject)}`,
          },
          { name: `${detail.subject} ${detail.courseNumber}`, href: canonicalPath },
        ]}
      />
      <h1 className="mt-4 max-w-4xl font-heading text-balance text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
        {detail.subject} {detail.courseNumber} — {displayTitle} at the
        University of Wyoming
      </h1>
      <p className="mt-4 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
        Catalog data from UW Banner via uwyoschedule. Seat counts and meeting
        times can change; confirm in Banner before you register.
      </p>

      <section className="mt-10" aria-labelledby="sections-latest">
        <h2
          id="sections-latest"
          className="font-heading text-xl font-medium text-foreground"
        >
          Sections ({primaryTerm})
        </h2>
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[48rem] border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-muted/40 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs">
              <tr>
                <th className="px-3 py-2">CRN</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Faculty</th>
                <th className="px-3 py-2">Meeting</th>
                <th className="px-3 py-2 text-right">Seats</th>
              </tr>
            </thead>
            <tbody>
              {sectionRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-muted-foreground"
                  >
                    No section rows for this term in our database yet.
                  </td>
                </tr>
              ) : (
                sectionRows.map((row) => (
                  <tr key={row.crn} className="border-t border-border">
                    <td className="px-3 py-2 font-mono">{row.crn}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.scheduleTypeDescription ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.facultyNames ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.meetingSummary ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {row.seatsAvailable ?? "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {detail.terms.length > 1 ? (
        <details className="mt-10 rounded-lg border border-border bg-card p-4">
          <summary className="cursor-pointer font-medium text-foreground">
            Past terms ({detail.terms.length - 1} more)
          </summary>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            {detail.terms.slice(1).map((t) => (
              <li key={t.termCode}>
                <Link
                  className="font-mono text-primary underline-offset-4 hover:underline"
                  href={`/terms/${encodeURIComponent(t.termCode)}/${encodeURIComponent(subjectToPathSegment(detail.subject))}`}
                >
                  {t.termCode}
                </Link>
                <span className="ml-2">
                  — {t.termDescription} · {t.sectionCount} section(s)
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="mt-10 text-sm text-muted-foreground">
        Prefer the planner?{" "}
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href="/planner"
        >
          Open the planner
        </Link>
        .
      </p>
    </main>
  );
}
