"use client";

import {
  loadPlannerCatalogForItemsAction,
  prefetchCourseSolvePackAction,
} from "@/app/planner/actions";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import { buildCalendarBlocksFromCatalog } from "@/lib/planner/client/derive";
import {
  blackoutsDocToTimeIntervals,
  type PlannerBlackoutsDocV1,
} from "@/lib/planner/blackouts";
import {
  capturePlannerHistorySnapshot,
  createPlannerHistoryStacks,
  type PlannerHistorySnapshot,
  type PlannerHistoryStacks,
} from "@/lib/planner/planner-action-history";
import { computeInfeasibilityHints } from "@/lib/planner/infeasibility-hints";
import { mergePackConstraintMaps } from "@/lib/planner/planner-swap-feasibility";
import type { PlannerScheduleFilters } from "@/lib/planner/schedule-filters";
import { DEFAULT_PLANNER_SCHEDULE_FILTERS } from "@/lib/planner/schedule-filters";
import type { CalendarBlock, PlannerItemRow } from "@/lib/planner/data";
import {
  EMPTY_SECTION_PINS,
  parseSectionPinsJson,
} from "@/lib/planner/section-pins";
import type { ResolvedPlannerSelection } from "@/lib/planner/resolve-display-crns-shared";
import {
  courseSolvePackCourseKey,
  plannerItemsFeasibility,
  solveSchedulesFromPacks,
  everyPlannerItemHasSolvePack,
  type CourseSolvePack,
  type ScheduleSolution,
} from "@/lib/planner/solve-schedules-core";
import { yieldToMain } from "@/lib/planner/yield-to-main";
import {
  readTerm,
  subscribeLocalDoc,
  writeTerm,
} from "@/lib/planner/local-state";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const PACK_PREFETCH_DEBOUNCE_MS = 400;
const PREVIEW_FEASIBILITY_TIMEOUT_MS = 250;

const EMPTY_BLACKOUTS: PlannerBlackoutsDocV1 = { v: 1, items: [] };

const EMPTY_CATALOG: PlannerCatalogJson = {
  sections: [],
  meetings: [],
  linkedBundles: [],
  linkedBundleMembers: [],
  facultyByCrn: {},
  examReservationsByCrn: {},
  vagueExamNoteByCrn: {},
};

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

type PlannerDataContextValue = {
  termCode: string;
  plannerItems: PlannerItemRow[];
  catalog: PlannerCatalogJson;
  isHydrating: boolean;
  refreshCatalogFromServer: () => Promise<boolean>;
  setPlannerItems: (items: PlannerItemRow[]) => void;
  removePlannerItem: (id: number) => void;
  updatePlannerItem: (id: number, patch: Partial<PlannerItemRow>) => void;
  toggleSectionPin: (itemId: number, scheduleTypeKey: string, sectionCrn: string) => void;
  setSectionPinFromDrag: (
    itemId: number,
    scheduleTypeKey: string,
    sectionCrn: string,
  ) => void;
  applyPlannerItemSelection: (
    itemId: number,
    sel: ResolvedPlannerSelection,
  ) => void;
  solvePacks: Record<string, CourseSolvePack>;
  mergeSolvePack: (pack: CourseSolvePack) => void;
  mergedPackConstraintMaps: ReturnType<typeof mergePackConstraintMaps>;
};

type PlannerSolveContextValue = {
  effectivePlannerItems: PlannerItemRow[];
  calendarBlocks: CalendarBlock[];
  syncError: string | null;
  clearSyncError: () => void;
  scheduleFeasibilityError: string | null;
  clearScheduleFeasibilityError: () => void;
  solutions: ScheduleSolution[];
  infeasibilityHints: string[];
  recalculateSolutions: (
    filterOverrides?: Partial<PlannerScheduleFilters>,
  ) => Promise<void>;
  scheduleRecalculateSolutions: (
    filterOverrides?: Partial<PlannerScheduleFilters>,
  ) => void;
  isRecalculatingSolutions: boolean;
  hasAttemptedSolve: boolean;
};

type PlannerUiContextValue = {
  requireOpenSections: boolean;
  setRequireOpenSections: (v: boolean) => void;
  excludeTba: boolean;
  setExcludeTba: (v: boolean) => void;
  excludeOnlineAsync: boolean;
  setExcludeOnlineAsync: (v: boolean) => void;
  blackouts: PlannerBlackoutsDocV1;
  setBlackouts: (
    doc:
      | PlannerBlackoutsDocV1
      | ((prev: PlannerBlackoutsDocV1) => PlannerBlackoutsDocV1),
  ) => void;
};

type PlannerHistoryContextValue = {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  recordHistorySnapshot: () => void;
};

const PlannerDataContext = createContext<PlannerDataContextValue | null>(null);
const PlannerSolveContext = createContext<PlannerSolveContextValue | null>(null);
const PlannerUiContext = createContext<PlannerUiContextValue | null>(null);
const PlannerHistoryContext = createContext<PlannerHistoryContextValue | null>(
  null,
);

type ProviderProps = {
  termCode: string;
  children: React.ReactNode;
};

export function PlannerProvider({ termCode, children }: ProviderProps) {
  const [isHydrating, setIsHydrating] = useState(true);
  const [plannerItems, setPlannerItems] = useState<PlannerItemRow[]>([]);
  const [catalog, setCatalog] = useState<PlannerCatalogJson>(EMPTY_CATALOG);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [scheduleFeasibilityError, setScheduleFeasibilityError] = useState<
    string | null
  >(null);

  const [solutions, setSolutions] = useState<ScheduleSolution[]>([]);
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
    EMPTY_BLACKOUTS,
  );
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [solvePacks, setSolvePacks] = useState<Record<string, CourseSolvePack>>(
    {},
  );
  const [isRecalculatingSolutions, setIsRecalculatingSolutions] = useState(false);
  const [hasAttemptedSolve, setHasAttemptedSolve] = useState(false);

  const recalcDepthRef = useRef(0);
  const recalcDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const recalcFilterOverridesRef = useRef<
    Partial<PlannerScheduleFilters> | undefined
  >(undefined);
  const recalcGenRef = useRef(0);
  const solvePacksRef = useRef(solvePacks);
  const solutionsRef = useRef(solutions);
  const itemsRef = useRef(plannerItems);
  const termRef = useRef(termCode);
  const prefetchGenRef = useRef(0);
  const requireOpenRef = useRef(requireOpenSections);
  const excludeTbaRef = useRef(excludeTba);
  const excludeOnlineAsyncRef = useRef(excludeOnlineAsync);
  const blackoutsRef = useRef(blackouts);
  const historyApiRef = useRef(createPlannerHistoryStacks());
  const historyStacksRef = useRef<PlannerHistoryStacks>({ undo: [], redo: [] });
  const isApplyingHistoryRef = useRef(false);
  const blackoutsUserGenRef = useRef(0);
  const blackoutsHandledGenRef = useRef(0);

  useEffect(() => {
    solvePacksRef.current = solvePacks;
  }, [solvePacks]);
  useEffect(() => {
    solutionsRef.current = solutions;
  }, [solutions]);
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

  const persistTerm = useCallback(() => {
    writeTerm(termRef.current, {
      items: itemsRef.current,
      blackouts: blackoutsRef.current,
    });
  }, []);

  const mergeSolvePack = useCallback((pack: CourseSolvePack) => {
    solvePacksRef.current = { ...solvePacksRef.current, [pack.courseKey]: pack };
    setSolvePacks(solvePacksRef.current);
  }, []);

  const loadCatalog = useCallback(async (items: PlannerItemRow[]) => {
    const t = termRef.current;
    const res = await loadPlannerCatalogForItemsAction(t, items);
    if (!res.ok) {
      setSyncError(res.error);
      return false;
    }
    setCatalog(res.catalog);
    setSyncError(null);
    return true;
  }, []);

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
          }
          return;
        }

        const blackoutIv = blackoutsDocToTimeIntervals(blackoutsRef.current);
        const prevSol = solutionsRef.current[0] ?? null;
        const prevSelections = prevSol?.selections ?? null;

        if (everyPlannerItemHasSolvePack(rows, packs)) {
          await yieldToMain();
          if (myGen !== recalcGenRef.current) return;

          const result = solveSchedulesFromPacks(rows, packs, {
            ...filters,
            blackoutIntervals: blackoutIv,
            previousSelections: prevSelections,
          });
          if (myGen !== recalcGenRef.current) return;
          setSyncError(null);
          setSolutions(result.solutions);
          persistTerm();
          return;
        }

        // Solve packs load via prefetch; avoid server fallback (legacy DB blackouts).
      } finally {
        recalcDepthRef.current -= 1;
        if (recalcDepthRef.current === 0) {
          setIsRecalculatingSolutions(false);
          if (itemsRef.current.length > 0) {
            setHasAttemptedSolve(true);
          }
        }
      }
    },
    [persistTerm],
  );

  const scheduleRecalculateSolutions = useCallback(
    (filterOverrides?: Partial<PlannerScheduleFilters>) => {
      if (filterOverrides) {
        recalcFilterOverridesRef.current = {
          ...recalcFilterOverridesRef.current,
          ...filterOverrides,
        };
      }
      if (recalcDebounceTimerRef.current) {
        clearTimeout(recalcDebounceTimerRef.current);
      }
      recalcDebounceTimerRef.current = setTimeout(() => {
        recalcDebounceTimerRef.current = null;
        const overrides = recalcFilterOverridesRef.current;
        recalcFilterOverridesRef.current = undefined;
        void recalculateSolutions(overrides);
      }, 50);
    },
    [recalculateSolutions],
  );

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
      excludeTba,
      excludeOnlineAsync,
      catalog,
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

  const clearSyncError = useCallback(() => setSyncError(null), []);
  const clearScheduleFeasibilityError = useCallback(
    () => setScheduleFeasibilityError(null),
    [],
  );

  const syncHistoryStacks = useCallback((stacks: PlannerHistoryStacks) => {
    historyStacksRef.current = stacks;
    setCanUndo(stacks.undo.length > 0);
    setCanRedo(stacks.redo.length > 0);
  }, []);

  const captureCurrentHistorySnapshot =
    useCallback((): PlannerHistorySnapshot => {
      return capturePlannerHistorySnapshot({
        plannerItems: itemsRef.current,
        blackouts: blackoutsRef.current,
        filters: {
          requireOpenSections: requireOpenRef.current,
          excludeTba: excludeTbaRef.current,
          excludeOnlineAsync: excludeOnlineAsyncRef.current,
        },
      });
    }, []);

  const recordHistorySnapshot = useCallback(() => {
    if (isApplyingHistoryRef.current) return;
    const state = historyApiRef.current.record(
      historyStacksRef.current,
      captureCurrentHistorySnapshot(),
    );
    syncHistoryStacks(state.stacks);
  }, [captureCurrentHistorySnapshot, syncHistoryStacks]);

  const setPlannerItemsFromContext = useCallback(
    (items: PlannerItemRow[]) => {
      itemsRef.current = items;
      setPlannerItems(items);
      persistTerm();
      void loadCatalog(items);
      scheduleRecalculateSolutions();
    },
    [persistTerm, loadCatalog, scheduleRecalculateSolutions],
  );

  const removePlannerItem = useCallback(
    (id: number) => {
      recordHistorySnapshot();
      setPlannerItems((prev) => {
        const next = prev.filter((r) => r.id !== id);
        itemsRef.current = next;
        return next;
      });
      persistTerm();
      scheduleRecalculateSolutions();
    },
    [persistTerm, scheduleRecalculateSolutions, recordHistorySnapshot],
  );

  const updatePlannerItem = useCallback(
    (id: number, patch: Partial<PlannerItemRow>) => {
      recordHistorySnapshot();
      setPlannerItems((prev) => {
        const next = prev.map((r) =>
          r.id === id ? { ...r, ...patch } : r,
        );
        itemsRef.current = next;
        return next;
      });
      persistTerm();
    },
    [persistTerm, recordHistorySnapshot],
  );

  const applyHistorySnapshot = useCallback(
    (snap: PlannerHistorySnapshot) => {
      isApplyingHistoryRef.current = true;
      itemsRef.current = snap.plannerItems;
      setPlannerItems(snap.plannerItems);
      blackoutsRef.current = snap.blackouts;
      setBlackoutsState(snap.blackouts);
      requireOpenRef.current = snap.filters.requireOpenSections;
      setRequireOpenSections(snap.filters.requireOpenSections);
      excludeTbaRef.current = snap.filters.excludeTba;
      setExcludeTba(snap.filters.excludeTba);
      excludeOnlineAsyncRef.current = snap.filters.excludeOnlineAsync;
      setExcludeOnlineAsync(snap.filters.excludeOnlineAsync);
      persistTerm();
      void loadCatalog(snap.plannerItems);
      scheduleRecalculateSolutions({ ...snap.filters });
      queueMicrotask(() => {
        isApplyingHistoryRef.current = false;
      });
    },
    [persistTerm, loadCatalog, scheduleRecalculateSolutions],
  );

  const undo = useCallback(() => {
    const result = historyApiRef.current.undo(
      historyStacksRef.current,
      captureCurrentHistorySnapshot(),
    );
    if (!result.snapshot) return;
    syncHistoryStacks(result.stacks);
    applyHistorySnapshot(result.snapshot);
  }, [
    captureCurrentHistorySnapshot,
    syncHistoryStacks,
    applyHistorySnapshot,
  ]);

  const redo = useCallback(() => {
    const result = historyApiRef.current.redo(
      historyStacksRef.current,
      captureCurrentHistorySnapshot(),
    );
    if (!result.snapshot) return;
    syncHistoryStacks(result.stacks);
    applyHistorySnapshot(result.snapshot);
  }, [
    captureCurrentHistorySnapshot,
    syncHistoryStacks,
    applyHistorySnapshot,
  ]);

  const refreshCatalogFromServer = useCallback(async (): Promise<boolean> => {
    const ok = await loadCatalog(itemsRef.current);
    if (ok) scheduleRecalculateSolutions();
    return ok;
  }, [loadCatalog, scheduleRecalculateSolutions]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setIsHydrating(true);
      const term = readTerm(termCode);
      itemsRef.current = term.items;
      setPlannerItems(term.items);
      blackoutsRef.current = term.blackouts;
      setBlackoutsState(term.blackouts);
      if (!cancelled) {
        await loadCatalog(term.items);
        setIsHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [termCode, loadCatalog, scheduleRecalculateSolutions]);

  useEffect(() => {
    return subscribeLocalDoc(() => {
      const term = readTerm(termRef.current);
      itemsRef.current = term.items;
      setPlannerItems(term.items);
      blackoutsRef.current = term.blackouts;
      setBlackoutsState(term.blackouts);
      void loadCatalog(term.items);
      scheduleRecalculateSolutions();
    });
  }, [loadCatalog, scheduleRecalculateSolutions]);

  useEffect(() => {
    return () => {
      if (recalcDebounceTimerRef.current) {
        clearTimeout(recalcDebounceTimerRef.current);
      }
    };
  }, []);

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
      recordHistorySnapshot();
      setPlannerItems(() => {
        itemsRef.current = next;
        return next;
      });
      persistTerm();
      scheduleRecalculateSolutions();
    },
    [persistTerm, scheduleRecalculateSolutions, recordHistorySnapshot],
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
      recordHistorySnapshot();
      setPlannerItems(() => {
        itemsRef.current = next;
        return next;
      });
      persistTerm();
      scheduleRecalculateSolutions();
    },
    [persistTerm, scheduleRecalculateSolutions, recordHistorySnapshot],
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
      recordHistorySnapshot();
      setPlannerItems(() => {
        itemsRef.current = next;
        return next;
      });
      persistTerm();
      scheduleRecalculateSolutions();
    },
    [persistTerm, scheduleRecalculateSolutions, recordHistorySnapshot],
  );

  const setBlackouts = useCallback(
    (
      next:
        | PlannerBlackoutsDocV1
        | ((prev: PlannerBlackoutsDocV1) => PlannerBlackoutsDocV1),
    ) => {
      recordHistorySnapshot();
      blackoutsUserGenRef.current += 1;
      setBlackoutsState((prev) => {
        const doc = typeof next === "function" ? next(prev) : next;
        blackoutsRef.current = doc;
        return doc;
      });
    },
    [recordHistorySnapshot],
  );

  useEffect(() => {
    if (blackoutsUserGenRef.current === blackoutsHandledGenRef.current) {
      return;
    }
    blackoutsHandledGenRef.current = blackoutsUserGenRef.current;
    persistTerm();
    scheduleRecalculateSolutions();
  }, [blackouts, persistTerm, scheduleRecalculateSolutions]);

  const plannerCourseKeysSignature = useMemo(() => {
    const keys = plannerItems.map((row) =>
      courseSolvePackCourseKey(row.subject, row.courseNumber),
    );
    keys.sort();
    return keys.join("\u0001");
  }, [plannerItems]);

  useEffect(() => {
    if (isHydrating || plannerCourseKeysSignature.length === 0) return;
    const t = termCode;
    let cancelled = false;
    const timer = setTimeout(() => {
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
        scheduleRecalculateSolutions();
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
        scheduleRecalculateSolutions();
      })();
    }, PACK_PREFETCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    termCode,
    plannerCourseKeysSignature,
    isHydrating,
    mergeSolvePack,
    scheduleRecalculateSolutions,
  ]);

  const setRequireOpenSectionsWithHistory = useCallback(
    (v: boolean) => {
      recordHistorySnapshot();
      setRequireOpenSections(v);
      scheduleRecalculateSolutions({ requireOpenSections: v });
    },
    [recordHistorySnapshot, scheduleRecalculateSolutions],
  );

  const setExcludeTbaWithHistory = useCallback(
    (v: boolean) => {
      recordHistorySnapshot();
      setExcludeTba(v);
      scheduleRecalculateSolutions({ excludeTba: v });
    },
    [recordHistorySnapshot, scheduleRecalculateSolutions],
  );

  const setExcludeOnlineAsyncWithHistory = useCallback(
    (v: boolean) => {
      recordHistorySnapshot();
      setExcludeOnlineAsync(v);
      scheduleRecalculateSolutions({ excludeOnlineAsync: v });
    },
    [recordHistorySnapshot, scheduleRecalculateSolutions],
  );

  const dataValue = useMemo<PlannerDataContextValue>(
    () => ({
      termCode,
      plannerItems,
      catalog,
      isHydrating,
      refreshCatalogFromServer,
      setPlannerItems: setPlannerItemsFromContext,
      removePlannerItem,
      updatePlannerItem,
      toggleSectionPin,
      setSectionPinFromDrag,
      applyPlannerItemSelection,
      solvePacks,
      mergeSolvePack,
      mergedPackConstraintMaps,
    }),
    [
      termCode,
      plannerItems,
      catalog,
      isHydrating,
      refreshCatalogFromServer,
      setPlannerItemsFromContext,
      removePlannerItem,
      updatePlannerItem,
      toggleSectionPin,
      setSectionPinFromDrag,
      applyPlannerItemSelection,
      solvePacks,
      mergeSolvePack,
      mergedPackConstraintMaps,
    ],
  );

  const solveValue = useMemo<PlannerSolveContextValue>(
    () => ({
      effectivePlannerItems,
      calendarBlocks,
      syncError,
      clearSyncError,
      scheduleFeasibilityError,
      clearScheduleFeasibilityError,
      solutions,
      infeasibilityHints,
      recalculateSolutions,
      scheduleRecalculateSolutions,
      isRecalculatingSolutions,
      hasAttemptedSolve,
    }),
    [
      effectivePlannerItems,
      calendarBlocks,
      syncError,
      scheduleFeasibilityError,
      clearSyncError,
      clearScheduleFeasibilityError,
      solutions,
      infeasibilityHints,
      recalculateSolutions,
      scheduleRecalculateSolutions,
      isRecalculatingSolutions,
      hasAttemptedSolve,
    ],
  );

  const uiValue = useMemo<PlannerUiContextValue>(
    () => ({
      requireOpenSections,
      setRequireOpenSections: setRequireOpenSectionsWithHistory,
      excludeTba,
      setExcludeTba: setExcludeTbaWithHistory,
      excludeOnlineAsync,
      setExcludeOnlineAsync: setExcludeOnlineAsyncWithHistory,
      blackouts,
      setBlackouts,
    }),
    [
      requireOpenSections,
      excludeTba,
      excludeOnlineAsync,
      blackouts,
      setBlackouts,
      setRequireOpenSectionsWithHistory,
      setExcludeTbaWithHistory,
      setExcludeOnlineAsyncWithHistory,
    ],
  );

  const historyValue = useMemo<PlannerHistoryContextValue>(
    () => ({
      canUndo,
      canRedo,
      undo,
      redo,
      recordHistorySnapshot,
    }),
    [canUndo, canRedo, undo, redo, recordHistorySnapshot],
  );

  return (
    <PlannerDataContext.Provider value={dataValue}>
      <PlannerSolveContext.Provider value={solveValue}>
        <PlannerUiContext.Provider value={uiValue}>
          <PlannerHistoryContext.Provider value={historyValue}>
            {isHydrating ? (
              <p
                className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                Restoring your courses&hellip;
              </p>
            ) : (
              children
            )}
          </PlannerHistoryContext.Provider>
        </PlannerUiContext.Provider>
      </PlannerSolveContext.Provider>
    </PlannerDataContext.Provider>
  );
}

export function usePlannerData(): PlannerDataContextValue {
  const ctx = useContext(PlannerDataContext);
  if (!ctx) throw new Error("usePlannerData must be used within PlannerProvider");
  return ctx;
}

export function usePlannerSolve(): PlannerSolveContextValue {
  const ctx = useContext(PlannerSolveContext);
  if (!ctx) throw new Error("usePlannerSolve must be used within PlannerProvider");
  return ctx;
}

export function usePlannerUi(): PlannerUiContextValue {
  const ctx = useContext(PlannerUiContext);
  if (!ctx) throw new Error("usePlannerUi must be used within PlannerProvider");
  return ctx;
}

export function usePlannerHistory(): PlannerHistoryContextValue {
  const ctx = useContext(PlannerHistoryContext);
  if (!ctx) {
    throw new Error("usePlannerHistory must be used within PlannerProvider");
  }
  return ctx;
}
