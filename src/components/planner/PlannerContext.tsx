"use client";

import {
  loadPlannerCatalogBootstrapAction,
  prefetchCourseSolvePackAction,
  savePlannerBlackoutsAction,
  solveSchedulesAction,
  syncPlannerStateAction,
} from "@/app/planner/actions";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import { buildCalendarBlocksFromCatalog } from "@/lib/planner/client/derive";
import {
  blackoutsDocToTimeIntervals,
  type PlannerBlackoutsDocV1,
} from "@/lib/planner/blackouts";
import { computeInfeasibilityHints } from "@/lib/planner/infeasibility-hints";
import { mergePackConstraintMaps } from "@/lib/planner/planner-swap-feasibility";
import type { CalendarBlock, PlannerItemRow } from "@/lib/planner/data";
import {
  EMPTY_SECTION_PINS,
  parseSectionPinsJson,
} from "@/lib/planner/section-pins";
import type { ResolvedPlannerSelection } from "@/lib/planner/resolve-display-crns-shared";
import {
  courseSolvePackCourseKey,
  everyPlannerItemHasSolvePack,
  plannerItemsAdmitAtLeastOneSchedule,
  scheduleSolutionStillValidForItems,
  solveSchedulesFromPacks,
  type CourseSolvePack,
  type ScheduleSolution,
} from "@/lib/planner/solve-schedules-core";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const PERSIST_DEBOUNCE_MS = 2500;
const BLACKOUT_PERSIST_DEBOUNCE_MS = 800;
const PACK_PREFETCH_DEBOUNCE_MS = 400;
/** Single best schedule for the interactive planner (no paging). */
const PLANNER_MAX_SOLUTIONS = 1 as const;

const EMPTY_BLACKOUTS: PlannerBlackoutsDocV1 = { v: 1, items: [] };

function applySolutionToPlannerItems(
  items: PlannerItemRow[],
  solution: ScheduleSolution | null,
): PlannerItemRow[] {
  if (!solution) return items;
  return items.map((row) => {
    const sel: ResolvedPlannerSelection | undefined =
      solution.selections[row.id];
    if (!sel) return row;
    return {
      ...row,
      selectionKind: sel.selectionKind,
      anchorCrn: sel.anchorCrn,
      linkedBundleId: sel.linkedBundleId,
    };
  });
}

type PlannerContextValue = {
  termCode: string;
  plannerItems: PlannerItemRow[];
  catalog: PlannerCatalogJson;
  /** Calendar reflects the best solution preview merged in memory. */
  effectivePlannerItems: PlannerItemRow[];
  calendarBlocks: CalendarBlock[];
  syncError: string | null;
  clearSyncError: () => void;
  /** Set when a pin or section change would leave no valid full schedule (client packs only). */
  scheduleFeasibilityError: string | null;
  clearScheduleFeasibilityError: () => void;
  refreshCatalogFromServer: () => Promise<boolean>;
  setPlannerItems: (items: PlannerItemRow[]) => void;
  removePlannerItem: (id: number) => void;
  updatePlannerItem: (id: number, patch: Partial<PlannerItemRow>) => void;
  schedulePersist: () => void;
  /** Pin or unpin this schedule-type slice (lecture vs lab vs discussion) for an auto row. */
  toggleSectionPin: (itemId: number, scheduleTypeKey: string, sectionCrn: string) => void;
  /** After a validated same-type drag, persist only that type's CRN pin. */
  setSectionPinFromDrag: (
    itemId: number,
    scheduleTypeKey: string,
    sectionCrn: string,
  ) => void;
  /** Set full section selection (legacy resolved rows). */
  applyPlannerItemSelection: (
    itemId: number,
    sel: ResolvedPlannerSelection,
  ) => void;
  solutions: ScheduleSolution[];
  solutionsCapped: boolean;
  solutionsTimedOut: boolean;
  /** Hints when no schedule fits (requires complete solve packs). */
  infeasibilityHints: string[];
  requireOpenSections: boolean;
  setRequireOpenSections: (v: boolean) => void;
  recalculateSolutions: (requireOpenOverride?: boolean) => Promise<void>;
  /** True while a server or client solve is in progress (nested calls supported). */
  isRecalculatingSolutions: boolean;
  /** Prefetched per-course solve payloads (client-side DFS when complete). */
  solvePacks: Record<string, CourseSolvePack>;
  mergeSolvePack: (pack: CourseSolvePack) => void;
  /** Merged seats/faculty/schedule-type maps from solve packs (swap feasibility). */
  mergedPackConstraintMaps: ReturnType<typeof mergePackConstraintMaps>;
  blackouts: PlannerBlackoutsDocV1;
  setBlackouts: (
    doc:
      | PlannerBlackoutsDocV1
      | ((prev: PlannerBlackoutsDocV1) => PlannerBlackoutsDocV1),
  ) => void;
};

const PlannerContext = createContext<PlannerContextValue | null>(null);

type ProviderProps = {
  termCode: string;
  initialPlannerItems: PlannerItemRow[];
  initialCatalog: PlannerCatalogJson;
  initialTermUiState: {
    blackouts: PlannerBlackoutsDocV1;
  } | null;
  children: React.ReactNode;
};

export function PlannerProvider({
  termCode,
  initialPlannerItems,
  initialCatalog,
  initialTermUiState,
  children,
}: ProviderProps) {
  const [plannerItems, setPlannerItems] =
    useState<PlannerItemRow[]>(initialPlannerItems);
  const [catalog, setCatalog] = useState<PlannerCatalogJson>(initialCatalog);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [scheduleFeasibilityError, setScheduleFeasibilityError] = useState<
    string | null
  >(null);

  const [solutions, setSolutions] = useState<ScheduleSolution[]>([]);
  const [solutionsCapped, setSolutionsCapped] = useState(false);
  const [solutionsTimedOut, setSolutionsTimedOut] = useState(false);
  const [requireOpenSections, setRequireOpenSections] = useState(true);
  const [blackouts, setBlackoutsState] = useState<PlannerBlackoutsDocV1>(
    () => initialTermUiState?.blackouts ?? EMPTY_BLACKOUTS,
  );
  const [solvePacks, setSolvePacks] = useState<Record<string, CourseSolvePack>>(
    {},
  );
  const [isRecalculatingSolutions, setIsRecalculatingSolutions] = useState(false);
  const recalcDepthRef = useRef(0);
  /** Bumps on each recalc start so stale async/server results cannot overwrite newer solves. */
  const recalcGenRef = useRef(0);
  const solvePacksRef = useRef(solvePacks);
  useEffect(() => {
    solvePacksRef.current = solvePacks;
  }, [solvePacks]);

  const mergeSolvePack = useCallback((pack: CourseSolvePack) => {
    solvePacksRef.current = { ...solvePacksRef.current, [pack.courseKey]: pack };
    setSolvePacks(solvePacksRef.current);
  }, []);

  const solutionsRef = useRef(solutions);
  useEffect(() => {
    solutionsRef.current = solutions;
  }, [solutions]);

  useEffect(() => {
    queueMicrotask(() => {
      setPlannerItems(initialPlannerItems);
    });
  }, [initialPlannerItems]);

  useEffect(() => {
    queueMicrotask(() => {
      setCatalog(initialCatalog);
    });
  }, [initialCatalog]);

  useEffect(() => {
    queueMicrotask(() => {
      solvePacksRef.current = {};
      setSolvePacks({});
    });
  }, [termCode]);

  const itemsRef = useRef(plannerItems);
  const termRef = useRef(termCode);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistInFlightRef = useRef(false);
  const blackoutPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const blackoutPersistInFlightRef = useRef(false);
  const requireOpenRef = useRef(requireOpenSections);
  const blackoutsRef = useRef(blackouts);

  useEffect(() => {
    itemsRef.current = plannerItems;
  }, [plannerItems]);
  useEffect(() => {
    termRef.current = termCode;
  }, [termCode]);
  useEffect(() => {
    requireOpenRef.current = requireOpenSections;
  }, [requireOpenSections]);
  useEffect(() => {
    blackoutsRef.current = blackouts;
  }, [blackouts]);

  const effectivePlannerItems = useMemo(() => {
    const sol = solutions[0] ?? null;
    return applySolutionToPlannerItems(plannerItems, sol);
  }, [plannerItems, solutions]);

  const calendarBlocks = useMemo(
    () => buildCalendarBlocksFromCatalog(effectivePlannerItems, catalog),
    [effectivePlannerItems, catalog],
  );

  const mergedPackConstraintMaps = useMemo(
    () => mergePackConstraintMaps(solvePacks),
    [solvePacks],
  );

  const infeasibilityHints = useMemo(() => {
    if (solutions.length > 0 || plannerItems.length === 0) return [];
    if (!everyPlannerItemHasSolvePack(plannerItems, solvePacks)) return [];
    return computeInfeasibilityHints({
      items: plannerItems,
      packs: solvePacks,
      blackouts,
      requireOpenSections,
      catalog,
    });
  }, [
    solutions.length,
    plannerItems,
    solvePacks,
    blackouts,
    requireOpenSections,
    catalog,
  ]);

  const flushPersist = useCallback(async () => {
    const t = termRef.current;
    const rows = itemsRef.current;
    if (persistInFlightRef.current) return;
    persistInFlightRef.current = true;
    try {
      const res = await syncPlannerStateAction(t, rows);
      if (!res.ok) setSyncError(res.error);
      else setSyncError(null);
    } finally {
      persistInFlightRef.current = false;
    }
  }, []);

  const flushBlackoutPersist = useCallback(async () => {
    const t = termRef.current;
    if (blackoutPersistInFlightRef.current) return;
    blackoutPersistInFlightRef.current = true;
    try {
      const res = await savePlannerBlackoutsAction({
        termCode: t,
        items: blackoutsRef.current.items,
      });
      if (!res.ok) setSyncError(res.error);
      else setSyncError(null);
    } finally {
      blackoutPersistInFlightRef.current = false;
    }
  }, []);

  const schedulePersist = useCallback(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      void flushPersist();
    }, PERSIST_DEBOUNCE_MS);
  }, [flushPersist]);

  const scheduleBlackoutPersist = useCallback(() => {
    if (blackoutPersistTimerRef.current) {
      clearTimeout(blackoutPersistTimerRef.current);
    }
    blackoutPersistTimerRef.current = setTimeout(() => {
      blackoutPersistTimerRef.current = null;
      void flushBlackoutPersist();
    }, BLACKOUT_PERSIST_DEBOUNCE_MS);
  }, [flushBlackoutPersist]);

  const clearSyncError = useCallback(() => setSyncError(null), []);

  const clearScheduleFeasibilityError = useCallback(
    () => setScheduleFeasibilityError(null),
    [],
  );

  const setPlannerItemsFromContext = useCallback(
    (items: PlannerItemRow[]) => {
      itemsRef.current = items;
      setPlannerItems(items);
      schedulePersist();
    },
    [schedulePersist],
  );

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        if (persistTimerRef.current) {
          clearTimeout(persistTimerRef.current);
          persistTimerRef.current = null;
        }
        if (blackoutPersistTimerRef.current) {
          clearTimeout(blackoutPersistTimerRef.current);
          blackoutPersistTimerRef.current = null;
        }
        void flushPersist();
        void flushBlackoutPersist();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [flushPersist, flushBlackoutPersist]);

  useEffect(() => {
    const onLeave = () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      if (blackoutPersistTimerRef.current) {
        clearTimeout(blackoutPersistTimerRef.current);
        blackoutPersistTimerRef.current = null;
      }
      void flushPersist();
      void flushBlackoutPersist();
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [flushPersist, flushBlackoutPersist]);

  const refreshCatalogFromServer = useCallback(async (): Promise<boolean> => {
    const res = await loadPlannerCatalogBootstrapAction(termCode);
    if (!res.ok) {
      setSyncError(res.error);
      return false;
    }
    setPlannerItems(res.plannerItems);
    setCatalog(res.catalog);
    setSolutions([]);
    const nextBlackouts = res.termUiState?.blackouts ?? EMPTY_BLACKOUTS;
    blackoutsRef.current = nextBlackouts;
    setBlackoutsState(nextBlackouts);
    setSyncError(null);
    return true;
  }, [termCode]);

  const removePlannerItem = useCallback((id: number) => {
    let next: PlannerItemRow[] = [];
    setPlannerItems((prev) => {
      next = prev.filter((r) => r.id !== id);
      itemsRef.current = next;
      return next;
    });
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    // Never call server actions inside a setState updater — updaters run during
    // render and Next.js can touch Router synchronously when starting an action.
    queueMicrotask(() => {
      void (async () => {
        const res = await syncPlannerStateAction(termRef.current, next);
        if (!res.ok) setSyncError(res.error);
        else setSyncError(null);
      })();
    });
  }, []);

  const updatePlannerItem = useCallback(
    (id: number, patch: Partial<PlannerItemRow>) => {
      setPlannerItems((prev) => {
        const next = prev.map((r) =>
          r.id === id ? { ...r, ...patch } : r,
        );
        itemsRef.current = next;
        return next;
      });
      schedulePersist();
    },
    [schedulePersist],
  );

  const recalculateSolutions = useCallback(async (requireOpenOverride?: boolean) => {
    const myGen = ++recalcGenRef.current;
    recalcDepthRef.current += 1;
    if (recalcDepthRef.current === 1) setIsRecalculatingSolutions(true);
    try {
      const requireOpen =
        requireOpenOverride !== undefined
          ? requireOpenOverride
          : requireOpenRef.current;
      const rows = itemsRef.current;
      const packs = solvePacksRef.current;

      if (rows.length === 0) {
        if (myGen === recalcGenRef.current) {
          setSyncError(null);
          setSolutions([]);
          setSolutionsCapped(false);
          setSolutionsTimedOut(false);
        }
        return;
      }

      const blackoutIv = blackoutsDocToTimeIntervals(blackoutsRef.current);
      const prevSol = solutionsRef.current[0] ?? null;
      const prevSelections = prevSol?.selections ?? null;

      if (everyPlannerItemHasSolvePack(rows, packs)) {
        if (
          prevSol &&
          scheduleSolutionStillValidForItems(rows, packs, prevSol, {
            requireOpenSections: requireOpen,
            blackoutIntervals: blackoutIv,
          })
        ) {
          if (myGen !== recalcGenRef.current) return;
          setSyncError(null);
          setSolutions([prevSol]);
          setSolutionsCapped(false);
          setSolutionsTimedOut(false);
          return;
        }

        const result = solveSchedulesFromPacks(rows, packs, {
          requireOpenSections: requireOpen,
          blackoutIntervals: blackoutIv,
          maxSolutions: PLANNER_MAX_SOLUTIONS,
          previousSelections: prevSelections,
        });
        if (myGen !== recalcGenRef.current) return;
        setSyncError(null);
        setSolutions(result.solutions);
        setSolutionsCapped(result.capped);
        setSolutionsTimedOut(result.timedOut);
        return;
      }

      const res = await solveSchedulesAction(termRef.current, requireOpen);
      if (myGen !== recalcGenRef.current) return;
      if (!res.ok) {
        setSyncError(res.error);
        return;
      }
      if (myGen !== recalcGenRef.current) return;
      setSyncError(null);
      const sols = res.result.solutions;
      if (
        prevSol &&
        everyPlannerItemHasSolvePack(rows, packs) &&
        scheduleSolutionStillValidForItems(rows, packs, prevSol, {
          requireOpenSections: requireOpen,
          blackoutIntervals: blackoutIv,
        })
      ) {
        setSolutions([prevSol]);
        setSolutionsCapped(false);
        setSolutionsTimedOut(false);
      } else {
        setSolutions(sols);
        setSolutionsCapped(res.result.capped);
        setSolutionsTimedOut(res.result.timedOut);
      }
    } finally {
      recalcDepthRef.current -= 1;
      if (recalcDepthRef.current === 0) setIsRecalculatingSolutions(false);
    }
  }, []);

  const recalculateSolutionsRef = useRef(recalculateSolutions);
  useEffect(() => {
    recalculateSolutionsRef.current = recalculateSolutions;
  }, [recalculateSolutions]);

  const applyPlannerItemSelection = useCallback(
    (itemId: number, sel: ResolvedPlannerSelection) => {
      const prev = itemsRef.current;
      const next = prev.map((r) =>
        r.id === itemId
          ? {
              ...r,
              selectionKind: sel.selectionKind,
              anchorCrn: sel.anchorCrn,
              linkedBundleId: sel.linkedBundleId,
              sectionPins: EMPTY_SECTION_PINS,
            }
          : r,
      );
      if (
        everyPlannerItemHasSolvePack(next, solvePacksRef.current) &&
        !plannerItemsAdmitAtLeastOneSchedule(next, solvePacksRef.current, {
          requireOpenSections: requireOpenRef.current,
          blackoutIntervals: blackoutsDocToTimeIntervals(blackoutsRef.current),
        })
      ) {
        setScheduleFeasibilityError(
          "That section doesn't fit with your other courses and pins.",
        );
        return;
      }
      setScheduleFeasibilityError(null);
      setPlannerItems(() => {
        itemsRef.current = next;
        return next;
      });
      schedulePersist();
      queueMicrotask(() => {
        void recalculateSolutionsRef.current();
      });
    },
    [schedulePersist],
  );

  const toggleSectionPin = useCallback(
    (itemId: number, scheduleTypeKey: string, sectionCrn: string) => {
      const prev = itemsRef.current;
      const row = prev.find((r) => r.id === itemId);
      if (!row || row.selectionKind !== "unresolved") return;
      const pins = parseSectionPinsJson(row.sectionPins);
      const isRemoval = pins.byType[scheduleTypeKey] === sectionCrn;
      const next = prev.map((r) => {
        if (r.id !== itemId || r.selectionKind !== "unresolved") return r;
        const p = parseSectionPinsJson(r.sectionPins);
        const byType = { ...p.byType };
        if (byType[scheduleTypeKey] === sectionCrn) {
          delete byType[scheduleTypeKey];
        } else {
          byType[scheduleTypeKey] = sectionCrn;
        }
        return { ...r, sectionPins: { v: p.v, byType } };
      });
      if (
        !isRemoval &&
        everyPlannerItemHasSolvePack(next, solvePacksRef.current) &&
        !plannerItemsAdmitAtLeastOneSchedule(next, solvePacksRef.current, {
          requireOpenSections: requireOpenRef.current,
          blackoutIntervals: blackoutsDocToTimeIntervals(blackoutsRef.current),
        })
      ) {
        setScheduleFeasibilityError(
          "That pin doesn't fit with your other courses and pins.",
        );
        return;
      }
      setScheduleFeasibilityError(null);
      setPlannerItems(() => {
        itemsRef.current = next;
        return next;
      });
      schedulePersist();
      queueMicrotask(() => {
        void recalculateSolutionsRef.current();
      });
    },
    [schedulePersist],
  );

  const setSectionPinFromDrag = useCallback(
    (itemId: number, scheduleTypeKey: string, sectionCrn: string) => {
      const prev = itemsRef.current;
      const next = prev.map((r) => {
        if (r.id !== itemId || r.selectionKind !== "unresolved") return r;
        const pins = parseSectionPinsJson(r.sectionPins);
        return {
          ...r,
          sectionPins: {
            v: pins.v,
            byType: { ...pins.byType, [scheduleTypeKey]: sectionCrn },
          },
        };
      });
      if (
        everyPlannerItemHasSolvePack(next, solvePacksRef.current) &&
        !plannerItemsAdmitAtLeastOneSchedule(next, solvePacksRef.current, {
          requireOpenSections: requireOpenRef.current,
          blackoutIntervals: blackoutsDocToTimeIntervals(blackoutsRef.current),
        })
      ) {
        setScheduleFeasibilityError(
          "That move doesn't fit with your other courses and pins.",
        );
        return;
      }
      setScheduleFeasibilityError(null);
      setPlannerItems(() => {
        itemsRef.current = next;
        return next;
      });
      schedulePersist();
      queueMicrotask(() => {
        void recalculateSolutionsRef.current();
      });
    },
    [schedulePersist],
  );

  const setBlackouts = useCallback(
    (
      next:
        | PlannerBlackoutsDocV1
        | ((prev: PlannerBlackoutsDocV1) => PlannerBlackoutsDocV1),
    ) => {
      setBlackoutsState((prev) => {
        const doc = typeof next === "function" ? next(prev) : next;
        blackoutsRef.current = doc;
        queueMicrotask(() => {
          scheduleBlackoutPersist();
          void recalculateSolutionsRef.current();
        });
        return doc;
      });
    },
    [scheduleBlackoutPersist],
  );

  useEffect(() => {
    if (plannerItems.length === 0) return;
    const t = termCode;
    const timer = setTimeout(() => {
      const keyToCourse = new Map<
        string,
        { subject: string; courseNumber: string }
      >();
      for (const row of itemsRef.current) {
        const k = courseSolvePackCourseKey(row.subject, row.courseNumber);
        keyToCourse.set(k, {
          subject: row.subject,
          courseNumber: row.courseNumber,
        });
      }
      const missing = [...keyToCourse.entries()].filter(
        ([k]) => !solvePacksRef.current[k],
      );
      if (missing.length === 0) {
        void recalculateSolutionsRef.current();
        return;
      }
      void (async () => {
        const results = await Promise.all(
          missing.map(([, c]) =>
            prefetchCourseSolvePackAction(t, c.subject, c.courseNumber),
          ),
        );
        for (const res of results) {
          if (res.ok) mergeSolvePack(res.pack);
        }
        void recalculateSolutionsRef.current();
      })();
    }, PACK_PREFETCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [termCode, plannerItems, mergeSolvePack]);

  const value = useMemo<PlannerContextValue>(
    () => ({
      termCode,
      plannerItems,
      catalog,
      effectivePlannerItems,
      calendarBlocks,
      syncError,
      clearSyncError,
      scheduleFeasibilityError,
      clearScheduleFeasibilityError,
      refreshCatalogFromServer,
      setPlannerItems: setPlannerItemsFromContext,
      removePlannerItem,
      updatePlannerItem,
      schedulePersist,
      toggleSectionPin,
      setSectionPinFromDrag,
      applyPlannerItemSelection,
      solutions,
      solutionsCapped,
      solutionsTimedOut,
      infeasibilityHints,
      requireOpenSections,
      setRequireOpenSections,
      recalculateSolutions,
      isRecalculatingSolutions,
      solvePacks,
      mergeSolvePack,
      mergedPackConstraintMaps,
      blackouts,
      setBlackouts,
    }),
    [
      termCode,
      plannerItems,
      catalog,
      effectivePlannerItems,
      calendarBlocks,
      syncError,
      scheduleFeasibilityError,
      refreshCatalogFromServer,
      clearSyncError,
      clearScheduleFeasibilityError,
      setPlannerItemsFromContext,
      removePlannerItem,
      updatePlannerItem,
      schedulePersist,
      toggleSectionPin,
      setSectionPinFromDrag,
      applyPlannerItemSelection,
      solutions,
      solutionsCapped,
      solutionsTimedOut,
      infeasibilityHints,
      requireOpenSections,
      recalculateSolutions,
      isRecalculatingSolutions,
      solvePacks,
      mergeSolvePack,
      mergedPackConstraintMaps,
      blackouts,
      setBlackouts,
    ],
  );

  return (
    <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>
  );
}

export function usePlanner() {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error("usePlanner must be used within PlannerProvider");
  return ctx;
}
