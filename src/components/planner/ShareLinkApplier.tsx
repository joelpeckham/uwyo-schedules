"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  addPlannerCourseWishAction,
  savePlannerBlackoutsAction,
  savePlannerTimePrefsAction,
} from "@/app/planner/actions";
import { decodeShareState } from "@/lib/planner/share-state";
import type { PlannerItemRow } from "@/lib/planner/data";

type Props = {
  termCode: string;
  /** Items currently in the term — used to skip duplicates. */
  plannerItems: PlannerItemRow[];
};

/**
 * Reads `?s=...` from the URL, applies the encoded courses, blackouts, and
 * time preferences, then strips the param so refreshes don't re-import.
 *
 * v1 only restores courses (as wish-list rows) plus blackouts and time
 * preferences. Anchor pinning is intentionally left for the user to confirm
 * after the shared link populates the rail — it's safer to surface the
 * intended sections in the planner than to silently lock them in.
 */
export function ShareLinkApplier({ termCode, plannerItems }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("s");
  const appliedRef = useRef(false);

  useEffect(() => {
    if (!code) return;
    if (appliedRef.current) return;
    appliedRef.current = true;

    const doc = decodeShareState(code);
    const stripParam = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("s");
      router.replace(url.pathname + url.search);
    };

    if (!doc || doc.t !== termCode) {
      stripParam();
      return;
    }

    void (async () => {
      const have = new Set(
        plannerItems.map((it) => `${it.subject}\u0000${it.courseNumber}`),
      );
      for (const pin of doc.pins) {
        const key = `${pin.sub}\u0000${pin.num}`;
        if (have.has(key)) continue;
        await addPlannerCourseWishAction({
          termCode,
          subject: pin.sub,
          courseNumber: pin.num,
        });
        have.add(key);
      }

      if (doc.bo.length > 0) {
        await savePlannerBlackoutsAction({
          termCode,
          items: doc.bo.map((b, i) => ({
            id: `share-${i}-${b.d}-${b.s}`,
            dayIndex: b.d,
            start: b.s,
            end: b.e,
            ...(b.l ? { label: b.l } : {}),
          })),
        });
      }

      const prefs: Record<string, unknown> = { v: 1 };
      if (doc.tp.nf === 1) prefs.noFridays = true;
      if (typeof doc.tp.nb === "number") prefs.noBefore = doc.tp.nb;
      if (typeof doc.tp.na === "number") prefs.noAfter = doc.tp.na;
      if (Array.isArray(doc.tp.pl) && doc.tp.pl.length === 2) {
        prefs.protectLunch = { start: doc.tp.pl[0], end: doc.tp.pl[1] };
      }
      await savePlannerTimePrefsAction({ termCode, prefs });

      stripParam();
      router.refresh();
    })();
  }, [code, termCode, plannerItems, router]);

  return null;
}
