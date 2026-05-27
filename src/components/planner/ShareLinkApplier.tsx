"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { addCourseLocal } from "@/lib/planner/add-course-local";
import { decodeShareState } from "@/lib/planner/share-state";
import { parseBlackoutsItemsArray } from "@/lib/planner/blackouts";
import { parseTimePrefs } from "@/lib/planner/time-prefs";

import { usePlannerData, usePlannerUi } from "./PlannerContext";

type Props = {
  termCode: string;
};

/**
 * Reads `?s=...` from the URL, applies the encoded courses, blackouts, and
 * time preferences to local storage, then strips the param.
 */
export function ShareLinkApplier({ termCode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("s");
  const appliedRef = useRef(false);
  const { plannerItems, isHydrating, setPlannerItems } = usePlannerData();
  const { setBlackouts, setTimePrefs } = usePlannerUi();

  useEffect(() => {
    if (!code || appliedRef.current || isHydrating) return;
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
      let items = plannerItems;
      for (const pin of doc.pins) {
        const res = addCourseLocal({
          termCode,
          subject: pin.sub,
          courseNumber: pin.num,
        });
        if (res.ok) items = res.items;
      }
      if (items !== plannerItems) {
        setPlannerItems(items);
      }

      if (doc.bo.length > 0) {
        setBlackouts(
          parseBlackoutsItemsArray(
            doc.bo.map((b, i) => ({
              id: `share-${i}-${b.d}-${b.s}`,
              dayIndex: b.d,
              start: b.s,
              end: b.e,
              ...(b.l ? { label: b.l } : {}),
            })),
          ),
        );
      }

      const prefs: Record<string, unknown> = { v: 1 };
      if (doc.tp.nf === 1) prefs.noFridays = true;
      if (typeof doc.tp.nb === "number") prefs.noBefore = doc.tp.nb;
      if (typeof doc.tp.na === "number") prefs.noAfter = doc.tp.na;
      if (Array.isArray(doc.tp.pl) && doc.tp.pl.length === 2) {
        prefs.protectLunch = { start: doc.tp.pl[0], end: doc.tp.pl[1] };
      }
      setTimePrefs(parseTimePrefs(prefs));

      stripParam();
    })();
  }, [
    code,
    termCode,
    plannerItems,
    isHydrating,
    router,
    setPlannerItems,
    setBlackouts,
    setTimePrefs,
  ]);

  return null;
}
