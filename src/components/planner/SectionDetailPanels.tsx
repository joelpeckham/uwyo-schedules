"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import {
  asRecord,
  asRecordArray,
  booleanField,
  formatBannerTimeRange,
  formatMeetingDays,
  numberField,
  stringField,
} from "@/lib/planner/section-detail-view";
import { cn } from "@/lib/utils";

type Props = {
  root: Record<string, unknown>;
};

type DlItem = {
  label: string;
  value: string | number | boolean | null | undefined;
};

function DefinitionList({ items }: { items: DlItem[] }) {
  const rows = items.filter(
    (i) =>
      i.value !== undefined &&
      i.value !== null &&
      !(typeof i.value === "string" && i.value.trim() === ""),
  );
  if (rows.length === 0) return null;
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,9rem)_1fr]">
      {rows.map(({ label, value }, idx) => (
        <div key={`${label}-${idx}`} className="contents">
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="font-mono text-xs text-foreground wrap-break-word sm:text-sm">
            {typeof value === "boolean" ? (value ? "Yes" : "No") : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function ExpandDetails({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <details className="group mt-3 border-t border-border/60 pt-2">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-2 rounded-md py-1.5 text-xs font-medium text-primary outline-none hover:bg-muted/50",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <span>{label}</span>
        <ChevronDown className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="mt-2 space-y-2 pb-1">{children}</div>
    </details>
  );
}

function BentoCard({
  accentClass,
  kicker,
  headline,
  subline,
  className,
  children,
}: {
  accentClass: string;
  kicker: string;
  headline: ReactNode;
  subline?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl border border-border bg-card p-4 shadow-sm ring-1 ring-foreground/5",
        "bg-linear-to-br from-card to-muted/25",
        accentClass,
        className,
      )}
    >
      <p className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground uppercase">
        {kicker}
      </p>
      <div className="mt-2 min-w-0 text-balance">{headline}</div>
      {subline ? (
        <div className="mt-1.5 text-sm leading-snug text-muted-foreground">
          {subline}
        </div>
      ) : null}
      {children}
    </article>
  );
}

export function SectionDetailPanels({ root }: Props) {
  const subject = stringField(root, "subject");
  const courseNum = stringField(root, "courseNumber");
  const seq = stringField(root, "sequenceNumber");
  const subjectCourse = stringField(root, "subjectCourse");
  const crn = stringField(root, "courseReferenceNumber");
  const courseTitle = stringField(root, "courseTitle");
  const scheduleType = stringField(root, "scheduleTypeDescription");
  const campus = stringField(root, "campusDescription");
  const partTerm = stringField(root, "partOfTerm");
  const term =
    stringField(root, "termDesc") ?? stringField(root, "term");

  const creditHours = numberField(root, "creditHours");
  const creditStr =
    creditHours != null
      ? String(creditHours)
      : stringField(root, "creditHours");

  const creditLow = numberField(root, "creditHourLow");
  const creditHigh = numberField(root, "creditHourHigh");
  const creditInd = stringField(root, "creditHourIndicator");
  const creditRangeLabel = (() => {
    if (creditLow == null && creditHigh == null) return undefined;
    if (creditLow != null && creditHigh != null && creditLow !== creditHigh)
      return `${creditLow}–${creditHigh}`;
    if (creditLow != null) return String(creditLow);
    if (creditHigh != null) return String(creditHigh);
    return undefined;
  })();

  const creditExpandItems: DlItem[] = [
    { label: "Credit hours", value: creditStr },
    { label: "Credit range", value: creditRangeLabel },
    { label: "Credit indicator", value: creditInd },
  ];

  const enrollment = numberField(root, "enrollment");
  const maxEnr = numberField(root, "maximumEnrollment");
  const seatsOpen = numberField(root, "seatsAvailable");
  const waitCap = numberField(root, "waitCapacity");
  const waitCt = numberField(root, "waitCount");
  const waitAvail = numberField(root, "waitAvailable");

  const enrollmentDetail: DlItem[] = [
    { label: "Enrollment", value: enrollment },
    { label: "Maximum enrollment", value: maxEnr },
    { label: "Seats available", value: seatsOpen },
    { label: "Wait capacity", value: waitCap },
    { label: "Wait count", value: waitCt },
    { label: "Wait seats available", value: waitAvail },
  ];

  const facultyRows = asRecordArray(root.faculty).map((f, i) => ({
    key: stringField(f, "bannerId") ?? String(i),
    name: stringField(f, "displayName"),
    email: stringField(f, "emailAddress"),
    primary: booleanField(f, "primaryIndicator"),
  }));
  const facultyFiltered = facultyRows.filter((f) => f.name || f.email);
  const primaryFac =
    facultyFiltered.find((f) => f.primary) ?? facultyFiltered[0];

  const meetingBlocks = asRecordArray(root.meetingsFaculty).map((m, i) => {
    const mt = asRecord(m.meetingTime);
    const days = formatMeetingDays(mt ?? undefined);
    const time =
      mt &&
      formatBannerTimeRange(
        stringField(mt, "beginTime"),
        stringField(mt, "endTime"),
      );
    const place = [
      stringField(mt ?? {}, "buildingDescription") ??
        stringField(mt ?? {}, "building"),
      stringField(mt ?? {}, "room"),
    ]
      .filter(Boolean)
      .join(" ");
    const dates = (() => {
      const a = mt ? stringField(mt, "startDate") : undefined;
      const b = mt ? stringField(mt, "endDate") : undefined;
      if (a && b) return `${a} – ${b}`;
      return a ?? b;
    })();
    const type =
      stringField(mt ?? {}, "meetingTypeDescription") ??
      stringField(mt ?? {}, "meetingType");
    const scheduleCode = stringField(mt ?? {}, "meetingScheduleType");
    return {
      key: `meeting-${i}`,
      days,
      time,
      place: place || undefined,
      dates,
      type,
      scheduleCode,
    };
  });
  const meetingShown = meetingBlocks.filter(
    (m) => m.days || m.time || m.place || m.dates,
  );
  const firstMeeting = meetingShown[0];
  const moreMeetings = meetingShown.length - 1;

  const attrRows = asRecordArray(root.sectionAttributes).map((a, i) => ({
    key: stringField(a, "code") ?? String(i),
    code: stringField(a, "code"),
    description: stringField(a, "description"),
    ztc: booleanField(a, "isZTCAttribute"),
  }));
  const attrsFiltered = attrRows.filter((a) => a.code || a.description);

  const status = asRecord(root.status);
  const statusItems: DlItem[] = status
    ? [
        { label: "Section open", value: booleanField(status, "sectionOpen") },
        { label: "Selectable", value: booleanField(status, "select") },
        { label: "Restricted", value: booleanField(status, "restricted") },
        {
          label: "Time conflict",
          value: booleanField(status, "timeConflict"),
        },
        {
          label: "Section status",
          value: booleanField(status, "sectionStatus"),
        },
      ]
    : [];
  const hasStatus = statusItems.some(
    (x) => x.value !== undefined && x.value !== null,
  );

  const overviewExtras: DlItem[] = [
    { label: "Sequence", value: seq },
    { label: "Part of term", value: partTerm },
    { label: "Term", value: term },
    { label: "Linked section", value: booleanField(root, "isSectionLinked") },
    { label: "Link group", value: stringField(root, "linkIdentifier") },
    { label: "Open section", value: booleanField(root, "openSection") },
  ];

  const courseLine =
    subjectCourse ??
    ([subject, courseNum].filter(Boolean).join(" ") || undefined);

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Hero */}
      <BentoCard
        accentClass="border-l-4 border-l-primary"
        kicker={scheduleType ?? "Section"}
        headline={
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {courseTitle ?? "Untitled section"}
          </h2>
        }
        subline={
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono text-sm text-muted-foreground">
            {courseLine ? (
              <span className="text-base font-medium text-foreground">
                {courseLine}
              </span>
            ) : null}
            {crn ? <span>CRN {crn}</span> : null}
            {campus ? <span>{campus}</span> : null}
          </div>
        }
      >
        {overviewExtras.some(
          (x) =>
            x.value !== undefined &&
            x.value !== null &&
            !(typeof x.value === "string" && x.value.trim() === ""),
        ) ? (
          <ExpandDetails label="Course and term details">
            <DefinitionList items={overviewExtras} />
          </ExpandDetails>
        ) : null}
      </BentoCard>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 sm:gap-4">
        {/* Credits */}
        <BentoCard
          accentClass="border-l-4 border-l-[#8b6914]"
          kicker="Credits"
          headline={
            <span className="font-heading text-4xl font-semibold tabular-nums tracking-tight text-foreground sm:text-5xl">
              {creditStr ?? "—"}
            </span>
          }
          subline={
            creditInd ? (
              <span className="font-mono text-xs text-muted-foreground">
                {creditInd}
              </span>
            ) : creditRangeLabel ? (
              <span className="font-mono text-xs text-muted-foreground">
                {creditRangeLabel}
              </span>
            ) : null
          }
        >
          {(() => {
            const rows = creditExpandItems.filter(
              (i) =>
                i.value !== undefined &&
                i.value !== null &&
                !(typeof i.value === "string" && i.value.trim() === ""),
            );
            const show =
              rows.some((i) => i.label !== "Credit hours") || rows.length > 1;
            return show ? (
              <ExpandDetails label="All credit fields">
                <DefinitionList items={creditExpandItems} />
              </ExpandDetails>
            ) : null;
          })()}
        </BentoCard>

        {/* Enrollment */}
        <BentoCard
          accentClass="border-l-4 border-l-[#4a6b55]"
          kicker="Seats"
          headline={
            <div className="flex flex-wrap items-end gap-2">
              {seatsOpen != null ? (
                <span className="font-heading text-4xl font-semibold tabular-nums text-foreground sm:text-5xl">
                  {seatsOpen}
                </span>
              ) : enrollment != null && maxEnr != null ? (
                <span className="font-heading text-3xl font-semibold tabular-nums text-foreground sm:text-4xl">
                  {enrollment}
                  <span className="text-2xl font-normal text-muted-foreground">
                    {" "}
                    / {maxEnr}
                  </span>
                </span>
              ) : (
                <span className="font-heading text-3xl font-semibold text-muted-foreground">
                  —
                </span>
              )}
            </div>
          }
          subline={
            seatsOpen != null && maxEnr != null ? (
              <span>
                open of <span className="font-mono">{maxEnr}</span> seats
              </span>
            ) : maxEnr != null ? (
              <span>
                Capacity <span className="font-mono">{maxEnr}</span>
              </span>
            ) : null
          }
        >
          {enrollmentDetail.some(
            (i) => i.value !== undefined && i.value !== null,
          ) ? (
            <ExpandDetails label="Enrollment and waitlist">
              <DefinitionList items={enrollmentDetail} />
            </ExpandDetails>
          ) : null}
        </BentoCard>

        {/* Status — compact */}
        {hasStatus && status ? (
          <BentoCard
            accentClass="border-l-4 border-l-[#3d4f5f]"
            kicker="Registration"
            headline={
              <div className="flex flex-wrap gap-2">
                {booleanField(status, "sectionOpen") === true ? (
                  <span className="rounded-full bg-[#4a6b55]/15 px-2.5 py-0.5 font-mono text-xs font-medium text-[#2d4a3d] dark:text-[#a3c4ad]">
                    Open
                  </span>
                ) : booleanField(status, "sectionOpen") === false ? (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs font-medium">
                    Closed
                  </span>
                ) : null}
                {booleanField(status, "restricted") === true ? (
                  <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 font-mono text-xs font-medium text-destructive">
                    Restricted
                  </span>
                ) : null}
                {booleanField(status, "timeConflict") === true ? (
                  <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 font-mono text-xs font-medium text-destructive">
                    Time conflict
                  </span>
                ) : null}
              </div>
            }
          >
            <ExpandDetails label="All status flags">
              <DefinitionList items={statusItems} />
            </ExpandDetails>
          </BentoCard>
        ) : null}

        {/* Schedule — wide */}
        {firstMeeting ? (
          <BentoCard
            accentClass="border-l-4 border-l-[#5c4a6b] sm:col-span-2 lg:col-span-3"
            kicker="Schedule"
            headline={
              <p className="font-mono text-lg font-semibold leading-snug text-foreground sm:text-xl">
                {firstMeeting.days ?? "Days TBD"}
              </p>
            }
            subline={
              <div className="space-y-1">
                {firstMeeting.time ? (
                  <p className="font-mono text-base text-foreground">
                    {firstMeeting.time}
                  </p>
                ) : null}
                {firstMeeting.place ? (
                  <p className="text-sm text-muted-foreground">
                    {firstMeeting.place}
                  </p>
                ) : null}
                {firstMeeting.dates ? (
                  <p className="text-xs text-muted-foreground">
                    {firstMeeting.dates}
                  </p>
                ) : null}
                {moreMeetings > 0 ? (
                  <p className="text-xs font-medium text-primary">
                    +{moreMeetings} more meeting
                    {moreMeetings === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            }
            className="sm:col-span-2 lg:col-span-3"
          >
            {meetingShown.length > 1 ? (
              <ExpandDetails label="Every meeting time">
                <ul className="space-y-3">
                  {meetingShown.map((m) => (
                    <li
                      key={m.key}
                      className="rounded-lg border border-border/60 bg-background/60 px-3 py-2"
                    >
                      {m.days ? (
                        <p className="font-mono text-sm font-medium">{m.days}</p>
                      ) : null}
                      {m.time ? (
                        <p className="mt-0.5 font-mono text-sm">{m.time}</p>
                      ) : null}
                      {m.place ? (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {m.place}
                        </p>
                      ) : null}
                      {m.dates ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {m.dates}
                        </p>
                      ) : null}
                      {m.type || m.scheduleCode ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {[m.type, m.scheduleCode].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </ExpandDetails>
            ) : firstMeeting.type || firstMeeting.scheduleCode ? (
              <ExpandDetails label="Meeting type">
                <p className="text-sm text-muted-foreground">
                  {[firstMeeting.type, firstMeeting.scheduleCode]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </ExpandDetails>
            ) : null}
          </BentoCard>
        ) : null}

        {/* Faculty */}
        {primaryFac ? (
          <BentoCard
            accentClass="border-l-4 border-l-[#a65d3a]"
            kicker="Faculty"
            headline={
              <p className="font-heading text-lg font-semibold text-foreground">
                {primaryFac.name}
                {primaryFac.primary ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    Primary
                  </span>
                ) : null}
              </p>
            }
            subline={
              primaryFac.email ? (
                <p className="font-mono text-xs text-muted-foreground wrap-break-word">
                  {primaryFac.email}
                </p>
              ) : null
            }
            className="sm:col-span-2 lg:col-span-1"
          >
            {facultyFiltered.length > 1 ? (
              <ExpandDetails label="All instructors">
                <ul className="space-y-2">
                  {facultyFiltered.map((f) => (
                    <li
                      key={f.key}
                      className="rounded-md border border-border/50 px-2 py-1.5"
                    >
                      <p className="font-mono text-sm font-medium">
                        {f.name ?? "—"}
                        {f.primary ? (
                          <span className="ml-1 text-xs text-muted-foreground">
                            (Primary)
                          </span>
                        ) : null}
                      </p>
                      {f.email ? (
                        <p className="font-mono text-xs text-muted-foreground">
                          {f.email}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </ExpandDetails>
            ) : null}
          </BentoCard>
        ) : null}

        {/* Attributes */}
        {attrsFiltered.length > 0 ? (
          <BentoCard
            accentClass="border-l-4 border-l-muted-foreground sm:col-span-2 lg:col-span-2"
            kicker="Attributes"
            headline={
              <p className="font-heading text-2xl font-semibold tabular-nums text-foreground">
                {attrsFiltered.length}
              </p>
            }
            subline={
              <p className="text-sm text-muted-foreground">
                {attrsFiltered[0]?.code}
                {attrsFiltered[0]?.description
                  ? ` · ${attrsFiltered[0].description.slice(0, 80)}${attrsFiltered[0].description.length > 80 ? "…" : ""}`
                  : null}
              </p>
            }
            className="sm:col-span-2 lg:col-span-2"
          >
            <ExpandDetails label="Full attribute list">
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
                {attrsFiltered.map((a) => (
                  <li key={a.key} className="px-2 py-2">
                    <span className="font-mono text-sm font-medium">
                      {a.code}
                      {a.ztc ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          ZTC
                        </span>
                      ) : null}
                    </span>
                    {a.description ? (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {a.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </ExpandDetails>
          </BentoCard>
        ) : null}
      </div>
    </div>
  );
}
