"use client";

import {
  loadPlannerCatalogBootstrapAction,
  prefetchCourseSolvePackAction,
  savePlannerBlackoutsAction,
  savePlannerKeptSolutionsAction,
  savePlannerLastSolutionIndexAction,
  savePlannerTimePrefsAction,
  solveSchedulesAction,
  syncPlannerStateAction,
} from "@/app/planner/actions";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import { buildCalendarBlocksFromCatalog } from "@/lib/planner/client/derive";
import {
  blackoutsDocToTimeIntervals,
  type PlannerBlackoutsDocV1,
} from "@/lib/planner/blackouts";
import {
  EMPTY_KEPT_SOLUTIONS,
  findSolutionIndexByFingerprint,
  MAX_KEPT_SOLUTIONS,
  solutionFingerprint,
  type PlannerKeptSolutionsDocV1,
} from "@/lib/planner/kept-solutions";
import {
  EMPTY_TIME_PREFS,
  type PlannerTimePrefsV1,
} from "@/lib/planner/time-prefs";
import { computeInfeasibilityHints } from "@/lib/planner/infeasibility-hints";
import { mergePackConstraintMaps } from "@/lib/planner/planner-swap-feasibility";
import type { PlannerScheduleFilters } from "@/lib/planner/schedule-filters";
import { DEFAULT_PLANNER_SCHEDULE_FILTERS } from "@/lib/planner/schedule-filters";
import { track } from "@/lib/analytics/track";
import type { CalendarBlock, PlannerItemRow } from "@/lib/planner/data";
import {
  EMPTY_SECTION_PINS,
  parseSectionPinsJson,
} from "@/lib/planner/section-pins";
import type { ResolvedPlannerSelection } from "@/lib/planner/resolve-display-crns-shared";
import {
  courseSolvePackCourseKey,
  plannerItemsFeasibility,
  scheduleSolutionStillValidForItems,
  solveSchedulesFromPacks,
  everyPlannerItemHasSolvePack,
  type CourseSolvePack,
  type ScheduleSolution,
} from "@/lib/planner/solve-schedules-core";
import { yieldToMain } from "@/lib/planner/yield-to-main";
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
const KEPT_PERSIST_DEBOUNCE_MS = 800;
const TIME_PREFS_PERSIST_DEBOUNCE_MS = 800;
const LAST_INDEX_PERSIST_DEBOUNCE_MS = 1500;
const PACK_PREFETCH_DEBOUNCE_MS = 400;
/**
 * Cap on how many alternate schedules the UI will paginate through. Set to a
 * value comfortably larger than 1 so users can flip between options, but
 * small enough that DFS time stays bounded.
 */
const PLANNER_MAX_SOLUTIONS = 25 as const;
/**
 * Tight budget for synchronous "would this still fit?" probes that gate
 * pin/toggle/drag previews. If DFS can't decide in this window we report
 * "unknown" and let the action through; the next full recalculate will
 * surface true infeasibility without making the user wait on the click.
 */
const PREVIEW_FEASIBILITY_TIMEOUT_MS = 250;

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

function clampSolutionIndex(i: number, total: number): number {
  if (total <= 0) return 0;
  if (!Number.isFinite(i)) return 0;
  if (i < 0) return 0;
  if (i >= total) return total - 1;
  return Math.floor(i);
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
  /** Index into `solutions` for the schedule the user is currently viewing. */
  currentSolutionIndex: number;
  /** Move the active schedule by one (or to a specific index). */
  setCurrentSolutionIndex: (
    next: number,
    method?: "next" | "prev" | "first" | "last" | "keep" | "drop",
  ) => void;
  /** Fingerprint keys (CRN-set joins) of the schedules the user has kept. */
  keptSolutions: PlannerKeptSolutionsDocV1;
  /** True if the active schedule is in the kept pile. */
  isCurrentSolutionKept: boolean;
  /** Toggle the active schedule's "kept" status. */
  toggleCurrentSolutionKept: () => void;
  /** Indices of kept schedules in the current `solutions` array (only the matched ones). */
  keptSolutionIndices: number[];
  /** Hints when no schedule fits (requires complete solve packs). */
  infeasibilityHints: string[];
  requireOpenSections: boolean;
  setRequireOpenSections: (v: boolean) => void;
  excludeTba: boolean;
  setExcludeTba: (v: boolean) => void;
  excludeOnlineAsync: boolean;
  setExcludeOnlineAsync: (v: boolean) => void;
  recalculateSolutions: (
    filterOverrides?: Partial<PlannerScheduleFilters>,
  ) => Promise<void>;
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
  /** Soft time-of-day preferences that bias schedule scoring. */
  timePrefs: PlannerTimePrefsV1;
  setTimePrefs: (
    next:
      | PlannerTimePrefsV1
      | ((prev: PlannerTimePrefsV1) => PlannerTimePrefsV1),
  ) => void;
};

const PlannerContext = createContext<PlannerContextValue | null>(null);

type ProviderProps = {
  termCode: string;
  initialPlannerItems: PlannerItemRow[];
  initialCatalog: PlannerCatalogJson;
  initialTermUiState: {
    blackouts: PlannerBlackoutsDocV1;
    keptSolutions: PlannerKeptSolutionsDocV1;
    timePrefs: PlannerTimePrefsV1;
    lastSolutionIndex: number;
  } | null;
  children: React.ReactNode;
};

/**
 * Provides planner cart, catalog, solves, and UI wiring in one context value.
 *
 * When investigating performance: use React DevTools Profiler while toggling pins,
 * dragging swaps, or editing CourseManager-only fields. If subtree renders look
 * wasteful (e.g. CourseManager updating on blackout-only edits), measure before
 * splitting — a single memoized context value stays simpler than multiple stores
 * until profiling shows concrete churn.
 */
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
  const [currentSolutionIndex, setCurrentSolutionIndexState] = useState<number>(
    () => initialTermUiState?.lastSolutionIndex ?? 0,
  );
  const [requireOpenSections, setRequireOpenSections] = useState(
    DEFAULT_PLANNER_SCHEDULE_FILTERS.requireOpenSections,
  );
  const [excludeTba, setExcludeTba] = useState(
    DEFAULT_PLANNER_SCHEDULE_FILTERS.excludeTba,
  );
  const [excludeOnlineAsync, setExcludeOnlineAsync] = useState(
    DEFAULT_PLANNER_SCHEDULE_FILTERS.excludeOnlineAsync,
  );
  const [blackouts, setBlackoutsState] = useState<PlannerBlackoutsDocV1>(
    () => initialTermUiState?.blackouts ?? EMPTY_BLACKOUTS,
  );
  const [keptSolutions, setKeptSolutionsState] =
    useState<PlannerKeptSolutionsDocV1>(
      () => initialTermUiState?.keptSolutions ?? EMPTY_KEPT_SOLUTIONS,
    );
  const [timePrefs, setTimePrefsState] = useState<PlannerTimePrefsV1>(
    () => initialTermUiState?.timePrefs ?? EMPTY_TIME_PREFS,
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

  // No prop-sync effects: the parent (HomePlanner) keys this provider on
  // `termCode`, so a term switch remounts everything with fresh initial state.
  // Re-hydrating from `initialPlannerItems` / `initialCatalog` on referential
  // changes was a bug — an RSC refresh or cache invalidation could clobber
  // unsaved client edits made between the last persist flush and the next
  // server snapshot. The `refreshCatalogFromServer` callback is the only
  // intentional re-hydration path.

  const itemsRef = useRef(plannerItems);
  const termRef = useRef(termCode);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistInFlightRef = useRef(false);
  /**
   * Bumped by every persist scheduler so an in-flight save can detect that newer
   * data arrived while it was syncing and re-flush instead of silently dropping
   * the latest items (cf. P0 persistence race).
   */
  const persistDirtyGenRef = useRef(0);
  const persistFlushedGenRef = useRef(0);
  const blackoutPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const blackoutPersistInFlightRef = useRef(false);
  const blackoutPersistDirtyGenRef = useRef(0);
  const blackoutPersistFlushedGenRef = useRef(0);
  const keptPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keptPersistInFlightRef = useRef(false);
  const keptPersistDirtyGenRef = useRef(0);
  const keptPersistFlushedGenRef = useRef(0);
  const timePrefsPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const timePrefsPersistInFlightRef = useRef(false);
  const timePrefsPersistDirtyGenRef = useRef(0);
  const timePrefsPersistFlushedGenRef = useRef(0);
  const lastIndexPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  /** Bumped on every pack-prefetch start; awaiting calls bail when stale. */
  const prefetchGenRef = useRef(0);
  const requireOpenRef = useRef(requireOpenSections);
  const excludeTbaRef = useRef(excludeTba);
  const excludeOnlineAsyncRef = useRef(excludeOnlineAsync);
  const blackoutsRef = useRef(blackouts);
  const keptSolutionsRef = useRef(keptSolutions);
  const timePrefsRef = useRef(timePrefs);
  const currentSolutionIndexRef = useRef(currentSolutionIndex);

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
    excludeTbaRef.current = excludeTba;
  }, [excludeTba]);
  useEffect(() => {
    excludeOnlineAsyncRef.current = excludeOnlineAsync;
  }, [excludeOnlineAsync]);
  useEffect(() => {
    blackoutsRef.current = blackouts;
  }, [blackouts]);
  useEffect(() => {
    keptSolutionsRef.current = keptSolutions;
  }, [keptSolutions]);
  useEffect(() => {
    timePrefsRef.current = timePrefs;
  }, [timePrefs]);
  useEffect(() => {
    currentSolutionIndexRef.current = currentSolutionIndex;
  }, [currentSolutionIndex]);

  const safeCurrentSolutionIndex = useMemo(
    () => clampSolutionIndex(currentSolutionIndex, solutions.length),
    [currentSolutionIndex, solutions.length],
  );

  const effectivePlannerItems = useMemo(() => {
    const sol = solutions[safeCurrentSolutionIndex] ?? null;
    return applySolutionToPlannerItems(plannerItems, sol);
  }, [plannerItems, solutions, safeCurrentSolutionIndex]);

  const isCurrentSolutionKept = useMemo(() => {
    const sol = solutions[safeCurrentSolutionIndex];
    if (!sol) return false;
    const fp = solutionFingerprint(sol);
    return keptSolutions.keys.includes(fp);
  }, [solutions, safeCurrentSolutionIndex, keptSolutions]);

  const keptSolutionIndices = useMemo(() => {
    if (solutions.length === 0 || keptSolutions.keys.length === 0) return [];
    const out: number[] = [];
    for (const k of keptSolutions.keys) {
      const i = findSolutionIndexByFingerprint(solutions, k);
      if (i >= 0) out.push(i);
    }
    return out;
  }, [solutions, keptSolutions]);

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
      excludeTba,
      excludeOnlineAsync,
      catalog,
      // We only reach this branch when the main solve already returned
      // zero schedules with the same items+packs+constraints, so skip the
      // redundant base DFS that infeasibility-hints used to run.
      baseAlreadyInfeasible: true,
    });
  }, [
    solutions,
    plannerItems,
    solvePacks,
    blackouts,
    requireOpenSections,
    excludeTba,
    excludeOnlineAsync,
    catalog,
  ]);

  const refreshCatalogFromServerRef = useRef<
    (() => Promise<boolean>) | null
  >(null);

  const flushPersist = useCallback(async () => {
    if (persistInFlightRef.current) return;
    while (persistFlushedGenRef.current < persistDirtyGenRef.current) {
      const flushingGen = persistDirtyGenRef.current;
      const t = termRef.current;
      const rows = itemsRef.current;
      persistInFlightRef.current = true;
      try {
        const res = await syncPlannerStateAction(t, rows);
        if (!res.ok) {
          setSyncError(res.error);
          // Roll back: refresh local state from the server so the client and DB
          // do not silently diverge after a rejected write (P0 #6).
          if (refreshCatalogFromServerRef.current) {
            await refreshCatalogFromServerRef.current();
          }
          // Stop draining the queue on failure; the refresh resets ref state.
          persistFlushedGenRef.current = persistDirtyGenRef.current;
          return;
        }
        setSyncError(null);
        persistFlushedGenRef.current = flushingGen;
      } finally {
        persistInFlightRef.current = false;
      }
    }
  }, []);

  const flushBlackoutPersist = useCallback(async () => {
    if (blackoutPersistInFlightRef.current) return;
    while (
      blackoutPersistFlushedGenRef.current <
      blackoutPersistDirtyGenRef.current
    ) {
      const flushingGen = blackoutPersistDirtyGenRef.current;
      const t = termRef.current;
      blackoutPersistInFlightRef.current = true;
      try {
        const res = await savePlannerBlackoutsAction({
          termCode: t,
          items: blackoutsRef.current.items,
        });
        if (!res.ok) {
          setSyncError(res.error);
          if (refreshCatalogFromServerRef.current) {
            await refreshCatalogFromServerRef.current();
          }
          blackoutPersistFlushedGenRef.current =
            blackoutPersistDirtyGenRef.current;
          return;
        }
        setSyncError(null);
        blackoutPersistFlushedGenRef.current = flushingGen;
      } finally {
        blackoutPersistInFlightRef.current = false;
      }
    }
  }, []);

  const flushKeptPersist = useCallback(async () => {
    if (keptPersistInFlightRef.current) return;
    while (
      keptPersistFlushedGenRef.current < keptPersistDirtyGenRef.current
    ) {
      const flushingGen = keptPersistDirtyGenRef.current;
      const t = termRef.current;
      keptPersistInFlightRef.current = true;
      try {
        const res = await savePlannerKeptSolutionsAction({
          termCode: t,
          keys: keptSolutionsRef.current.keys,
        });
        if (!res.ok) {
          setSyncError(res.error);
          keptPersistFlushedGenRef.current = keptPersistDirtyGenRef.current;
          return;
        }
        setSyncError(null);
        keptPersistFlushedGenRef.current = flushingGen;
      } finally {
        keptPersistInFlightRef.current = false;
      }
    }
  }, []);

  const flushTimePrefsPersist = useCallback(async () => {
    if (timePrefsPersistInFlightRef.current) return;
    while (
      timePrefsPersistFlushedGenRef.current <
      timePrefsPersistDirtyGenRef.current
    ) {
      const flushingGen = timePrefsPersistDirtyGenRef.current;
      const t = termRef.current;
      timePrefsPersistInFlightRef.current = true;
      try {
        const res = await savePlannerTimePrefsAction({
          termCode: t,
          prefs: timePrefsRef.current,
        });
        if (!res.ok) {
          setSyncError(res.error);
          timePrefsPersistFlushedGenRef.current =
            timePrefsPersistDirtyGenRef.current;
          return;
        }
        setSyncError(null);
        timePrefsPersistFlushedGenRef.current = flushingGen;
      } finally {
        timePrefsPersistInFlightRef.current = false;
      }
    }
  }, []);

  const schedulePersist = useCallback(() => {
    persistDirtyGenRef.current += 1;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      void flushPersist();
    }, PERSIST_DEBOUNCE_MS);
  }, [flushPersist]);

  const scheduleBlackoutPersist = useCallback(() => {
    blackoutPersistDirtyGenRef.current += 1;
    if (blackoutPersistTimerRef.current) {
      clearTimeout(blackoutPersistTimerRef.current);
    }
    blackoutPersistTimerRef.current = setTimeout(() => {
      blackoutPersistTimerRef.current = null;
      void flushBlackoutPersist();
    }, BLACKOUT_PERSIST_DEBOUNCE_MS);
  }, [flushBlackoutPersist]);

  const scheduleKeptPersist = useCallback(() => {
    keptPersistDirtyGenRef.current += 1;
    if (keptPersistTimerRef.current) clearTimeout(keptPersistTimerRef.current);
    keptPersistTimerRef.current = setTimeout(() => {
      keptPersistTimerRef.current = null;
      void flushKeptPersist();
    }, KEPT_PERSIST_DEBOUNCE_MS);
  }, [flushKeptPersist]);

  const scheduleTimePrefsPersist = useCallback(() => {
    timePrefsPersistDirtyGenRef.current += 1;
    if (timePrefsPersistTimerRef.current) {
      clearTimeout(timePrefsPersistTimerRef.current);
    }
    timePrefsPersistTimerRef.current = setTimeout(() => {
      timePrefsPersistTimerRef.current = null;
      void flushTimePrefsPersist();
    }, TIME_PREFS_PERSIST_DEBOUNCE_MS);
  }, [flushTimePrefsPersist]);

  const scheduleLastIndexPersist = useCallback(() => {
    if (lastIndexPersistTimerRef.current) {
      clearTimeout(lastIndexPersistTimerRef.current);
    }
    lastIndexPersistTimerRef.current = setTimeout(() => {
      lastIndexPersistTimerRef.current = null;
      const t = termRef.current;
      void savePlannerLastSolutionIndexAction({
        termCode: t,
        index: currentSolutionIndexRef.current,
      });
    }, LAST_INDEX_PERSIST_DEBOUNCE_MS);
  }, []);

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
        if (keptPersistTimerRef.current) {
          clearTimeout(keptPersistTimerRef.current);
          keptPersistTimerRef.current = null;
        }
        if (timePrefsPersistTimerRef.current) {
          clearTimeout(timePrefsPersistTimerRef.current);
          timePrefsPersistTimerRef.current = null;
        }
        void flushPersist();
        void flushBlackoutPersist();
        void flushKeptPersist();
        void flushTimePrefsPersist();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [flushPersist, flushBlackoutPersist, flushKeptPersist, flushTimePrefsPersist]);

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
      if (keptPersistTimerRef.current) {
        clearTimeout(keptPersistTimerRef.current);
        keptPersistTimerRef.current = null;
      }
      if (timePrefsPersistTimerRef.current) {
        clearTimeout(timePrefsPersistTimerRef.current);
        timePrefsPersistTimerRef.current = null;
      }
      void flushPersist();
      void flushBlackoutPersist();
      void flushKeptPersist();
      void flushTimePrefsPersist();
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [flushPersist, flushBlackoutPersist, flushKeptPersist, flushTimePrefsPersist]);

  const refreshCatalogFromServer = useCallback(async (): Promise<boolean> => {
    const res = await loadPlannerCatalogBootstrapAction(termCode);
    if (!res.ok) {
      setSyncError(res.error);
      return false;
    }
    itemsRef.current = res.plannerItems;
    setPlannerItems(res.plannerItems);
    setCatalog(res.catalog);
    setSolutions([]);
    const nextBlackouts = res.termUiState?.blackouts ?? EMPTY_BLACKOUTS;
    blackoutsRef.current = nextBlackouts;
    setBlackoutsState(nextBlackouts);
    const nextKept = res.termUiState?.keptSolutions ?? EMPTY_KEPT_SOLUTIONS;
    keptSolutionsRef.current = nextKept;
    setKeptSolutionsState(nextKept);
    const nextPrefs = res.termUiState?.timePrefs ?? EMPTY_TIME_PREFS;
    timePrefsRef.current = nextPrefs;
    setTimePrefsState(nextPrefs);
    const nextIdx = res.termUiState?.lastSolutionIndex ?? 0;
    currentSolutionIndexRef.current = nextIdx;
    setCurrentSolutionIndexState(nextIdx);
    // Treat the refresh as the new "synced" baseline so subsequent flushes do
    // not race against the data we just pulled.
    persistFlushedGenRef.current = persistDirtyGenRef.current;
    blackoutPersistFlushedGenRef.current = blackoutPersistDirtyGenRef.current;
    keptPersistFlushedGenRef.current = keptPersistDirtyGenRef.current;
    timePrefsPersistFlushedGenRef.current = timePrefsPersistDirtyGenRef.current;
    setSyncError(null);
    return true;
  }, [termCode]);

  useEffect(() => {
    refreshCatalogFromServerRef.current = refreshCatalogFromServer;
  }, [refreshCatalogFromServer]);

  const removePlannerItem = useCallback(
    (id: number) => {
      setPlannerItems((prev) => {
        const next = prev.filter((r) => r.id !== id);
        itemsRef.current = next;
        return next;
      });
      // Route through the same debounced queue as every other mutation. The
      // queue serializes writes so a remove cannot race a debounced batched
      // update (P0 #1).
      schedulePersist();
    },
    [schedulePersist],
  );

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

  const recalculateSolutions = useCallback(
    async (filterOverrides?: Partial<PlannerScheduleFilters>) => {
    const myGen = ++recalcGenRef.current;
    recalcDepthRef.current += 1;
    if (recalcDepthRef.current === 1) setIsRecalculatingSolutions(true);
    try {
      const filters: PlannerScheduleFilters = {
        requireOpenSections:
          filterOverrides?.requireOpenSections ?? requireOpenRef.current,
        excludeTba: filterOverrides?.excludeTba ?? excludeTbaRef.current,
        excludeOnlineAsync:
          filterOverrides?.excludeOnlineAsync ?? excludeOnlineAsyncRef.current,
      };
      const rows = itemsRef.current;
      const packs = solvePacksRef.current;

      if (rows.length === 0) {
        if (myGen === recalcGenRef.current) {
          setSyncError(null);
          setScheduleFeasibilityError(null);
          setSolutions([]);
          setSolutionsCapped(false);
          setSolutionsTimedOut(false);
        }
        return;
      }

      const blackoutIv = blackoutsDocToTimeIntervals(blackoutsRef.current);
      const prevIdx = clampSolutionIndex(
        currentSolutionIndexRef.current,
        solutionsRef.current.length,
      );
      const prevSol = solutionsRef.current[prevIdx] ?? null;
      const prevFp = prevSol ? solutionFingerprint(prevSol) : null;
      const prevSelections = prevSol?.selections ?? null;

      const adoptSolutions = (
        next: ScheduleSolution[],
        capped: boolean,
        timedOut: boolean,
      ) => {
        setSolutions(next);
        setSolutionsCapped(capped);
        setSolutionsTimedOut(timedOut);
        let nextIdx = 0;
        if (next.length > 0) {
          if (prevFp) {
            const i = findSolutionIndexByFingerprint(next, prevFp);
            if (i >= 0) nextIdx = i;
          }
          if (nextIdx === 0 && keptSolutionsRef.current.keys.length > 0) {
            for (const k of keptSolutionsRef.current.keys) {
              const i = findSolutionIndexByFingerprint(next, k);
              if (i >= 0) {
                nextIdx = i;
                break;
              }
            }
          }
        }
        currentSolutionIndexRef.current = nextIdx;
        setCurrentSolutionIndexState(nextIdx);
      };

      if (everyPlannerItemHasSolvePack(rows, packs)) {
        await yieldToMain();
        if (myGen !== recalcGenRef.current) return;

        const result = solveSchedulesFromPacks(rows, packs, {
          ...filters,
          blackoutIntervals: blackoutIv,
          maxSolutions: PLANNER_MAX_SOLUTIONS,
          previousSelections: prevSelections,
        });
        if (myGen !== recalcGenRef.current) return;
        setSyncError(null);
        adoptSolutions(result.solutions, result.capped, result.timedOut);
        return;
      }

      const res = await solveSchedulesAction(termRef.current, filters);
      if (myGen !== recalcGenRef.current) return;
      if (!res.ok) {
        setSyncError(res.error);
        return;
      }
      if (myGen !== recalcGenRef.current) return;
      setSyncError(null);
      const sols = res.result.solutions;
      // Re-read packs after the await: a concurrent prefetch may have
      // completed during the server round-trip, in which case keeping the
      // user's previous solution is preferable to clobbering it with the
      // server result.
      const packsAfter = solvePacksRef.current;
      if (
        prevSol &&
        everyPlannerItemHasSolvePack(rows, packsAfter) &&
        scheduleSolutionStillValidForItems(rows, packsAfter, prevSol, {
          ...filters,
          blackoutIntervals: blackoutIv,
        })
      ) {
        adoptSolutions([prevSol], false, false);
      } else {
        adoptSolutions(sols, res.result.capped, res.result.timedOut);
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
        plannerItemsFeasibility(next, solvePacksRef.current, {
          requireOpenSections: requireOpenRef.current,
          excludeTba: excludeTbaRef.current,
          excludeOnlineAsync: excludeOnlineAsyncRef.current,
          blackoutIntervals: blackoutsDocToTimeIntervals(blackoutsRef.current),
          timeoutMs: PREVIEW_FEASIBILITY_TIMEOUT_MS,
        }) === "infeasible"
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
        plannerItemsFeasibility(next, solvePacksRef.current, {
          requireOpenSections: requireOpenRef.current,
          excludeTba: excludeTbaRef.current,
          excludeOnlineAsync: excludeOnlineAsyncRef.current,
          blackoutIntervals: blackoutsDocToTimeIntervals(blackoutsRef.current),
          timeoutMs: PREVIEW_FEASIBILITY_TIMEOUT_MS,
        }) === "infeasible"
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
        plannerItemsFeasibility(next, solvePacksRef.current, {
          requireOpenSections: requireOpenRef.current,
          excludeTba: excludeTbaRef.current,
          excludeOnlineAsync: excludeOnlineAsyncRef.current,
          blackoutIntervals: blackoutsDocToTimeIntervals(blackoutsRef.current),
          timeoutMs: PREVIEW_FEASIBILITY_TIMEOUT_MS,
        }) === "infeasible"
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

  // Counter bumped only by user-initiated `setBlackouts`. The side-effect
  // useEffect below reads it to skip side effects for server-driven sets
  // (e.g. `refreshCatalogFromServer`). Under React Strict Mode the previous
  // implementation ran the functional updater twice, which doubled the
  // queueMicrotask side-effect scheduling.
  const blackoutsUserGenRef = useRef(0);
  const blackoutsHandledGenRef = useRef(0);

  const setBlackouts = useCallback(
    (
      next:
        | PlannerBlackoutsDocV1
        | ((prev: PlannerBlackoutsDocV1) => PlannerBlackoutsDocV1),
    ) => {
      blackoutsUserGenRef.current += 1;
      setBlackoutsState((prev) => {
        const doc = typeof next === "function" ? next(prev) : next;
        blackoutsRef.current = doc;
        return doc;
      });
    },
    [],
  );

  useEffect(() => {
    if (blackoutsUserGenRef.current === blackoutsHandledGenRef.current) {
      // Either the initial mount or a server-driven reset; no side effects.
      return;
    }
    blackoutsHandledGenRef.current = blackoutsUserGenRef.current;
    scheduleBlackoutPersist();
    void recalculateSolutionsRef.current();
  }, [blackouts, scheduleBlackoutPersist]);

  // Stable signature of which courses are in the cart, so unrelated edits
  // (color, instructor prefs, pin toggles) don't restart the debounce timer
  // or kick off a redundant prefetch round.
  const plannerCourseKeysSignature = useMemo(() => {
    const keys = plannerItems.map((row) =>
      courseSolvePackCourseKey(row.subject, row.courseNumber),
    );
    keys.sort();
    return keys.join("\u0001");
  }, [plannerItems]);

  useEffect(() => {
    if (plannerCourseKeysSignature.length === 0) return;
    const t = termCode;
    let cancelled = false;
    const timer = setTimeout(() => {
      // Bump the prefetch generation so any in-flight Promise.all from a prior
      // term/items snapshot bails before merging stale packs (P0 #5).
      const myGen = ++prefetchGenRef.current;
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
        if (cancelled) return;
        if (myGen !== prefetchGenRef.current) return;
        if (termRef.current !== t) return;
        for (const res of results) {
          if (res.ok) mergeSolvePack(res.pack);
        }
        void recalculateSolutionsRef.current();
      })();
    }, PACK_PREFETCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [termCode, plannerCourseKeysSignature, mergeSolvePack]);

  const setCurrentSolutionIndex = useCallback(
    (
      next: number,
      method?: "next" | "prev" | "first" | "last" | "keep" | "drop",
    ) => {
      const total = solutionsRef.current.length;
      const clamped = clampSolutionIndex(next, total);
      const prev = currentSolutionIndexRef.current;
      currentSolutionIndexRef.current = clamped;
      setCurrentSolutionIndexState(clamped);
      if (clamped !== prev) {
        scheduleLastIndexPersist();
        track("planner_solution_changed", {
          method: method ?? "keep",
          from: prev,
          to: clamped,
          total,
        });
      }
    },
    [scheduleLastIndexPersist],
  );

  const toggleCurrentSolutionKept = useCallback(() => {
    const total = solutionsRef.current.length;
    const idx = clampSolutionIndex(
      currentSolutionIndexRef.current,
      total,
    );
    const sol = solutionsRef.current[idx];
    if (!sol) return;
    const fp = solutionFingerprint(sol);
    const prevDoc = keptSolutionsRef.current;
    const has = prevDoc.keys.includes(fp);
    let nextKeys: string[];
    if (has) {
      nextKeys = prevDoc.keys.filter((k) => k !== fp);
    } else {
      nextKeys = [...prevDoc.keys, fp];
      if (nextKeys.length > MAX_KEPT_SOLUTIONS) {
        nextKeys = nextKeys.slice(nextKeys.length - MAX_KEPT_SOLUTIONS);
      }
    }
    const nextDoc: PlannerKeptSolutionsDocV1 = { v: 1, keys: nextKeys };
    keptSolutionsRef.current = nextDoc;
    setKeptSolutionsState(nextDoc);
    scheduleKeptPersist();
    track(has ? "planner_solution_unkept" : "planner_solution_kept", {
      index: idx,
      total,
    });
  }, [scheduleKeptPersist]);

  const timePrefsUserGenRef = useRef(0);
  const timePrefsHandledGenRef = useRef(0);

  const setTimePrefs = useCallback(
    (
      next:
        | PlannerTimePrefsV1
        | ((prev: PlannerTimePrefsV1) => PlannerTimePrefsV1),
    ) => {
      timePrefsUserGenRef.current += 1;
      setTimePrefsState((prev) => {
        const doc = typeof next === "function" ? next(prev) : next;
        timePrefsRef.current = doc;
        return doc;
      });
    },
    [],
  );

  // The setter wraps each toggle so we don't need to diff individual prefs
  // here — the user-facing per-pref `track` call lives in the rail component.
  useEffect(() => {
    if (timePrefsUserGenRef.current === timePrefsHandledGenRef.current) {
      return;
    }
    timePrefsHandledGenRef.current = timePrefsUserGenRef.current;
    scheduleTimePrefsPersist();
    void recalculateSolutionsRef.current();
  }, [timePrefs, scheduleTimePrefsPersist]);

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
      currentSolutionIndex: safeCurrentSolutionIndex,
      setCurrentSolutionIndex,
      keptSolutions,
      isCurrentSolutionKept,
      toggleCurrentSolutionKept,
      keptSolutionIndices,
      infeasibilityHints,
      requireOpenSections,
      setRequireOpenSections,
      excludeTba,
      setExcludeTba,
      excludeOnlineAsync,
      setExcludeOnlineAsync,
      recalculateSolutions,
      isRecalculatingSolutions,
      solvePacks,
      mergeSolvePack,
      mergedPackConstraintMaps,
      blackouts,
      setBlackouts,
      timePrefs,
      setTimePrefs,
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
      safeCurrentSolutionIndex,
      setCurrentSolutionIndex,
      keptSolutions,
      isCurrentSolutionKept,
      toggleCurrentSolutionKept,
      keptSolutionIndices,
      infeasibilityHints,
      requireOpenSections,
      excludeTba,
      excludeOnlineAsync,
      recalculateSolutions,
      isRecalculatingSolutions,
      solvePacks,
      mergeSolvePack,
      mergedPackConstraintMaps,
      blackouts,
      setBlackouts,
      timePrefs,
      setTimePrefs,
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
