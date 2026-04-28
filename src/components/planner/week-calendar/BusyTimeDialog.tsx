"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type BusyTimeOption = { value: number; label: string };

type BusyTimeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, "Remove" button is shown to delete the existing blackout. */
  editingId: string | null;
  dayIndex: number;
  startMin: number;
  endMin: number;
  label: string;
  timeOptions: readonly BusyTimeOption[];
  onDayChange: (dayIndex: number) => void;
  onStartChange: (startMin: number) => void;
  onEndChange: (endMin: number) => void;
  onLabelChange: (label: string) => void;
  onRemove: () => void;
  onCancel: () => void;
  onSave: () => void;
};

/**
 * Dialog for creating or editing a busy-time blackout.
 *
 * Pulled out of `WeekCalendar` so the calendar surface doesn't re-render
 * when the user types into the label input or changes a select. Form state
 * still lives in the parent so the calendar can pre-fill it from a drag.
 */
export function BusyTimeDialog({
  open,
  onOpenChange,
  editingId,
  dayIndex,
  startMin,
  endMin,
  label,
  timeOptions,
  onDayChange,
  onStartChange,
  onEndChange,
  onLabelChange,
  onRemove,
  onCancel,
  onSave,
}: BusyTimeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(32rem,90vh)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit busy time</DialogTitle>
          <DialogDescription>
            Block times you are not available (work, commute, etc.). The
            planner avoids these intervals when building your week.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid gap-2">
            <Label htmlFor="busy-day">Day</Label>
            <Select
              value={String(dayIndex)}
              onValueChange={(v) => onDayChange(Number(v))}
            >
              <SelectTrigger
                id="busy-day"
                className="min-h-11 w-full touch-manipulation"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_LABELS.map((dayLabel, di) => (
                  <SelectItem key={di} value={String(di)}>
                    {dayLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-2">
              <Label htmlFor="busy-start">Starts</Label>
              <Select
                value={String(startMin)}
                onValueChange={(v) => onStartChange(Number(v))}
              >
                <SelectTrigger
                  id="busy-start"
                  className="min-h-11 w-full touch-manipulation"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {timeOptions.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="busy-end">Ends</Label>
              <Select
                value={String(endMin)}
                onValueChange={(v) => onEndChange(Number(v))}
              >
                <SelectTrigger
                  id="busy-end"
                  className="min-h-11 w-full touch-manipulation"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {timeOptions.map((o) => (
                    <SelectItem key={o.value} value={String(o.value)}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="busy-label">Label (optional)</Label>
            <Input
              id="busy-label"
              className="min-h-11 touch-manipulation"
              maxLength={80}
              placeholder="e.g. Work"
              value={label}
              onChange={(e) => onLabelChange(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {editingId ? (
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 w-full touch-manipulation sm:w-auto"
              onClick={onRemove}
            >
              Remove
            </Button>
          ) : null}
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 touch-manipulation"
              onClick={onCancel}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="min-h-11 touch-manipulation"
              onClick={onSave}
            >
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
