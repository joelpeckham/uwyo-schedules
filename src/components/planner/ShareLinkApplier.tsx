"use client";

import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { resolveShareLinkAction } from "@/app/planner/actions";
import { replaceTermFromShare } from "@/lib/planner/local-state";
import { showPlannerError } from "@/lib/planner/planner-toast";

import { usePlannerData, usePlannerUi } from "./PlannerContext";

type Props = {
  termCode: string;
};

/**
 * Reads `?s=...` from the URL, loads the server share payload, replaces local
 * planner state, then strips the param.
 */
export function ShareLinkApplier({ termCode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("s");
  const appliedRef = useRef(false);
  const { isHydrating, setPlannerItems, reloadPlannerBootstrap } =
    usePlannerData();
  const { setBlackouts } = usePlannerUi();

  useEffect(() => {
    if (!code || appliedRef.current || isHydrating) return;
    appliedRef.current = true;

    const stripParam = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("s");
      router.replace(url.pathname + url.search);
    };

    void (async () => {
      const res = await resolveShareLinkAction(code);
      if (!res.ok) {
        showPlannerError(res.error);
        stripParam();
        return;
      }

      const { payload } = res;
      if (payload.termCode !== termCode) {
        router.replace(
          `/planner?term=${encodeURIComponent(payload.termCode)}&s=${encodeURIComponent(code)}`,
        );
        appliedRef.current = false;
        return;
      }

      replaceTermFromShare(termCode, {
        items: payload.items,
        blackouts: payload.blackouts,
      });
      setPlannerItems(payload.items);
      setBlackouts(payload.blackouts);
      await reloadPlannerBootstrap();
      stripParam();
    })();
  }, [
    code,
    termCode,
    isHydrating,
    router,
    setPlannerItems,
    setBlackouts,
    reloadPlannerBootstrap,
  ]);

  return null;
}
