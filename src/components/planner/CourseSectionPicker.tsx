"use client";

import { Pin, PinOff } from "lucide-react";
import { useMemo } from "react";

import {
  classifyDeliveryMode,
  deliveryModeLabel,
} from "@/lib/sections/delivery-mode";
import {
  buildCourseSectionGroups,
  summarizeMeetings,
  type SectionRow,
  type SectionTypeGroup,
} from "@/lib/planner/sections-by-type";
import { parseSectionPinsJson } from "@/lib/planner/section-pins";
import type { CourseSolvePack } from "@/lib/planner/solve-schedules-core";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import type { PlannerItemRow } from "@/lib/planner/data";
import { cn } from "@/lib/utils";

type Props = {
  item: PlannerItemRow;
  pack: CourseSolvePack;
  catalog: PlannerCatalogJson;
  onTogglePin: (
    itemId: number,
    scheduleTypeKey: string,
    sectionCrn: string,
  ) => void;
  /** Disabled when a save is in flight or the item is fully pinned. */
  disabled?: boolean;
};

function modalityLabel(row: SectionRow): string | null {
  return deliveryModeLabel(
    classifyDeliveryMode({
      instructionalMethod: row.instructionalMethod,
      instructionalMethodDescription: row.instructionalMethodDescription,
      hasTimedMeetings: row.meetings.length > 0,
    }),
  );
}

function SeatChip({ row }: { row: SectionRow }) {
  if (row.seatsAvailable == null) return null;
  const closed = row.isFull;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium tabular-nums",
        closed
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : "border-border bg-muted/40 text-muted-foreground",
      )}
      title={closed ? "Section is full" : `${row.seatsAvailable} open seats`}
    >
      {Math.max(0, row.seatsAvailable)} {closed ? "full" : "open"}
    </span>
  );
}

export function CourseSectionPicker({
  item,
  pack,
  catalog,
  onTogglePin,
  disabled,
}: Props) {
  const groups: SectionTypeGroup[] = useMemo(
    () => buildCourseSectionGroups(pack, catalog),
    [pack, catalog],
  );
  const pinsByType = useMemo(
    () => parseSectionPinsJson(item.sectionPins).byType,
    [item.sectionPins],
  );
  const isResolvedToFixedCrns = item.selectionKind !== "unresolved";

  if (groups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">No sections available.</p>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((g) => {
        const pinned = pinsByType[g.scheduleTypeKey] ?? null;
        return (
          <div
            key={g.scheduleTypeKey}
            className="rounded-md border border-border/70 bg-background"
          >
            <div className="flex items-center justify-between gap-2 border-b border-border/60 px-2 py-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {g.label}
                {!g.isAnchorGroup ? (
                  <span className="ml-2 rounded bg-muted px-1 py-0.5 text-[9px] tracking-wide text-muted-foreground">
                    Linked
                  </span>
                ) : null}
              </p>
              {pinned ? (
                <span className="inline-flex h-5 items-center gap-1 rounded-md border border-primary/40 bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
                  <Pin className="size-3" />
                  Pinned · {pinned}
                </span>
              ) : null}
            </div>
            <ul className="divide-y divide-border/40">
              {g.rows.map((row) => {
                const isPinned = pinned === row.crn;
                const meetingLabel = summarizeMeetings(row.meetings);
                const modality = modalityLabel(row);
                const ariaLabel = isPinned
                  ? `Unpin section ${row.crn}`
                  : `Pin section ${row.crn}`;
                const buttonDisabled = disabled || isResolvedToFixedCrns;
                return (
                  <li
                    key={row.crn}
                    className={cn(
                      "flex items-start gap-2 px-2 py-1.5 text-xs",
                      isPinned && "bg-primary/5",
                    )}
                  >
                    <button
                      type="button"
                      aria-label={ariaLabel}
                      title={ariaLabel}
                      disabled={buttonDisabled}
                      onClick={() =>
                        onTogglePin(item.id, g.scheduleTypeKey, row.crn)
                      }
                      className={cn(
                        "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border text-muted-foreground transition-colors",
                        "hover:border-primary/60 hover:bg-primary/10 hover:text-primary",
                        "disabled:pointer-events-none disabled:opacity-40",
                        isPinned &&
                          "border-primary/60 bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                      )}
                    >
                      {isPinned ? (
                        <PinOff className="size-3.5" />
                      ) : (
                        <Pin className="size-3.5" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-mono text-foreground">
                          {row.crn}
                        </span>
                        {row.sequenceNumber ? (
                          <span className="text-muted-foreground">
                            §{row.sequenceNumber}
                          </span>
                        ) : null}
                        {modality ? (
                          <span className="rounded border border-border bg-muted/40 px-1 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {modality}
                          </span>
                        ) : null}
                        <SeatChip row={row} />
                      </div>
                      <p className="font-mono text-[11px] text-muted-foreground">
                        {meetingLabel}
                      </p>
                      {row.instructorDisplay ? (
                        <p className="text-[11px] text-muted-foreground">
                          {row.instructorDisplay}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
