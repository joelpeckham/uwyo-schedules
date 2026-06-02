"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { addCourseLocal } from "@/lib/planner/add-course-local";
import {
  decodeShareState,
  scheduleFiltersFromSharePin,
} from "@/lib/planner/share-state";
import { writeTerm } from "@/lib/planner/local-state";
import { parseBlackoutsItemsArray } from "@/lib/planner/blackouts";

import { usePlannerData, usePlannerUi } from "./PlannerContext";

type Props = {
  termCode: string;
};

/**
 * Reads `?s=...` from the URL, applies the encoded courses and blackouts to
 * local storage, then strips the param.
 */
export function ShareLinkApplier({ termCode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("s");
  const appliedRef = useRef(false);
  const { plannerItems, isHydrating, setPlannerItems } = usePlannerData();
  const { setBlackouts } = usePlannerUi();

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
        if (!res.ok) continue;
        items = res.items.map((row) =>
          row.subject === pin.sub && row.courseNumber === pin.num
            ? {
                ...row,
                scheduleFilters: scheduleFiltersFromSharePin(pin.sf),
              }
            : row,
        );
        writeTerm(termCode, { items });
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
  ]);

  return null;
}
