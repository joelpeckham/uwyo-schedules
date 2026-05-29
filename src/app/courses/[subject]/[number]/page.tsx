import type { Metadata } from "next";
import { AppLink } from "@/components/seo/AppLink";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { AddToPlannerCta } from "@/components/planner/AddToPlannerCta";
import { absoluteUrl } from "@/lib/seo/site";
import {
  getCourseSeoDetailForSeo,
  getLatestTermCodeForSeo,
  listSectionTableRowsForCourseTermForSeo,
  pathSegmentToSubject,
  subjectToPathSegment,
} from "@/lib/seo/queries";
import { uwyoOrganization } from "@/lib/seo/schema-org";
import {
  classifyDeliveryMode,
  deliveryModeLabel,
} from "@/lib/sections/delivery-mode";

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
  const detail = await getCourseSeoDetailForSeo(subject, num);
  if (!detail) {
    return {
      title: "Course not found",
      robots: { index: false, follow: false },
    };
  }
  const title = detail.title ?? `${detail.subject} ${detail.courseNumber}`;
  const canonical = `/courses/${subjectToPathSegment(detail.subject)}/${encodeURIComponent(detail.courseNumber.toLowerCase())}`;
  const latestTerm = detail.terms[0];
  const sectionHint = latestTerm
    ? `${latestTerm.sectionCount} section(s) in ${latestTerm.termDescription}.`
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
  const detail = await getCourseSeoDetailForSeo(subject, num);
  if (!detail) notFound();

  const latest = await getLatestTermCodeForSeo();
  const primaryTerm = detail.terms[0]?.termCode ?? latest;
  if (!primaryTerm) notFound();

  const sectionRows =
    (await listSectionTableRowsForCourseTermForSeo(
      primaryTerm,
      detail.subject,
      detail.courseNumber,
    )) ?? [];

  const displayTitle =
    detail.title ?? `${detail.subject} ${detail.courseNumber}`;
  const primaryTermName = detail.terms[0]?.termDescription;
  const canonicalPath = `/courses/${subjectToPathSegment(detail.subject)}/${encodeURIComponent(detail.courseNumber.toLowerCase())}`;

  const courseJson = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `${detail.subject} ${detail.courseNumber} — ${displayTitle}`,
    description: `University of Wyoming course ${detail.subject} ${detail.courseNumber}: ${displayTitle}.`,
    provider: uwyoOrganization,
    courseCode: `${detail.subject} ${detail.courseNumber}`,
  };

  const courseLabel = `${detail.subject} ${detail.courseNumber}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:max-w-[90rem]">
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
      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="max-w-4xl font-heading text-balance text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
          {detail.subject} {detail.courseNumber} — {displayTitle} at the
          University of Wyoming
        </h1>
        <AddToPlannerCta
          termCode={primaryTerm}
          subject={detail.subject}
          courseNumber={detail.courseNumber}
          courseLabel={courseLabel}
        />
      </div>
      <p className="mt-4 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
        Catalog data from the UW course catalog via uwyoschedule. Seat counts and meeting
        times can change; confirm in the UW course catalog before you register.
      </p>

      <section className="mt-10" aria-labelledby="sections-latest">
        <h2
          id="sections-latest"
          className="font-heading text-xl font-medium text-foreground"
        >
          {primaryTermName
            ? `Sections — ${primaryTermName}`
            : "Sections"}
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
                sectionRows.map((row) => {
                  const mode = classifyDeliveryMode({
                    instructionalMethod: row.instructionalMethod,
                    instructionalMethodDescription:
                      row.instructionalMethodDescription,
                    hasTimedMeetings: row.hasTimedMeetings,
                  });
                  const pill = deliveryModeLabel(mode);
                  const crnHref = `${canonicalPath}/${encodeURIComponent(row.crn)}`;
                  return (
                    <tr key={row.crn} className="border-t border-border">
                      <td className="px-3 py-2 font-mono">
                        <AppLink
                          href={crnHref}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          {row.crn}
                        </AppLink>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        <div className="flex flex-wrap items-center gap-2">
                          <span>{row.scheduleTypeDescription ?? "—"}</span>
                          {pill ? (
                            <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[0.65rem] font-medium not-italic text-foreground sm:text-xs">
                              {pill}
                            </span>
                          ) : null}
                        </div>
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
                  );
                })
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
                <AppLink
                  className="text-primary underline-offset-4 hover:underline"
                  href={`/terms/${encodeURIComponent(t.termCode)}/${encodeURIComponent(subjectToPathSegment(detail.subject))}`}
                >
                  {t.termDescription}
                </AppLink>
                <span className="ml-2">· {t.sectionCount} section(s)</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      <p className="mt-10 text-sm text-muted-foreground">
        Prefer the planner?{" "}
        <AppLink
          className="text-primary underline-offset-4 hover:underline"
          href="/planner"
        >
          Open the planner
        </AppLink>
        .
      </p>
    </div>
  );
}
