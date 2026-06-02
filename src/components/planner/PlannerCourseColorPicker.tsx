"use client";

import { COURSE_COLOR_GRID } from "@/lib/planner/course-colors";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { memo, useState } from "react";

const COLS = COURSE_COLOR_GRID[0]?.length ?? 1;

type Props = {
  displayColor: string;
  disabled?: boolean;
  variant?: "swatch" | "dot";
  onPick: (hex: string) => void;
};

function PlannerCourseColorPickerInner({
  displayColor,
  disabled,
  variant = "swatch",
  onPick,
}: Props) {
  const [open, setOpen] = useState(false);
  const current = displayColor.trim().toLowerCase();
  const isDot = variant === "dot";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          className={cn(
            "shrink-0 border-border p-0",
            isDot ? "size-5 rounded-full" : "h-8 w-10",
          )}
          aria-label="Course calendar color"
        >
          <span
            className={cn(
              "block border border-border/80",
              isDot
                ? "size-full rounded-full"
                : "size-full rounded-[min(var(--radius-md),8px)]",
            )}
            style={{ backgroundColor: displayColor }}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-w-[min(calc(100vw-2rem),22rem)]">
        <p className="mb-2 px-0.5 text-xs text-muted-foreground">
          Stripe color on the week calendar
        </p>
        <div
          className="grid gap-1"
          style={{
            gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
          }}
        >
          {COURSE_COLOR_GRID.flatMap((row, ri) =>
            row.map((hex, ci) => {
              const picked = hex.toLowerCase() === current;
              return (
                <button
                  key={`${ri}-${ci}`}
                  type="button"
                  className={cn(
                    "aspect-square min-h-6 min-w-0 rounded-md border border-border/60 outline-none transition-transform hover:scale-105 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40",
                    picked &&
                      "ring-2 ring-foreground ring-offset-1 ring-offset-popover",
                  )}
                  style={{ backgroundColor: hex }}
                  aria-label={`Set course color ${hex}`}
                  aria-pressed={picked}
                  onClick={() => {
                    onPick(hex);
                    setOpen(false);
                  }}
                />
              );
            }),
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const PlannerCourseColorPicker = memo(PlannerCourseColorPickerInner);
