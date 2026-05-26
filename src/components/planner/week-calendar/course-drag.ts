import type { CalendarBlock, SwapGhostMeeting } from "@/lib/planner/data";

/** In-flight course-block drag; float position updated imperatively between snaps. */
export type CourseDragSession = {
  block: CalendarBlock;
  pointerId: number;
  clientX: number;
  clientY: number;
  grabDx: number;
  grabDy: number;
  ghosts: SwapGhostMeeting[];
  snapped: SwapGhostMeeting | null;
  floatStyle: { left: number; top: number; width: number; height: number };
};

export function applyCourseDragFloatStyle(
  el: HTMLDivElement | null,
  sess: CourseDragSession,
): void {
  if (!el) return;
  const fs = sess.floatStyle;
  el.style.left = `${fs.left}px`;
  el.style.top = `${fs.top}px`;
  el.style.width = `${fs.width}px`;
  el.style.height = `${fs.height}px`;
  el.style.borderLeftColor = sess.block.color;
}

export function courseDragSnapKey(
  snapped: SwapGhostMeeting | null,
): string | null {
  if (!snapped) return null;
  return `${snapped.crn}:${snapped.meetingId}:${snapped.dayIndex}:${snapped.startMinutes}`;
}
