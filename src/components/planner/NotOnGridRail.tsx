"use client";

import { useMemo } from "react";
import { buildMembersByBundleId } from "@/lib/planner/client/derive";
import { resolveDisplayCrnsWithMemberMap } from "@/lib/planner/resolve-display-crns-shared";
import {
  classifyDeliveryMode,
  deliveryModeLabel,
  meetingHasTimeBlock,
} from "@/lib/sections/delivery-mode";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import type { PlannerItemRow } from "@/lib/planner/data";
import { plannerListRowInteractive } from "@/lib/planner/planner-interactive-surface";
import { cn } from "@/lib/utils";
import { motion, type Variants } from "motion/react";
import { usePlannerData, usePlannerSolve } from "./PlannerContext";
import {
  carouselRevealItemTransition,
} from "./motion/planner-motion";

type NotOnGridRow = {
  key: string;
  crn: string;
  courseLabel: string;
  scheduleType: string | null;
  pill: string | null;
  instructor: string | null;
};

type SubsectionProps = {
  rows: NotOnGridRow[];
  onCrnActivate: (crn: string) => void;
  revealExpanded?: boolean;
  revealStartIndex?: number;
  revealItemVariants?: Variants;
  reducedMotion?: boolean;
};

function computeNotOnGridRows(
  effectivePlannerItems: PlannerItemRow[],
  catalog: PlannerCatalogJson,
): NotOnGridRow[] {
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

  const sectionByCrn = new Map<string, (typeof catalog.sections)[number]>();
  for (const s of catalog.sections) sectionByCrn.set(s.crn, s);

  const out: NotOnGridRow[] = [];
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
        instructionalMethodDescription: section.instructionalMethodDescription,
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
}

export function useNotOnGridRailRows(): NotOnGridRow[] {
  const { catalog } = usePlannerData();
  const { effectivePlannerItems } = usePlannerSolve();
  return useMemo(
    () => computeNotOnGridRows(effectivePlannerItems, catalog),
    [effectivePlannerItems, catalog],
  );
}

/**
 * Sections that the student picked but that contribute zero blocks to the
 * weekly grid (online/asynchronous, or meetings still listed as TBA in
 * Banner). Nested inside the course carousel so these sections do not
 * silently disappear after a solve. Click a row to open the same section
 * detail modal the calendar uses.
 */
export function NotOnGridSubsection({
  rows,
  onCrnActivate,
  revealExpanded = false,
  revealStartIndex = 0,
  revealItemVariants,
  reducedMotion = false,
}: SubsectionProps) {
  if (rows.length === 0) return null;

  const headingId = "not-on-grid-heading";
  const sectionListId = "not-on-grid-list";
  const countLabel =
    rows.length === 1
      ? "1 section without a weekly time"
      : `${rows.length} sections without a weekly time`;
  const useReveal = revealItemVariants != null && !reducedMotion;
  const revealState = revealExpanded ? "visible" : "hidden";
  const RowTag = useReveal ? motion.li : "li";

  return (
    <div
      aria-labelledby={headingId}
      className="mx-3 border-t border-border pt-3 pb-3 sm:mx-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3
          id={headingId}
          className="font-heading text-sm font-medium text-foreground"
        >
          Not on the grid
        </h3>
        <p className="text-xs text-muted-foreground">{countLabel}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Online, asynchronous, or TBA sections. They&rsquo;re part of your
        schedule even though they don&rsquo;t take a slot on the week.
      </p>
      <ul id={sectionListId} className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map((r, index) => (
          <RowTag
            key={r.key}
            {...(useReveal
              ? {
                  variants: revealItemVariants,
                  animate: revealState,
                  initial: "hidden",
                  transition: carouselRevealItemTransition(
                    revealStartIndex + index,
                    revealExpanded,
                    reducedMotion,
                  ),
                }
              : {})}
          >
            <button
              type="button"
              onClick={() => onCrnActivate(r.crn)}
              className={cn(
                "flex w-full flex-col items-start gap-1 rounded-lg border border-border bg-background px-3 py-2 text-left",
                plannerListRowInteractive,
              )}
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
          </RowTag>
        ))}
      </ul>
    </div>
  );
}
