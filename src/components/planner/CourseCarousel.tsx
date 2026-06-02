"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  computePlannerCreditHours,
  formatCreditHours,
} from "@/lib/planner/credit-hours";
import { parseInstructorPrefs } from "@/lib/planner/instructor-prefs";
import {
  activeScheduleFilterPills,
  defaultScheduleFilterValue,
} from "@/lib/planner/schedule-filters";
import { parseSectionPinsJson } from "@/lib/planner/section-pins";
import { courseDisplayTitle } from "@/lib/planner/course-display-title";
import { plannerCourseCardInteractive } from "@/lib/planner/planner-interactive-surface";
import { usePlannerViewSettings } from "@/lib/planner/planner-view-settings";
import { PlannerCourseColorPicker } from "@/components/planner/PlannerCourseColorPicker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Settings, X } from "lucide-react";
import { usePlannerData, usePlannerSolve } from "./PlannerContext";
import {
  NotOnGridSubsection,
  useNotOnGridRailRows,
} from "./NotOnGridRail";
import {
  carouselRevealContainer,
  carouselRevealInstant,
  carouselRevealItem,
} from "./motion/planner-motion";

type Props = {
  onOpenCourseSettings: (itemId: number) => void;
  onCrnActivate: (crn: string) => void;
};

type CarouselConstraintPillProps = {
  label: string;
  variant?: "primary" | "muted";
  dismissLabel: string;
  onOpenSettings: () => void;
  onDismiss?: () => void;
};

function CarouselConstraintPill({
  label,
  variant = "primary",
  dismissLabel,
  onOpenSettings,
  onDismiss,
}: CarouselConstraintPillProps) {
  const pillClass = cn(
    "inline-flex max-w-full items-center gap-0.5 rounded-md border py-0.5 pl-1.5 text-[10px] font-medium transition-[background-color,border-color,opacity] duration-150",
    onDismiss ? "cursor-pointer pr-1" : "pr-1.5",
    variant === "primary"
      ? "border-primary/40 bg-primary/10 text-primary"
      : "border-border bg-muted/40 text-muted-foreground",
    onDismiss &&
      "[@media(hover:hover)]:hover:border-transparent [@media(hover:hover)]:hover:bg-transparent [@media(hover:hover)]:hover:opacity-50",
  );

  if (onDismiss) {
    return (
      <button
        type="button"
        className={pillClass}
        aria-label={dismissLabel}
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
      >
        <span className="min-w-0 truncate">{label}</span>
        <X className="size-2.5 shrink-0 opacity-80" aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={pillClass}
      onClick={(e) => {
        e.stopPropagation();
        onOpenSettings();
      }}
    >
      <span className="truncate">{label}</span>
    </button>
  );
}

export function CourseCarousel({ onOpenCourseSettings, onCrnActivate }: Props) {
  const {
    plannerItems,
    catalog,
    removePlannerItem,
    updatePlannerItem,
    updateItemScheduleFilters,
    clearSectionPins,
    clearInstructorPrefs,
  } = usePlannerData();
  const { effectivePlannerItems, calendarBlocks } = usePlannerSolve();
  const { courseCarouselExpanded, setCourseCarouselExpanded } =
    usePlannerViewSettings();
  const offGridRows = useNotOnGridRailRows();
  const reducedMotion = useReducedMotion() ?? false;

  const revealState = courseCarouselExpanded ? "visible" : "hidden";
  const itemVariants =
    reducedMotion || !courseCarouselExpanded
      ? carouselRevealInstant
      : carouselRevealItem;
  const containerVariants =
    reducedMotion || !courseCarouselExpanded
      ? carouselRevealInstant
      : carouselRevealContainer;
  const CardTag = reducedMotion ? "article" : motion.article;
  const CardTrackTag = reducedMotion ? "div" : motion.div;

  const summaryText = useMemo(() => {
    const total = plannerItems.length;
    if (total === 0) return "No courses yet";
    const credits = computePlannerCreditHours(
      effectivePlannerItems,
      calendarBlocks,
      catalog.sections,
    );
    const courseLabel = `${total} course${total === 1 ? "" : "s"}`;
    const offGridLabel =
      offGridRows.length > 0
        ? ` · ${offGridRows.length} off grid`
        : "";
    if (credits <= 0) return `${courseLabel}${offGridLabel}`;
    return `${courseLabel} · ${formatCreditHours(credits)}${offGridLabel}`;
  }, [
    plannerItems.length,
    effectivePlannerItems,
    calendarBlocks,
    catalog.sections,
    offGridRows.length,
  ]);

  if (plannerItems.length === 0) return null;

  return (
    <section
      id="planner-courses"
      className="scroll-mt-20 rounded-xl border border-border bg-card text-card-foreground shadow-sm"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left transition-colors duration-200 hover:bg-muted/40 sm:px-4"
        aria-expanded={courseCarouselExpanded}
        aria-controls="planner-course-carousel-track"
        onClick={() => setCourseCarouselExpanded(!courseCarouselExpanded)}
      >
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-medium text-foreground">
            Your courses
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{summaryText}</p>
        </div>
        {courseCarouselExpanded ? (
          <ChevronDown
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200"
            aria-hidden
          />
        ) : (
          <ChevronRight
            className="size-4 shrink-0 text-muted-foreground transition-transform duration-200"
            aria-hidden
          />
        )}
      </button>

      <div
        id="planner-course-carousel-track"
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out",
          courseCarouselExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <CardTrackTag
            {...(!reducedMotion
              ? {
                  variants: containerVariants,
                  animate: revealState,
                  initial: "hidden",
                }
              : {})}
            className="flex gap-2 overflow-x-auto px-3 py-3 snap-x snap-mandatory scroll-px-3 sm:px-4 sm:scroll-px-4"
          >
            {plannerItems.map((item) => {
              const prefs = parseInstructorPrefs(item.instructorPrefs);
              const primaryVal = prefs.primary[0]?.trim();
              const hasInstructor =
                primaryVal && primaryVal.length > 0;
              const pinnedCount = Object.keys(
                parseSectionPinsJson(item.sectionPins).byType,
              ).length;
              const filterPills = activeScheduleFilterPills(
                item.scheduleFilters,
              );
              const locked = item.selectionKind !== "unresolved";
              const openSettings = () => onOpenCourseSettings(item.id);
              const courseCode = `${item.subject} ${item.courseNumber}`;
              const courseTitle = courseDisplayTitle(
                catalog.sections,
                item.subject,
                item.courseNumber,
              );

              return (
                <CardTag
                  key={item.id}
                  id={`planner-course-${item.id}`}
                  {...(!reducedMotion
                    ? {
                        variants: itemVariants,
                      }
                    : {})}
                  className={cn(
                    "group relative flex w-52 shrink-0 snap-start flex-row overflow-hidden rounded-lg border border-border bg-muted/15 sm:w-60",
                    plannerCourseCardInteractive,
                  )}
                >
                  <div
                    className="flex min-w-0 flex-1 cursor-pointer flex-col p-2"
                    onClick={openSettings}
                  >
                    <div className="flex items-center gap-1.5">
                      <div
                        className="shrink-0"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <PlannerCourseColorPicker
                          variant="dot"
                          displayColor={item.displayColor}
                          onPick={(hex) =>
                            updatePlannerItem(item.id, { displayColor: hex })
                          }
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-heading text-sm font-semibold leading-snug text-foreground">
                          {courseTitle ?? courseCode}
                        </span>
                        {courseTitle ? (
                          <span className="block truncate font-mono text-xs leading-snug text-muted-foreground">
                            {courseCode}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-1.5 flex min-h-6 flex-wrap content-start gap-1">
                    {hasInstructor ? (
                      <CarouselConstraintPill
                        label={primaryVal}
                        dismissLabel={`Clear instructor preference for ${courseCode}`}
                        onOpenSettings={openSettings}
                        onDismiss={
                          locked
                            ? undefined
                            : () => clearInstructorPrefs(item.id)
                        }
                      />
                    ) : null}
                    {pinnedCount > 0 ? (
                      <CarouselConstraintPill
                        label={`${pinnedCount} pinned`}
                        dismissLabel={`Clear pinned sections for ${courseCode}`}
                        onOpenSettings={openSettings}
                        onDismiss={
                          locked
                            ? undefined
                            : () => clearSectionPins(item.id)
                        }
                      />
                    ) : null}
                    {filterPills.map((pill) => (
                      <CarouselConstraintPill
                        key={pill.key}
                        label={pill.label}
                        variant="muted"
                        dismissLabel={`Re-enable ${pill.label} filter for ${courseCode}`}
                        onOpenSettings={openSettings}
                        onDismiss={
                          locked
                            ? undefined
                            : () =>
                                updateItemScheduleFilters(item.id, {
                                  [pill.key]: defaultScheduleFilterValue(
                                    pill.key,
                                  ),
                                })
                        }
                      />
                    ))}
                    {locked ? (
                      <CarouselConstraintPill
                        label="Locked"
                        variant="muted"
                        dismissLabel=""
                        onOpenSettings={openSettings}
                      />
                    ) : null}
                    </div>
                  </div>
                  <div className="flex w-9 shrink-0 flex-col items-center justify-between self-stretch border-l border-border py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground"
                      aria-label={`Remove ${courseCode}`}
                      onClick={() => removePlannerItem(item.id)}
                    >
                      <X className="size-3.5" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground"
                      aria-label={`Settings for ${courseCode}`}
                      onClick={openSettings}
                    >
                      <Settings className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                </CardTag>
              );
            })}
          </CardTrackTag>
          <NotOnGridSubsection
            rows={offGridRows}
            onCrnActivate={onCrnActivate}
            revealExpanded={courseCarouselExpanded}
            revealStartIndex={plannerItems.length}
            revealItemVariants={reducedMotion ? undefined : itemVariants}
            reducedMotion={reducedMotion}
          />
        </div>
      </div>
    </section>
  );
}
