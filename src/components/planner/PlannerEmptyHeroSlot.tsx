"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { usePlannerData } from "./PlannerContext";
import { PlannerEmptyHero } from "./PlannerEmptyHero";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

type Props = {
  termCode: string;
};

/** Animated slot for the empty-state hero; collapses smoothly when courses are added. */
export function PlannerEmptyHeroSlot({ termCode }: Props) {
  const { plannerItems } = usePlannerData();
  const reducedMotion = useReducedMotion();

  const show = plannerItems.length === 0;

  const transition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: EASE_OUT };

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          key="planner-empty-hero"
          data-planner-empty-hero
          className="mb-4 overflow-hidden"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0, marginBottom: 0 }}
          transition={transition}
        >
          <PlannerEmptyHero termCode={termCode} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
