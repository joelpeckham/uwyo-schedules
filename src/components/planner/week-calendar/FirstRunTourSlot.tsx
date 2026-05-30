"use client";

import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";

import { usePlannerData } from "../PlannerContext";
import { GESTURE_TIP_STORAGE_KEY } from "./schedule-help-dialog";

const FirstRunTour = dynamic(
  () => import("./FirstRunTour").then((m) => m.FirstRunTour),
  { ssr: false },
);

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

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

/** Client-only slot for the first-run tour; collapses smoothly when dismissed. */
export function FirstRunTourSlot({ plannerItemCount }: Props) {
  const { isHydrating } = usePlannerData();
  const reducedMotion = useReducedMotion();
  const [showTour, setShowTour] = useState(() => !isTourDismissed());

  const shouldShow =
    showTour && !isHydrating && plannerItemCount > 0;

  const transition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: EASE_OUT };

  return (
    <AnimatePresence initial={false}>
      {shouldShow ? (
        <motion.div
          key="first-run-tour"
          className="mb-3 overflow-hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0, marginBottom: 0 }}
          transition={transition}
        >
          <FirstRunTour
            plannerItemCount={plannerItemCount}
            onDismiss={() => setShowTour(false)}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
