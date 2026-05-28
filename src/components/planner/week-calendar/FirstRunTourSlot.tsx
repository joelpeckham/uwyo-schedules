"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { cn } from "@/lib/utils";

import { usePlannerData } from "../PlannerContext";
import { GESTURE_TIP_STORAGE_KEY } from "./schedule-help-dialog";

const FirstRunTour = dynamic(
  () => import("./FirstRunTour").then((m) => m.FirstRunTour),
  { ssr: false },
);

type Props = {
  plannerItemCount: number;
};

function isTourDismissed(): boolean {
  try {
    return Boolean(localStorage.getItem(GESTURE_TIP_STORAGE_KEY));
  } catch {
    return true;
  }
}

/** Reserved-height slot for the client-only tour (avoids toolbar/grid CLS on mount). */
export function FirstRunTourSlot({ plannerItemCount }: Props) {
  const { isHydrating } = usePlannerData();
  const [tourDismissed] = useState(isTourDismissed);
  const reserveTourHeight =
    !isHydrating && plannerItemCount > 0 && !tourDismissed;

  return (
    <div className={cn(reserveTourHeight && "min-h-[5.5rem]")}>
      <FirstRunTour plannerItemCount={plannerItemCount} />
    </div>
  );
}
