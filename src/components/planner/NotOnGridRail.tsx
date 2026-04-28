"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { buildMembersByBundleId } from "@/lib/planner/client/derive";
import { resolveDisplayCrnsWithMemberMap } from "@/lib/planner/resolve-display-crns-shared";
import {
  classifyDeliveryMode,
  deliveryModeLabel,
  meetingHasTimeBlock,
} from "@/lib/sections/delivery-mode";
import { usePlanner } from "./PlannerContext";

/** When 4 or more rows are off-grid, the rail collapses by default. */
const COLLAPSE_THRESHOLD = 4;

type RailRow = {
  key: string;
  crn: string;
  courseLabel: string;
  scheduleType: string | null;
  pill: string | null;
  instructor: string | null;
};

type Props = {
  onCrnActivate: (crn: string) => void;
};

/**
 * Sections that the student picked but that contribute zero blocks to the
 * weekly grid (online/asynchronous, or meetings still listed as TBA in
 * Banner). Rendered under the calendar so these sections do not silently
 * disappear after a solve. Click a row to open the same section detail
 * modal the calendar uses.
 */
export function NotOnGridRail({ onCrnActivate }: Props) {
  const { effectivePlannerItems, catalog } = usePlanner();

  const rows = useMemo<RailRow[]>(() => {
    if (effectivePlannerItems.length === 0) return [];
    const membersByBundleId = buildMembersByBundleId(
      catalog.linkedBundleMembers,
    );

    const meetingsByCrn = new Map<string, typeof catalog.meetings>();
    for (const m of catalog.meetings) {
      const list = meetingsByCrn.get(m.sectionCrn) ?? [];
      list.push(m);
      meetingsByCrn.set(m.sectionCrn, list);
    }

    const sectionByCrn = new Map<
      string,
      (typeof catalog.sections)[number]
    >();
    for (const s of catalog.sections) sectionByCrn.set(s.crn, s);

    const out: RailRow[] = [];
    const seen = new Set<string>();

    for (const item of effectivePlannerItems) {
      const crns = resolveDisplayCrnsWithMemberMap(
        {
          selectionKind: item.selectionKind,
          anchorCrn: item.anchorCrn,
          linkedBundleId: item.linkedBundleId,
        },
        membersByBundleId,
      );
      for (const crn of crns) {
        if (seen.has(crn)) continue;
        const section = sectionByCrn.get(crn);
        if (!section) continue;
        const meetings = meetingsByCrn.get(crn) ?? [];
        const hasTimedMeetings = meetings.some((m) => meetingHasTimeBlock(m));
        if (hasTimedMeetings) continue;
        const mode = classifyDeliveryMode({
          instructionalMethod: section.instructionalMethod,
          instructionalMethodDescription:
            section.instructionalMethodDescription,
          hasTimedMeetings: false,
        });
        const courseLabel = `${item.subject} ${item.courseNumber}`;
        const instructor = catalog.facultyByCrn[crn]?.trim() || null;
        seen.add(crn);
        out.push({
          key: `${item.id}-${crn}`,
          crn,
          courseLabel,
          scheduleType: section.scheduleTypeDescription,
          pill: deliveryModeLabel(mode),
          instructor,
        });
      }
    }

    return out;
  }, [effectivePlannerItems, catalog]);

  const collapsible = rows.length >= COLLAPSE_THRESHOLD;
  const [open, setOpen] = useState(!collapsible);

  if (rows.length === 0) return null;

  const headingId = "not-on-grid-heading";
  const sectionListId = "not-on-grid-list";
  const countLabel =
    rows.length === 1
      ? "1 section without a weekly time"
      : `${rows.length} sections without a weekly time`;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        {collapsible ? (
          <button
            type="button"
            className="-m-1 inline-flex min-w-0 items-center gap-1 rounded-md p-1 text-left hover:bg-muted/40"
            aria-expanded={open}
            aria-controls={sectionListId}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            )}
            <h2
              id={headingId}
              className="font-heading text-sm font-medium text-foreground sm:text-base"
            >
              Not on the grid
            </h2>
          </button>
        ) : (
          <h2
            id={headingId}
            className="font-heading text-sm font-medium text-foreground sm:text-base"
          >
            Not on the grid
          </h2>
        )}
        <p className="text-xs text-muted-foreground">{countLabel}</p>
      </div>
      {open ? (
        <>
          <p className="mt-1 text-xs text-muted-foreground">
            Online, asynchronous, or TBA sections. They&rsquo;re part of your
            schedule even though they don&rsquo;t take a slot on the week.
          </p>
          <ul id={sectionListId} className="mt-3 grid gap-2 sm:grid-cols-2">
            {rows.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => onCrnActivate(r.crn)}
                  className="flex w-full flex-col items-start gap-1 rounded-lg border border-border bg-background px-3 py-2 text-left transition hover:border-primary hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium text-foreground">
                      {r.courseLabel}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      CRN {r.crn}
                    </span>
                    {r.pill ? (
                      <span className="rounded-full border border-border bg-card px-2 py-0.5 text-[0.65rem] font-medium text-foreground sm:text-xs">
                        {r.pill}
                      </span>
                    ) : null}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                    {r.scheduleType ? <span>{r.scheduleType}</span> : null}
                    {r.instructor ? <span>{r.instructor}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
