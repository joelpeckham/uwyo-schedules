"use client";

import { useEffect, useMemo } from "react";

import { WeekCalendarView } from "@/components/planner/week-calendar/WeekCalendarView";
import { CALENDAR_HOUR_AXIS } from "@/components/planner/week-calendar/axis-constants";
import { visibleDayIndicesForBlocks } from "@/components/planner/week-calendar/visible-days";
import {
  buildCalendarBlocksFromCatalog,
  collectDisplayCrnsForItems,
} from "@/lib/planner/client/derive";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import type { CalendarBlock, PlannerItemRow } from "@/lib/planner/data";

const PRINT_ROW_PX = 30;
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  termCode: string;
  termDescription: string | null;
  plannerItems: PlannerItemRow[];
  catalog: PlannerCatalogJson;
};

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const period = h >= 12 ? "p.m." : "a.m.";
  const hh = ((h + 11) % 12) + 1;
  return m === 0 ? `${hh} ${period}` : `${hh}:${String(m).padStart(2, "0")} ${period}`;
}

function courseDetailLines(blocks: CalendarBlock[]): string[] {
  const byKey = new Map<string, CalendarBlock[]>();
  for (const b of blocks) {
    const key = `${b.subject} ${b.courseNumber}`;
    const list = byKey.get(key) ?? [];
    list.push(b);
    byKey.set(key, list);
  }
  const lines: string[] = [];
  for (const [course, list] of byKey) {
    list.sort((a, b) => a.dayIndex - b.dayIndex || a.startMinutes - b.startMinutes);
    const parts = list.map((b) => {
      const day = DAY_LABELS[b.dayIndex] ?? "?";
      const time = `${formatMinutes(b.startMinutes)}–${formatMinutes(b.endMinutes)}`;
      const loc = b.sublabel.trim();
      const inst = b.instructorSublabel?.trim() ?? "";
      const meta = [loc, inst].filter(Boolean).join(" · ");
      return meta ? `${day} ${time} (${meta})` : `${day} ${time}`;
    });
    const crns = [...new Set(list.map((b) => b.sectionCrn))].join(", ");
    lines.push(`${course} — CRN ${crns}: ${parts.join("; ")}`);
  }
  return lines;
}

export function PrintScheduleView({
  termCode,
  termDescription,
  plannerItems,
  catalog,
}: Props) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tid = window.setTimeout(() => {
      try {
        window.print();
      } catch {
        /* user cancelled or print not available */
      }
    }, 250);
    return () => window.clearTimeout(tid);
  }, []);

  const crns = useMemo(
    () => collectDisplayCrnsForItems(plannerItems, catalog),
    [plannerItems, catalog],
  );
  const blocks = useMemo(
    () => buildCalendarBlocksFromCatalog(plannerItems, catalog),
    [plannerItems, catalog],
  );
  const visibleDayIndices = useMemo(
    () => visibleDayIndicesForBlocks(blocks),
    [blocks],
  );
  const courseLines = useMemo(() => courseDetailLines(blocks), [blocks]);

  const header = termDescription ?? termCode;

  return (
    <main className="print-schedule mx-auto max-w-[11in] bg-white p-8 text-sm text-black print:p-4">
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 0.4in;
          }
          .print-schedule {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <header className="border-b border-black/40 pb-3">
        <h1 className="text-xl font-medium">UW schedule — {header}</h1>
        <p className="mt-1 text-xs text-black/70">
          {plannerItems.length} course{plannerItems.length === 1 ? "" : "s"} ·{" "}
          {crns.length} CRN{crns.length === 1 ? "" : "s"}
        </p>
      </header>

      {plannerItems.length === 0 ? (
        <p className="mt-6 text-sm text-black/70">
          No courses on this schedule yet.
        </p>
      ) : (
        <>
          {blocks.length > 0 ? (
            <section className="mt-4 print:break-inside-avoid">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-black/70">
                Week at a glance
              </h2>
              <div className="mt-2 overflow-x-auto rounded border border-black/30 bg-white">
                <WeekCalendarView
                  blocks={blocks}
                  visibleDayIndices={visibleDayIndices}
                  rowPx={PRINT_ROW_PX}
                  hourAxis={CALENDAR_HOUR_AXIS}
                  className="min-w-160 text-black"
                />
              </div>
            </section>
          ) : null}

          <section className="mt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-black/70">
              CRNs
            </h2>
            <p className="mt-1 wrap-break-word font-mono text-sm">
              {crns.length > 0 ? crns.join(" ") : "—"}
            </p>
          </section>

          {courseLines.length > 0 ? (
            <section className="mt-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-black/70">
                Meeting details
              </h2>
              <ul className="mt-1 space-y-1.5 text-xs leading-snug">
                {courseLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="mt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-black/70">
              Courses
            </h2>
            <ul className="mt-1 space-y-1">
              {plannerItems.map((item) => (
                <li key={item.id} className="font-mono text-sm">
                  {item.subject} {item.courseNumber}
                  {item.anchorCrn ? (
                    <span className="text-black/60"> · CRN {item.anchorCrn}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <footer className="mt-8 border-t border-black/30 pt-2 text-[10px] text-black/60 print:fixed print:bottom-2 print:left-4 print:right-4">
        Generated by uwyoschedule. Verify CRNs in WyoWeb before registering.
      </footer>
    </main>
  );
}
