"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode } from "react";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

const OVERLAY_GRADIENT =
  "radial-gradient(ellipse 85% 75% at 50% 50%, color-mix(in oklab, var(--background) 94%, transparent) 0%, transparent 72%)";

type Props = {
  show: boolean;
  children: ReactNode;
};

/** Centered, animated overlay when the planner has courses but no feasible schedule. */
export function NoSchedulesHelpOverlay({ show, children }: Props) {
  const reducedMotion = useReducedMotion();

  const scrimTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.28, ease: EASE_OUT };

  const contentTransition = reducedMotion
    ? { duration: 0 }
    : { duration: 0.28, delay: 0.04, ease: EASE_OUT };

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          key="no-schedules-overlay"
          role="region"
          aria-labelledby="planner-no-schedules-heading"
          className="absolute inset-0 z-30 flex items-center justify-center overflow-y-auto p-3 sm:p-4"
          style={{ background: OVERLAY_GRADIENT }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={scrimTransition}
        >
          <motion.div
            className="w-full max-w-md"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={contentTransition}
          >
            {children}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
