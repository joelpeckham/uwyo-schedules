"use client";

import { Loader2 } from "lucide-react";

type Props = {
  syncError: string | null;
  onClearSyncError: () => void;
  scheduleFeasibilityError: string | null;
  onClearScheduleFeasibilityError: () => void;
  swapError: string | null;
  onClearSwapError: () => void;
  isRecalculatingSolutions: boolean;
};

/**
 * Fixed-height region for transient calendar messages so toolbar/grid
 * position does not shift when errors or the recalc loader appear.
 */
export function WeekCalendarAlertSlot({
  syncError,
  onClearSyncError,
  scheduleFeasibilityError,
  onClearScheduleFeasibilityError,
  swapError,
  onClearSwapError,
  isRecalculatingSolutions,
}: Props) {
  const message =
    syncError ??
    scheduleFeasibilityError ??
    swapError ??
    (isRecalculatingSolutions ? "__building__" : null);

  return (
    <div
      className="flex h-10 items-center border-b border-border px-3 sm:px-4"
      aria-live="polite"
    >
      {message === "__building__" ? (
        <p className="flex min-w-0 items-center gap-2 truncate text-sm text-muted-foreground">
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
          Building this week&hellip;
        </p>
      ) : message ? (
        <div
          className="flex min-w-0 items-center text-sm text-destructive"
          role="alert"
        >
          <span className="line-clamp-1 min-w-0 flex-1">{message}</span>
          <button
            type="button"
            className="ml-2 shrink-0 underline"
            onClick={() => {
              if (syncError) onClearSyncError();
              else if (scheduleFeasibilityError) onClearScheduleFeasibilityError();
              else if (swapError) onClearSwapError();
            }}
          >
            Dismiss
          </button>
        </div>
      ) : (
        <span className="sr-only">No calendar alerts</span>
      )}
    </div>
  );
}
