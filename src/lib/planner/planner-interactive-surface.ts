import { cn } from "@/lib/utils";

/** 200ms border/bg/shadow transition, focus ring, and design-system press. */
const plannerInteractiveBase =
  "transition-[border-color,background-color,box-shadow] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:active:translate-y-px";

/** Carousel course cards (muted base background). */
export const plannerCourseCardInteractive = cn(
  plannerInteractiveBase,
  "hover:border-primary/40 hover:bg-muted/30 hover:shadow-sm",
);

/** Off-grid section list rows. */
export const plannerListRowInteractive = cn(
  plannerInteractiveBase,
  "hover:border-primary/40 hover:bg-muted/40 hover:shadow-sm",
);

/** Calendar grid blocks — hover only on pointer devices; no emphasis while dimmed. */
export const plannerGridBlockInteractive = cn(
  plannerInteractiveBase,
  "[@media(hover:hover)]:hover:border-primary/35 [@media(hover:hover)]:hover:shadow-md",
  "opacity-35:hover:border-border opacity-35:hover:shadow-sm",
);
