"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { CALENDAR_SCRIM_GRADIENT } from "./calendar-scrim-gradient";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

type Props = {
  show: boolean;
  className?: string;
  contentClassName?: string;
  /** When set, used as aria-labelledby on the scrim region. */
  labelledBy?: string;
  children?: ReactNode;
};

export function CalendarScrimOverlay({
  show,
  className,
  contentClassName,
  labelledBy,
  children,
}: Props) {
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
          key="calendar-scrim"
          role={labelledBy ? "region" : undefined}
          aria-labelledby={labelledBy}
          className={cn(
            "absolute inset-0 z-30 flex items-center justify-center overflow-y-auto p-3 backdrop-blur-[2px] sm:p-4",
            className,
          )}
          style={{ background: CALENDAR_SCRIM_GRADIENT }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={scrimTransition}
        >
          {children != null ? (
            <motion.div
              className={cn("w-full max-w-md", contentClassName)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={contentTransition}
            >
              {children}
            </motion.div>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
