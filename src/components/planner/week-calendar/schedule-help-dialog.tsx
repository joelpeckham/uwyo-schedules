"use client";

import {
  ArrowLeftRight,
  Ban,
  CircleHelp,
  Hand,
  MousePointerClick,
  Pin,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { track } from "@/lib/analytics/track";
import { CALENDAR_HOUR_AXIS, DAY_LABELS } from "./axis-constants";

export { CALENDAR_HOUR_AXIS, DAY_LABELS };

export const GESTURE_TIP_STORAGE_KEY = "uwyo.planner.weekCalTipDismissed";

const HOUR_RANGE_HELP =
  "Zoom stops when 4 a.m. through 11 p.m. fill this view.";

const SCHEDULE_HELP: readonly {
  readonly Icon: typeof Hand;
  readonly label: string;
  readonly body: string;
}[] = [
  {
    Icon: Hand,
    label: "Pan the week",
    body: "On touch, use two fingers to pan: up, down, and side to side.",
  },
  {
    Icon: ZoomIn,
    label: "Zoom the day",
    body: `Pinch with two fingers, or use Ctrl+scroll, to show more or less of the day. ${HOUR_RANGE_HELP}`,
  },
  {
    Icon: MousePointerClick,
    label: "Open details",
    body: "Tap a block (without dragging) to read section details.",
  },
  {
    Icon: Pin,
    label: "Pin one slice",
    body: "When a course is on auto-pick, tap the pin on a lecture, lab, or discussion block to hold just that piece; other parts of the same course can still move. Tap again on the same block to unpin.",
  },
  {
    Icon: ArrowLeftRight,
    label: "Try another time",
    body: "Drag a section to preview other meetings of the same type that still fit. Release on a highlighted slot to switch.",
  },
  {
    Icon: Ban,
    label: "Busy times",
    body: "Turn on “Mark busy time” and drag on a day column to block time. Tap a block to fine-tune the times or add a label. Two fingers still pan and zoom the week.",
  },
] as const;

export function ScheduleHelpDialog() {
  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) track("planner_help_opened", {});
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="How to use the weekly schedule"
        >
          <CircleHelp className="size-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[min(32rem,85vh)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How to use the weekly schedule</DialogTitle>
          <DialogDescription>
            Gestures for moving and zooming your week preview.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-none space-y-4">
          {SCHEDULE_HELP.map((item) => {
            const I = item.Icon;
            return (
              <li
                key={item.label}
                className="flex gap-3 border-b border-border pb-4 last:border-b-0 last:pb-0"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground"
                  aria-hidden
                >
                  <I className="size-4" strokeWidth={2} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
