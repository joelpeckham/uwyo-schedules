"use client";

import { memo, useEffect, type RefObject } from "react";
import {
  applyCourseDragFloatStyle,
  type CourseDragSession,
} from "./course-drag";

type DragLayerProps = {
  active: boolean;
  session: CourseDragSession | null;
  floatRef: RefObject<HTMLDivElement | null>;
};

/** Fixed-position drag preview; position updates imperatively between React commits. */
function DragLayerInner({ active, session, floatRef }: DragLayerProps) {
  useEffect(() => {
    if (!active || !session) return;
    applyCourseDragFloatStyle(floatRef.current, session);
  }, [active, session, floatRef]);

  if (!active || !session) return null;

  return (
    <div
      ref={floatRef}
      className="pointer-events-none fixed z-[60] overflow-hidden rounded-md border border-border bg-card/95 py-1.5 pr-1 pl-2 shadow-lg backdrop-blur-sm"
      style={{
        left: session.floatStyle.left,
        top: session.floatStyle.top,
        width: session.floatStyle.width,
        height: session.floatStyle.height,
        borderLeftWidth: 4,
        borderLeftColor: session.block.color,
      }}
      aria-hidden
    >
      <span className="line-clamp-3 font-mono text-[10px] font-medium leading-tight text-foreground">
        {session.block.label}
      </span>
      {session.block.sublabel.trim() ? (
        <span className="line-clamp-2 font-mono text-[9px] text-muted-foreground">
          {session.block.sublabel}
        </span>
      ) : null}
    </div>
  );
}

export const DragLayer = memo(DragLayerInner);
