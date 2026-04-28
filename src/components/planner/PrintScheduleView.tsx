"use client";

import { useEffect, useMemo } from "react";

import {
  buildCalendarBlocksFromCatalog,
  collectDisplayCrnsForItems,
} from "@/lib/planner/client/derive";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import type { CalendarBlock, PlannerItemRow } from "@/lib/planner/data";

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
  const blocksByDay = useMemo(() => {
    const out = new Map<number, CalendarBlock[]>();
    for (const b of blocks) {
      const list = out.get(b.dayIndex) ?? [];
      list.push(b);
      out.set(b.dayIndex, list);
    }
    for (const list of out.values()) {
      list.sort((a, b) => a.startMinutes - b.startMinutes);
    }
    return out;
  }, [blocks]);

  const header = termDescription ?? termCode;

  return (
    <main className="mx-auto max-w-4xl bg-white p-8 text-sm text-black print:p-4">
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
          <section className="mt-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-black/70">
              CRNs
            </h2>
            <p className="mt-1 wrap-break-word font-mono text-sm">
              {crns.length > 0 ? crns.join(" ") : "—"}
            </p>
          </section>

          <section className="mt-5">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-black/70">
              Weekly meetings
            </h2>
            <ol className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {DAY_LABELS.map((label, idx) => {
                const list = blocksByDay.get(idx) ?? [];
                if (list.length === 0) return null;
                return (
                  <li key={label} className="rounded border border-black/30 p-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide">
                      {label}
                    </h3>
                    <ul className="mt-1 space-y-1.5">
                      {list.map((b) => (
                        <li key={b.key} className="text-xs leading-snug">
                          <span className="font-mono">
                            {formatMinutes(b.startMinutes)}–
                            {formatMinutes(b.endMinutes)}
                          </span>{" "}
                          <span className="font-mono font-medium">
                            {b.subject} {b.courseNumber}
                          </span>
                          {b.instructorSublabel ? (
                            <span className="text-black/70">
                              {" "}
                              · {b.instructorSublabel}
                            </span>
                          ) : null}
                          {b.sublabel ? (
                            <span className="text-black/70"> · {b.sublabel}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="mt-5">
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
