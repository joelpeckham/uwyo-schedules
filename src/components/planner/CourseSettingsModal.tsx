"use client";

import { ChevronDown } from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";
import {
  INSTRUCTOR_SELECT_ANY,
  linkedScheduleTypeRows,
  primaryInstructorOptions,
} from "@/lib/planner/instructor-options-from-pack";
import {
  parseInstructorPrefs,
  serializeInstructorPrefs,
  type InstructorPrefsV1,
} from "@/lib/planner/instructor-prefs";
import {
  parseItemScheduleFilters,
  serializeItemScheduleFilters,
} from "@/lib/planner/schedule-filters";
import { parseSectionPinsJson } from "@/lib/planner/section-pins";
import {
  courseSolvePackCourseKey,
} from "@/lib/planner/solve-schedules-core";
import { courseDisplayTitle } from "@/lib/planner/course-display-title";
import { track } from "@/lib/analytics/track";
import { PlannerCourseColorPicker } from "@/components/planner/PlannerCourseColorPicker";
import { CourseSectionPicker } from "@/components/planner/CourseSectionPicker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { usePlannerData, usePlannerSolve } from "./PlannerContext";

export type CourseSettingsPanel = "filters" | "professors" | "sections";

const PANELS: { id: CourseSettingsPanel; label: string }[] = [
  { id: "filters", label: "Filters" },
  { id: "professors", label: "Professors" },
  { id: "sections", label: "Sections" },
];

type Props = {
  itemId: number | null;
  initialPanel?: CourseSettingsPanel;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function primarySelectValue(p: InstructorPrefsV1): string {
  const n = p.primary[0]?.trim();
  return n && n.length > 0 ? n : INSTRUCTOR_SELECT_ANY;
}

function linkedSelectValue(p: InstructorPrefsV1, scheduleTypeKey: string): string {
  const n = p.byScheduleType?.[scheduleTypeKey]?.[0]?.trim();
  return n && n.length > 0 ? n : INSTRUCTOR_SELECT_ANY;
}

function mergeOptionList(canonical: string[], current: string): string[] {
  const cur = current.trim();
  if (cur.length === 0 || cur === INSTRUCTOR_SELECT_ANY) return canonical;
  const lower = new Set(canonical.map((s) => s.toLowerCase()));
  if (lower.has(cur.toLowerCase())) return canonical;
  return [cur, ...canonical];
}

function FilterSwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const labelId = useId();
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/15 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <label
          id={labelId}
          htmlFor={id}
          className={cn(
            "block text-sm text-foreground",
            !disabled && "cursor-pointer",
          )}
        >
          {label}
        </label>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
      <Switch
        id={id}
        aria-labelledby={labelId}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        className="mt-0.5 shrink-0 touch-manipulation"
      />
    </div>
  );
}

export function CourseSettingsModal({
  itemId,
  initialPanel = "filters",
  open,
  onOpenChange,
}: Props) {
  const {
    plannerItems,
    catalog,
    solvePacks,
    updatePlannerItem,
    updateItemScheduleFilters,
    applyScheduleFiltersToAll,
    toggleSectionPin,
  } = usePlannerData();
  const { scheduleRecalculateSolutions } = usePlannerSolve();

  const [panel, setPanel] = useState<CourseSettingsPanel>(initialPanel);
  const [advancedOpen, setAdvancedOpen] = useState(true);

  const item = useMemo(
    () => plannerItems.find((r) => r.id === itemId) ?? null,
    [plannerItems, itemId],
  );

  const pack = useMemo(() => {
    if (!item) return undefined;
    const key = courseSolvePackCourseKey(item.subject, item.courseNumber);
    return solvePacks[key];
  }, [item, solvePacks]);

  const courseTitle = useMemo(() => {
    if (!item) return null;
    return courseDisplayTitle(
      catalog.sections,
      item.subject,
      item.courseNumber,
    );
  }, [catalog.sections, item]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) setPanel(initialPanel);
      onOpenChange(next);
    },
    [initialPanel, onOpenChange],
  );

  const locked = item?.selectionKind !== "unresolved";

  const persistPrefs = useCallback(
    (prefs: InstructorPrefsV1) => {
      if (!item) return;
      updatePlannerItem(item.id, {
        instructorPrefs: serializeInstructorPrefs(prefs),
      });
      scheduleRecalculateSolutions();
    },
    [item, updatePlannerItem, scheduleRecalculateSolutions],
  );

  const setPrimaryInstructor = useCallback(
    (value: string) => {
      if (!item) return;
      const p = parseInstructorPrefs(item.instructorPrefs);
      const primary =
        value === INSTRUCTOR_SELECT_ANY
          ? []
          : [value.trim()].filter(Boolean);
      persistPrefs({
        v: 1,
        primary,
        byScheduleType: p.byScheduleType,
      });
      track("planner_instructor_pref_set", {
        kind: "primary",
        choseAny: value === INSTRUCTOR_SELECT_ANY,
      });
    },
    [item, persistPrefs],
  );

  const setLinkedInstructor = useCallback(
    (scheduleTypeKey: string, value: string) => {
      if (!item) return;
      const p = parseInstructorPrefs(item.instructorPrefs);
      const nextBy: Record<string, string[]> = { ...(p.byScheduleType ?? {}) };
      if (value === INSTRUCTOR_SELECT_ANY) {
        delete nextBy[scheduleTypeKey];
      } else {
        nextBy[scheduleTypeKey] = [value.trim()].filter(Boolean);
      }
      const keys = Object.keys(nextBy);
      persistPrefs({
        v: 1,
        primary: p.primary,
        byScheduleType: keys.length > 0 ? nextBy : undefined,
      });
      track("planner_instructor_pref_set", {
        kind: "linked",
        choseAny: value === INSTRUCTOR_SELECT_ANY,
      });
    },
    [item, persistPrefs],
  );

  if (!item) return null;

  const prefs = parseInstructorPrefs(item.instructorPrefs);
  const filters = parseItemScheduleFilters(item.scheduleFilters);
  const pinnedTypes = parseSectionPinsJson(item.sectionPins).byType;
  const pinnedCount = Object.keys(pinnedTypes).length;
  const primaryOpts = pack ? primaryInstructorOptions(pack) : [];
  const primaryVal = primarySelectValue(prefs);
  const primaryChoices = mergeOptionList(primaryOpts, primaryVal);
  const linkedRows = pack ? linkedScheduleTypeRows(pack) : [];

  const courseCode = `${item.subject} ${item.courseNumber}`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex w-full flex-col gap-0 overflow-hidden p-0 max-sm:left-0 max-sm:top-auto max-sm:bottom-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:h-[88vh] max-sm:max-h-[88vh] max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:data-open:slide-in-from-bottom-4 sm:h-[min(85vh,36rem)] sm:max-h-[min(85vh,36rem)] sm:max-w-lg"
        showCloseButton
      >
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-12">
          <div className="flex items-center gap-3">
            <PlannerCourseColorPicker
              variant="dot"
              displayColor={item.displayColor}
              disabled={false}
              onPick={(hex) => updatePlannerItem(item.id, { displayColor: hex })}
            />
            <div className="min-w-0">
              <DialogTitle className="font-heading text-xl font-semibold leading-snug">
                {courseTitle ?? courseCode}
              </DialogTitle>
              {courseTitle ? (
                <DialogDescription className="mt-0.5 font-mono text-sm text-muted-foreground">
                  {courseCode}
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">
                  Course settings for {courseCode}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <div
          role="tablist"
          aria-label="Course settings sections"
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-3 py-2"
        >
          {PANELS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={panel === p.id}
              aria-controls={`course-settings-panel-${p.id}`}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                panel === p.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
              onClick={() => setPanel(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-4 [-webkit-overflow-scrolling:touch]">
          {locked ? (
            <p className="mb-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              This course has locked CRNs. Filters, instructor picks, and section
              pins apply only while the planner is choosing sections for you.
            </p>
          ) : null}

          <div
            id="course-settings-panel-filters"
            role="tabpanel"
            aria-hidden={panel !== "filters"}
            className={cn("space-y-3", panel !== "filters" && "hidden")}
          >
              <p className="text-sm text-muted-foreground">
                These limits apply only to {item.subject} {item.courseNumber} when
                the planner picks sections.
              </p>
              <div className="flex flex-col gap-2">
                <FilterSwitchRow
                  id={`exclude-full-${item.id}`}
                  label="Exclude full"
                  description="Hide sections with no open seats."
                  checked={filters.requireOpenSections}
                  disabled={locked}
                  onCheckedChange={(next) => {
                    updateItemScheduleFilters(item.id, {
                      requireOpenSections: next,
                    });
                    track("planner_exclude_full_toggled", { on: next });
                  }}
                />
                <FilterSwitchRow
                  id={`exclude-tba-${item.id}`}
                  label="Exclude TBA times"
                  description="Hide sections without a set meeting time."
                  checked={filters.excludeTba}
                  disabled={locked}
                  onCheckedChange={(next) => {
                    updateItemScheduleFilters(item.id, { excludeTba: next });
                    track("planner_exclude_tba_toggled", { on: next });
                  }}
                />
                <FilterSwitchRow
                  id={`exclude-online-${item.id}`}
                  label="Exclude online · async"
                  description="Hide asynchronous online delivery."
                  checked={filters.excludeOnlineAsync}
                  disabled={locked}
                  onCheckedChange={(next) => {
                    updateItemScheduleFilters(item.id, {
                      excludeOnlineAsync: next,
                    });
                    track("planner_exclude_online_async_toggled", { on: next });
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                disabled={locked}
                onClick={() =>
                  applyScheduleFiltersToAll(serializeItemScheduleFilters(filters))
                }
              >
                Apply these filters to all courses
              </Button>
          </div>

          <div
            id="course-settings-panel-professors"
            role="tabpanel"
            aria-hidden={panel !== "professors"}
            className={cn("space-y-4", panel !== "professors" && "hidden")}
          >
              {!pack ? (
                <p className="text-sm text-muted-foreground">Loading sections…</p>
              ) : (
                <>
                  <div>
                    <Label
                      className="text-muted-foreground"
                      htmlFor={`modal-primary-${item.id}`}
                    >
                      Instructor (lecture)
                    </Label>
                    <Select
                      value={primaryVal}
                      onValueChange={setPrimaryInstructor}
                      disabled={locked}
                    >
                      <SelectTrigger
                        id={`modal-primary-${item.id}`}
                        className="mt-1 min-h-10 w-full font-mono text-sm"
                      >
                        <SelectValue placeholder="Choose instructor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={INSTRUCTOR_SELECT_ANY}>Any</SelectItem>
                        {primaryChoices.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {linkedRows.length > 0 ? (
                    <div>
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary"
                        aria-expanded={advancedOpen}
                        onClick={() => setAdvancedOpen((v) => !v)}
                      >
                        <ChevronDown
                          className={cn(
                            "size-4 shrink-0 transition-transform",
                            advancedOpen && "rotate-180",
                          )}
                          aria-hidden
                        />
                        {advancedOpen ? "Hide" : "Show"} linked labs and discussions
                      </button>
                      {advancedOpen ? (
                        <div className="mt-2 space-y-3 rounded-md border border-border/60 bg-muted/20 p-2">
                          {linkedRows.map((row) => {
                            const lv = linkedSelectValue(prefs, row.scheduleTypeKey);
                            const choices = mergeOptionList(
                              row.instructorOptions,
                              lv,
                            );
                            const fieldId = `modal-linked-${item.id}-${row.scheduleTypeKey}`;
                            return (
                              <div key={row.scheduleTypeKey} className="space-y-1">
                                <Label
                                  htmlFor={fieldId}
                                  className="text-xs text-muted-foreground"
                                >
                                  Instructor ({row.label})
                                </Label>
                                <Select
                                  value={lv}
                                  onValueChange={(v) =>
                                    setLinkedInstructor(row.scheduleTypeKey, v)
                                  }
                                  disabled={locked}
                                >
                                  <SelectTrigger
                                    id={fieldId}
                                    className="min-h-10 w-full font-mono text-sm"
                                  >
                                    <SelectValue placeholder="Choose instructor" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={INSTRUCTOR_SELECT_ANY}>
                                      Any
                                    </SelectItem>
                                    {choices.map((name) => (
                                      <SelectItem key={name} value={name}>
                                        {name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
          </div>

          <div
            id="course-settings-panel-sections"
            role="tabpanel"
            aria-hidden={panel !== "sections"}
            className={cn("space-y-2", panel !== "sections" && "hidden")}
          >
              {pinnedCount > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {pinnedCount} section type{pinnedCount === 1 ? "" : "s"} pinned
                </p>
              ) : null}
              {!pack ? (
                <p className="text-sm text-muted-foreground">Loading sections…</p>
              ) : (
                <CourseSectionPicker
                  item={item}
                  pack={pack}
                  catalog={catalog}
                  onTogglePin={toggleSectionPin}
                  disabled={locked}
                />
              )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
