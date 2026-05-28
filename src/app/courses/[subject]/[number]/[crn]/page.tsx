import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/JsonLd";
import { SeoBreadcrumbs } from "@/components/seo/SeoBreadcrumbs";
import { AddToPlannerCta } from "@/components/planner/AddToPlannerCta";
import { SectionDetailPanels } from "@/components/planner/SectionDetailPanels";
import {
  asRecord,
  asRecordArray,
  booleanField,
  formatBannerTimeRange,
  numberField,
  stringField,
} from "@/lib/planner/section-detail-view";
import {
  classifyDeliveryMode,
  deliveryModeDescription,
  deliveryModeLabel,
  type DeliveryMode,
} from "@/lib/sections/delivery-mode";
import { absoluteUrl } from "@/lib/seo/site";
import { uwyoOrganization } from "@/lib/seo/schema-org";
import {
  findTermForCrnForSeo,
  getSectionDetailForSeo,
  listTopCrnsForSeo,
  pathSegmentToSubject,
  subjectToPathSegment,
} from "@/lib/seo/queries";

type Props = {
  params: Promise<{ subject: string; number: string; crn: string }>;
};

const SCHEMA_DAY_BY_KEY: Record<string, string> = {
  monday: "https://schema.org/Monday",
  tuesday: "https://schema.org/Tuesday",
  wednesday: "https://schema.org/Wednesday",
  thursday: "https://schema.org/Thursday",
  friday: "https://schema.org/Friday",
  saturday: "https://schema.org/Saturday",
  sunday: "https://schema.org/Sunday",
};

const COURSE_MODE_BY_DELIVERY: Record<DeliveryMode, string> = {
  in_person: "onsite",
  online_async: "online",
  online_sync: "online",
  hybrid: "blended",
  tba: "onsite",
};

function bannerClockToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 3) return null;
  const padded =
    digits.length >= 4 ? digits.slice(0, 4) : digits.padStart(4, "0");
  const hh = padded.slice(0, 2);
  const mm = padded.slice(2, 4);
  const h = Number.parseInt(hh, 10);
  const m = Number.parseInt(mm, 10);
  if (Number.isNaN(h) || Number.isNaN(m) || h > 23 || m > 59) return null;
  return `${hh}:${mm}`;
}

function bannerDateToIso(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  // Banner usually returns "MM/DD/YYYY" for these dates.
  const us = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const [, mm, dd, yyyy] = us;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  return null;
}

export async function generateStaticParams() {
  const top = await listTopCrnsForSeo(200);
  return top.map((r) => ({
    subject: subjectToPathSegment(r.subject),
    number: r.courseNumber.toLowerCase(),
    crn: r.crn,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subject: seg, number, crn } = await params;
  const subject = pathSegmentToSubject(seg);
  const num = number.trim();
  const crnTrimmed = crn.trim();

  // The static-params list only contains the latest term. For the long
  // tail (older terms or new sections that show up between rebuilds) we
  // still render the page, so any term with a row for this CRN works.
  const detail = await loadSectionByCrn(crnTrimmed);
  if (!detail || detail.subject !== subject || detail.courseNumber !== num) {
    return { title: "Section not found", robots: { index: false, follow: false } };
  }
  const courseLabel = `${detail.subject} ${detail.courseNumber}`;
  const titlePart = detail.courseTitle ? ` — ${detail.courseTitle}` : "";
  const facultyPart = detail.facultyNames ? ` · ${detail.facultyNames}` : "";
  const canonical = `/courses/${subjectToPathSegment(detail.subject)}/${encodeURIComponent(detail.courseNumber.toLowerCase())}/${encodeURIComponent(detail.crn)}`;
  const description =
    `${courseLabel}${titlePart} · CRN ${detail.crn}${facultyPart}. Meeting times, seats, and delivery for ${detail.termDescription ?? "this term"} at the University of Wyoming.`;
  return {
    title: `${courseLabel} CRN ${detail.crn}${titlePart}`,
    description,
    alternates: { canonical },
    openGraph: {
      url: absoluteUrl(canonical),
      title: `${courseLabel} · CRN ${detail.crn} · uwyoschedule`,
      description: `${courseLabel}${titlePart}. ${detail.termDescription ?? ""}`.trim(),
    },
  };
}

async function loadSectionByCrn(crn: string) {
  const termCode = await findTermForCrnForSeo(crn);
  if (!termCode) return null;
  return getSectionDetailForSeo(termCode, crn);
}

export default async function CrnDetailPage({ params }: Props) {
  const { subject: seg, number, crn } = await params;
  const subject = pathSegmentToSubject(seg);
  const num = number.trim();
  const crnTrimmed = crn.trim();
  if (!crnTrimmed) notFound();

  const detail = await loadSectionByCrn(crnTrimmed);
  if (!detail) notFound();
  if (detail.subject !== subject || detail.courseNumber !== num) {
    notFound();
  }

  const root = detail.detailRoot;
  if (!root) notFound();

  const courseLabel =
    detail.subjectCourse ?? `${detail.subject} ${detail.courseNumber}`;
  const courseTitle = detail.courseTitle ?? courseLabel;
  const canonicalCoursePath = `/courses/${subjectToPathSegment(detail.subject)}/${encodeURIComponent(detail.courseNumber.toLowerCase())}`;
  const canonicalPath = `${canonicalCoursePath}/${encodeURIComponent(detail.crn)}`;
  const campus = stringField(root, "campusDescription");
  const instructionalMethod = stringField(root, "instructionalMethod");
  const instructionalMethodDescription = stringField(
    root,
    "instructionalMethodDescription",
  );

  const meetingBlocks = asRecordArray(root.meetingsFaculty)
    .map((m) => asRecord(m.meetingTime))
    .filter((m): m is Record<string, unknown> => m !== null);

  const hasTimedMeetings = meetingBlocks.some((m) => {
    if (!stringField(m, "beginTime") || !stringField(m, "endTime")) return false;
    return Object.keys(SCHEMA_DAY_BY_KEY).some((d) => booleanField(m, d) === true);
  });

  const deliveryMode = classifyDeliveryMode({
    instructionalMethod,
    instructionalMethodDescription,
    hasTimedMeetings,
  });
  const deliveryPill = deliveryModeLabel(deliveryMode);

  const facultyEntries = asRecordArray(root.faculty)
    .map((f) => ({
      name: stringField(f, "displayName"),
      email: stringField(f, "emailAddress"),
      primary: booleanField(f, "primaryIndicator") ?? false,
    }))
    .filter((f) => f.name);

  const courseSchedules = meetingBlocks
    .map((m) => {
      const beginIso = bannerClockToIso(stringField(m, "beginTime"));
      const endIso = bannerClockToIso(stringField(m, "endTime"));
      const startDate = bannerDateToIso(stringField(m, "startDate"));
      const endDate = bannerDateToIso(stringField(m, "endDate"));
      const byDay = (Object.keys(SCHEMA_DAY_BY_KEY) as (keyof typeof SCHEMA_DAY_BY_KEY)[])
        .filter((d) => booleanField(m, d) === true)
        .map((d) => SCHEMA_DAY_BY_KEY[d]);
      if (byDay.length === 0 && !beginIso && !endIso) return null;
      const schedule: Record<string, unknown> = {
        "@type": "Schedule",
        repeatFrequency: "P1W",
      };
      if (byDay.length > 0) schedule.byDay = byDay;
      if (beginIso) schedule.startTime = beginIso;
      if (endIso) schedule.endTime = endIso;
      if (startDate) schedule.startDate = startDate;
      if (endDate) schedule.endDate = endDate;
      return schedule;
    })
    .filter((s): s is Record<string, unknown> => s !== null);

  const locations = meetingBlocks
    .map((m) => {
      const building =
        stringField(m, "buildingDescription") ?? stringField(m, "building");
      const room = stringField(m, "room");
      if (!building && !room) return null;
      const name = [building, room].filter(Boolean).join(" ");
      return {
        "@type": "Place" as const,
        name,
      };
    })
    .filter((l): l is { "@type": "Place"; name: string } => l !== null);

  const seenLocations = new Set<string>();
  const uniqueLocations = locations.filter((l) => {
    if (seenLocations.has(l.name)) return false;
    seenLocations.add(l.name);
    return true;
  });

  const courseInstance: Record<string, unknown> = {
    "@type": "CourseInstance",
    courseMode: COURSE_MODE_BY_DELIVERY[deliveryMode],
    name: `${courseLabel} CRN ${detail.crn}`,
    identifier: detail.crn,
    description: `${detail.termDescription ?? "Term"} · ${detail.scheduleTypeDescription ?? courseLabel} · ${deliveryModeDescription(deliveryMode)}`,
  };
  if (detail.termDescription) {
    courseInstance.courseSchedule =
      courseSchedules.length === 1
        ? courseSchedules[0]
        : courseSchedules.length > 1
          ? courseSchedules
          : undefined;
    courseInstance.timeRequired = detail.scheduleTypeDescription ?? undefined;
  }
  if (uniqueLocations.length > 0) {
    courseInstance.location =
      uniqueLocations.length === 1 ? uniqueLocations[0] : uniqueLocations;
  }
  if (facultyEntries.length > 0) {
    courseInstance.instructor = facultyEntries.map((f) => ({
      "@type": "Person",
      name: f.name,
      ...(f.email ? { email: f.email } : {}),
    }));
  }

  const enrollment = numberField(root, "enrollment");
  const maximumEnrollment = numberField(root, "maximumEnrollment");
  if (maximumEnrollment != null) {
    courseInstance.maximumAttendeeCapacity = maximumEnrollment;
  }
  if (enrollment != null) courseInstance.attendeeCount = enrollment;

  const courseJson = {
    "@context": "https://schema.org",
    "@type": "Course",
    name: `${courseLabel} — ${courseTitle}`,
    courseCode: courseLabel,
    description: `${courseLabel}${detail.courseTitle ? ` (${detail.courseTitle})` : ""} CRN ${detail.crn} at the University of Wyoming.`,
    provider: uwyoOrganization,
    url: absoluteUrl(canonicalPath),
    hasCourseInstance: courseInstance,
  };

  const firstMeeting = meetingBlocks[0];
  const heroDays = firstMeeting
    ? (Object.keys(SCHEMA_DAY_BY_KEY) as (keyof typeof SCHEMA_DAY_BY_KEY)[])
        .filter((d) => booleanField(firstMeeting, d) === true)
        .map((d) => d.charAt(0).toUpperCase() + d.slice(1, 3))
        .join(" ")
    : "";
  const heroTimeRange = firstMeeting
    ? formatBannerTimeRange(
        stringField(firstMeeting, "beginTime"),
        stringField(firstMeeting, "endTime"),
      )
    : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:max-w-360">
      <JsonLd data={courseJson} />
      <SeoBreadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Courses", href: "/courses" },
          {
            name: detail.subject,
            href: `/courses/${subjectToPathSegment(detail.subject)}`,
          },
          {
            name: `${detail.subject} ${detail.courseNumber}`,
            href: canonicalCoursePath,
          },
          { name: `CRN ${detail.crn}`, href: canonicalPath },
        ]}
      />
      <header className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {detail.termDescription ?? "Section"}
          </p>
          <h1 className="max-w-4xl font-heading text-balance text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            {courseLabel} CRN {detail.crn}
            {detail.courseTitle ? (
              <span className="block text-2xl font-normal text-muted-foreground sm:text-3xl">
                {detail.courseTitle}
              </span>
            ) : null}
          </h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground sm:text-base">
            {detail.scheduleTypeDescription ? (
              <span>{detail.scheduleTypeDescription}</span>
            ) : null}
            {campus ? <span>{campus}</span> : null}
            {detail.facultyNames ? <span>{detail.facultyNames}</span> : null}
            {deliveryPill ? (
              <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-foreground">
                {deliveryPill}
              </span>
            ) : null}
            {heroDays && heroTimeRange ? (
              <span className="font-mono">
                {heroDays} {heroTimeRange}
              </span>
            ) : null}
          </p>
        </div>
        <AddToPlannerCta
          termCode={detail.termCode}
          subject={detail.subject}
          courseNumber={detail.courseNumber}
          courseLabel={courseLabel}
          crn={detail.crn}
          scheduleTypeDescription={detail.scheduleTypeDescription}
        />
      </header>

      <p className="mt-4 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
        Section data from the UW course catalog via uwyoschedule. Confirm seats
        and meeting times in WyoWeb before you register.
      </p>

      <div className="mt-8">
        <SectionDetailPanels root={root} />
      </div>

      <p className="mt-10 text-sm text-muted-foreground">
        See every section of {courseLabel}?{" "}
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href={canonicalCoursePath}
        >
          Open the course page
        </Link>
        . Want to plan a full week?{" "}
        <Link
          className="text-primary underline-offset-4 hover:underline"
          href="/planner"
        >
          Open the planner
        </Link>
        .
      </p>
    </div>
  );
}
