"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics/track";
import { GESTURE_TIP_STORAGE_KEY } from "./schedule-help-dialog";

const TOUR_STEPS: readonly { title: string; body: React.ReactNode }[] = [
  {
    title: "Pin a section",
    body: (
      <>
        Tap the pin on any block (or in the section list on the left) to lock
        that lecture, lab, or discussion. The planner keeps everything else
        flexible.
      </>
    ),
  },
  {
    title: "Try other times",
    body: (
      <>
        Drag a block to preview other meetings of the same type. Highlighted
        slots fit; release on one to swap.
      </>
    ),
  },
  {
    title: "Pan and zoom",
    body: (
      <>
        On touch, use two fingers to pan; pinch to zoom. On a trackpad, hold{" "}
        <kbd className="rounded border border-border bg-background px-1 font-mono text-[10px]">
          Ctrl
        </kbd>{" "}
        and scroll &mdash; or use + / &minus; in the toolbar.
      </>
    ),
  },
];

type Props = {
  plannerItemCount: number;
  onDismiss: () => void;
};

/** Client-only first-run tour (reads localStorage). Mount/unmount is owned by {@link FirstRunTourSlot}. */
export function FirstRunTour({ plannerItemCount, onDismiss }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (plannerItemCount === 0) return;
    track("planner_tour_step_seen", { step: step + 1 });
  }, [step, plannerItemCount]);

  if (plannerItemCount === 0) return null;

  const idx = Math.max(0, Math.min(step, TOUR_STEPS.length - 1));
  const current = TOUR_STEPS[idx]!;
  const isLast = idx === TOUR_STEPS.length - 1;

  const dismiss = () => {
    try {
      localStorage.setItem(GESTURE_TIP_STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    track("planner_tour_dismissed", { step: idx + 1 });
    onDismiss();
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-foreground sm:flex-row sm:items-start sm:gap-3">
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {idx + 1} / {TOUR_STEPS.length}
          </span>
          <span className="font-medium text-foreground">{current.title}</span>
        </p>
        <p className="mt-1 leading-relaxed text-muted-foreground">{current.body}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs text-muted-foreground"
          onClick={dismiss}
        >
          Skip
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 px-3 text-xs"
          onClick={isLast ? dismiss : () => setStep((s) => s + 1)}
        >
          {isLast ? "Got it" : "Next"}
        </Button>
        <button
          type="button"
          aria-label="Dismiss tour"
          className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:text-foreground"
          onClick={dismiss}
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
