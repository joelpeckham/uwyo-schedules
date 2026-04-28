"use client";

import { useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { buildCalendarBlocksFromCatalog } from "@/lib/planner/client/derive";
import type { CalendarBlock, PlannerItemRow } from "@/lib/planner/data";
import type {
  ScheduleSolution,
} from "@/lib/planner/solve-schedules-core";
import { cn } from "@/lib/utils";

import { usePlanner } from "./PlannerContext";

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Indices into `solutions` for kept schedules, sorted ascending. */
  keptIndices: number[];
  /** Stable fingerprints, used as `<option>` keys. */
  keptKeys: string[];
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const EARLY_MORNING_MIN = 8 * 60;

function applySolution(
  items: PlannerItemRow[],
  solution: ScheduleSolution,
): PlannerItemRow[] {
  return items.map((row) => {
    const sel = solution.selections[row.id];
    if (!sel) return row;
    return {
      ...row,
      selectionKind: sel.selectionKind,
      anchorCrn: sel.anchorCrn,
      linkedBundleId: sel.linkedBundleId,
    };
  });
}

function summarizeBlocks(blocks: CalendarBlock[]): {
  totalMinutes: number;
  daysUsed: number;
  earliestStart: number | null;
  latestEnd: number | null;
  earlyMorningCount: number;
} {
  if (blocks.length === 0) {
    return {
      totalMinutes: 0,
      daysUsed: 0,
      earliestStart: null,
      latestEnd: null,
      earlyMorningCount: 0,
    };
  }
  const days = new Set<number>();
  let totalMinutes = 0;
  let earliest = Number.POSITIVE_INFINITY;
  let latest = 0;
  let earlyMorning = 0;
  for (const b of blocks) {
    days.add(b.dayIndex);
    totalMinutes += Math.max(0, b.endMinutes - b.startMinutes);
    earliest = Math.min(earliest, b.startMinutes);
    latest = Math.max(latest, b.endMinutes);
    if (b.startMinutes < EARLY_MORNING_MIN) earlyMorning += 1;
  }
  return {
    totalMinutes,
    daysUsed: days.size,
    earliestStart: Number.isFinite(earliest) ? earliest : null,
    latestEnd: latest,
    earlyMorningCount: earlyMorning,
  };
}

function formatMinutes(min: number | null): string {
  if (min == null) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  const period = h >= 12 ? "p" : "a";
  const hh = ((h + 11) % 12) + 1;
  return m === 0 ? `${hh}${period}` : `${hh}:${String(m).padStart(2, "0")}${period}`;
}

function formatHours(min: number): string {
  if (min === 0) return "0 h";
  const hours = Math.round((min / 60) * 10) / 10;
  return `${hours} h`;
}

type CourseCompareRow = {
  itemId: number;
  label: string;
  color: string;
  aCrn: string | null;
  bCrn: string | null;
  aFaculty: string | null;
  bFaculty: string | null;
};

function buildCourseRows(
  items: PlannerItemRow[],
  aBlocks: CalendarBlock[],
  bBlocks: CalendarBlock[],
  facultyByCrn: Record<string, string>,
  aSolution: ScheduleSolution,
  bSolution: ScheduleSolution,
): CourseCompareRow[] {
  const aBlockByItem = new Map<number, CalendarBlock>();
  const bBlockByItem = new Map<number, CalendarBlock>();
  for (const b of aBlocks) {
    if (!aBlockByItem.has(b.plannerItemId)) aBlockByItem.set(b.plannerItemId, b);
  }
  for (const b of bBlocks) {
    if (!bBlockByItem.has(b.plannerItemId)) bBlockByItem.set(b.plannerItemId, b);
  }
  return items.map((row) => {
    const aSel = aSolution.selections[row.id] ?? null;
    const bSel = bSolution.selections[row.id] ?? null;
    const aBlock = aBlockByItem.get(row.id) ?? null;
    const bBlock = bBlockByItem.get(row.id) ?? null;
    return {
      itemId: row.id,
      label: `${row.subject} ${row.courseNumber}`,
      color: row.displayColor,
      aCrn: aSel?.anchorCrn ?? null,
      bCrn: bSel?.anchorCrn ?? null,
      aFaculty:
        aBlock?.instructorSublabel ?? (aSel?.anchorCrn ? facultyByCrn[aSel.anchorCrn] ?? null : null),
      bFaculty:
        bBlock?.instructorSublabel ?? (bSel?.anchorCrn ? facultyByCrn[bSel.anchorCrn] ?? null : null),
    };
  });
}

export function SchedulesCompare({ open, onOpenChange, keptIndices, keptKeys }: Props) {
  const { solutions, plannerItems, catalog } = usePlanner();

  const [aIdx, setAIdx] = useState<number>(() => keptIndices[0] ?? 0);
  const [bIdx, setBIdx] = useState<number>(
    () => keptIndices[1] ?? keptIndices[0] ?? 0,
  );

  const a = solutions[aIdx] ?? null;
  const b = solutions[bIdx] ?? null;

  const aItems = useMemo(
    () => (a ? applySolution(plannerItems, a) : plannerItems),
    [plannerItems, a],
  );
  const bItems = useMemo(
    () => (b ? applySolution(plannerItems, b) : plannerItems),
    [plannerItems, b],
  );

  const aBlocks = useMemo(
    () => buildCalendarBlocksFromCatalog(aItems, catalog),
    [aItems, catalog],
  );
  const bBlocks = useMemo(
    () => buildCalendarBlocksFromCatalog(bItems, catalog),
    [bItems, catalog],
  );

  const aSummary = useMemo(() => summarizeBlocks(aBlocks), [aBlocks]);
  const bSummary = useMemo(() => summarizeBlocks(bBlocks), [bBlocks]);

  const courseRows = useMemo(() => {
    if (!a || !b) return [] as CourseCompareRow[];
    return buildCourseRows(
      plannerItems,
      aBlocks,
      bBlocks,
      catalog.facultyByCrn,
      a,
      b,
    );
  }, [a, b, plannerItems, aBlocks, bBlocks, catalog.facultyByCrn]);

  const diffChips = useMemo(() => {
    const chips: string[] = [];
    if (!a || !b) return chips;
    if (aSummary.daysUsed !== bSummary.daysUsed) {
      const delta = bSummary.daysUsed - aSummary.daysUsed;
      chips.push(
        `${delta > 0 ? "+" : ""}${delta} ${Math.abs(delta) === 1 ? "day" : "days"} on B`,
      );
    }
    if (aSummary.earlyMorningCount !== bSummary.earlyMorningCount) {
      const delta = bSummary.earlyMorningCount - aSummary.earlyMorningCount;
      const word = Math.abs(delta) === 1 ? "8 a.m. block" : "8 a.m. blocks";
      chips.push(
        `${delta > 0 ? "+" : ""}${delta} ${word} on B`,
      );
    }
    if (aSummary.totalMinutes !== bSummary.totalMinutes) {
      const delta = bSummary.totalMinutes - aSummary.totalMinutes;
      const sign = delta > 0 ? "+" : "−";
      chips.push(`${sign}${formatHours(Math.abs(delta))} total on B`);
    }
    let instructorDiffs = 0;
    let sectionDiffs = 0;
    for (const r of courseRows) {
      if (r.aCrn !== r.bCrn) sectionDiffs += 1;
      if ((r.aFaculty ?? "") !== (r.bFaculty ?? "")) instructorDiffs += 1;
    }
    if (sectionDiffs > 0) {
      chips.push(`${sectionDiffs} different ${sectionDiffs === 1 ? "section" : "sections"}`);
    } else if (instructorDiffs > 0) {
      chips.push(
        `${instructorDiffs} different ${instructorDiffs === 1 ? "instructor" : "instructors"}`,
      );
    }
    return chips;
  }, [a, b, aSummary, bSummary, courseRows]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Compare schedules</DialogTitle>
          <DialogDescription>
            Two of your kept schedules, side by side.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CompareColumn
            label="Schedule A"
            value={aIdx}
            onChange={setAIdx}
            keptIndices={keptIndices}
            keptKeys={keptKeys}
            blocks={aBlocks}
            summary={aSummary}
            courseRows={courseRows}
            side="a"
          />
          <CompareColumn
            label="Schedule B"
            value={bIdx}
            onChange={setBIdx}
            keptIndices={keptIndices}
            keptKeys={keptKeys}
            blocks={bBlocks}
            summary={bSummary}
            courseRows={courseRows}
            side="b"
          />
        </div>

        {diffChips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-foreground">
            <span className="font-medium text-muted-foreground">Differences:</span>
            {diffChips.map((chip) => (
              <span
                key={chip}
                className="inline-flex items-center rounded-md border border-border bg-background px-1.5 py-0.5 font-mono"
              >
                {chip}
              </span>
            ))}
          </div>
        ) : (
          <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            These two schedules look identical.
          </p>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ColumnProps = {
  label: string;
  value: number;
  onChange: (next: number) => void;
  keptIndices: number[];
  keptKeys: string[];
  blocks: CalendarBlock[];
  summary: ReturnType<typeof summarizeBlocks>;
  courseRows: CourseCompareRow[];
  side: "a" | "b";
};

function CompareColumn({
  label,
  value,
  onChange,
  keptIndices,
  keptKeys,
  blocks,
  summary,
  courseRows,
  side,
}: ColumnProps) {
  const blocksByDay = useMemo(() => {
    const out = new Map<number, CalendarBlock[]>();
    for (const b of blocks) {
      const list = out.get(b.dayIndex) ?? [];
      list.push(b);
      out.set(b.dayIndex, list);
    }
    for (const list of out.values()) {
      list.sort((x, y) => x.startMinutes - y.startMinutes);
    }
    return out;
  }, [blocks]);

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border bg-background p-3">
      <header className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Select
          value={String(value)}
          onValueChange={(s) => onChange(Number.parseInt(s, 10))}
        >
          <SelectTrigger size="sm" className="font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {keptIndices.map((idx, i) => (
              <SelectItem key={keptKeys[i] ?? idx} value={String(idx)}>
                # {idx + 1}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </header>

      <dl className="grid grid-cols-3 gap-1 text-[11px]">
        <Stat label="Days" value={String(summary.daysUsed)} />
        <Stat label="Hours" value={formatHours(summary.totalMinutes)} />
        <Stat
          label="Window"
          value={
            summary.earliestStart == null || summary.latestEnd == null
              ? "—"
              : `${formatMinutes(summary.earliestStart)}–${formatMinutes(summary.latestEnd)}`
          }
        />
      </dl>

      <ol className="flex flex-col gap-1.5">
        {DAY_LABELS.map((dayLabel, idx) => {
          const list = blocksByDay.get(idx) ?? [];
          if (list.length === 0) return null;
          return (
            <li key={dayLabel} className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {dayLabel}
              </span>
              <ol className="flex flex-col gap-1">
                {list.map((b) => (
                  <li
                    key={b.key}
                    className="flex items-baseline gap-2 rounded-md border border-border/70 bg-muted/30 px-2 py-1"
                  >
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: b.color }}
                    />
                    <span className="font-mono text-[11px] tabular-nums text-foreground">
                      {formatMinutes(b.startMinutes)}–{formatMinutes(b.endMinutes)}
                    </span>
                    <span className="font-mono text-[11px] text-foreground">
                      {b.subject} {b.courseNumber}
                    </span>
                    {b.sublabel ? (
                      <span className="truncate text-[11px] text-muted-foreground">
                        {b.sublabel}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ol>

      <ul className="mt-1 flex flex-col gap-0.5 text-[11px]">
        {courseRows.map((row) => {
          const crn = side === "a" ? row.aCrn : row.bCrn;
          const otherCrn = side === "a" ? row.bCrn : row.aCrn;
          const faculty = side === "a" ? row.aFaculty : row.bFaculty;
          const otherFaculty = side === "a" ? row.bFaculty : row.aFaculty;
          const sectionChanged = (crn ?? null) !== (otherCrn ?? null);
          const facultyChanged = (faculty ?? "") !== (otherFaculty ?? "");
          return (
            <li
              key={row.itemId}
              className={cn(
                "flex items-baseline gap-2 rounded px-1",
                (sectionChanged || facultyChanged) && "bg-primary/5",
              )}
            >
              <span
                aria-hidden
                className="mt-0.5 size-2 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="font-mono text-[11px] text-foreground">
                {row.label}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                CRN {crn ?? "—"}
              </span>
              {faculty ? (
                <span className="truncate text-[11px] text-muted-foreground">
                  {faculty}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-1.5 py-1 text-center">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-xs tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}
