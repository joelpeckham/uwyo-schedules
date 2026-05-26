"use client";

import { memo, type RefObject } from "react";
import { DragLayer } from "./DragLayer";
import type { CourseDragSession } from "./course-drag";
import { WeekCalendarView, type WeekCalendarViewProps } from "./WeekCalendarView";

type WeekCalendarGridProps = WeekCalendarViewProps & {
  hScrollRef?: RefObject<HTMLDivElement | null>;
  courseDragSession?: CourseDragSession | null;
  dragFloatRef?: RefObject<HTMLDivElement | null>;
};

function WeekCalendarGridInner({
  hScrollRef,
  courseDragSession = null,
  dragFloatRef,
  ...viewProps
}: WeekCalendarGridProps) {
  return (
    <div ref={hScrollRef} className="overflow-x-auto">
      <WeekCalendarView
        {...viewProps}
        viewportFloatingOverlay={
          dragFloatRef != null ? (
            <DragLayer
              active={courseDragSession != null}
              session={courseDragSession}
              floatRef={dragFloatRef}
            />
          ) : undefined
        }
      />
    </div>
  );
}

export const WeekCalendarGrid = memo(WeekCalendarGridInner);
