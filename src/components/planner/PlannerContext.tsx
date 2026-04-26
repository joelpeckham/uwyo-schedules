"use client";

import {
  loadPlannerCatalogBootstrapAction,
  prefetchCourseSolvePackAction,
  solveSchedulesAction,
  syncPlannerStateAction,
  updatePlannerTermUiStateAction,
} from "@/app/planner/actions";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import { buildCalendarBlocksFromCatalog } from "@/lib/planner/client/derive";
import type { CalendarBlock, PlannerItemRow } from "@/lib/planner/data";
import type { ResolvedPlannerSelection } from "@/lib/planner/resolve-display-crns-shared";
import {
  courseSolvePackCourseKey,
  everyPlannerItemHasSolvePack,
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
const UI_STATE_DEBOUNCE_MS = 800;
const PACK_PREFETCH_DEBOUNCE_MS = 400;

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
  /** Calendar reflects the current paged solution preview (merged in memory). */
  effectivePlannerItems: PlannerItemRow[];
  calendarBlocks: CalendarBlock[];
  syncError: string | null;
  clearSyncError: () => void;
  refreshCatalogFromServer: () => Promise<boolean>;
  setPlannerItems: (items: PlannerItemRow[]) => void;
  removePlannerItem: (id: number) => void;
  updatePlannerItem: (id: number, patch: Partial<PlannerItemRow>) => void;
  schedulePersist: () => void;
  solutions: ScheduleSolution[];
  solutionsCapped: boolean;
  solutionsTimedOut: boolean;
  solutionIndex: number;
  setSolutionIndex: (n: number) => void;
  favoriteSolutionIndex: number | null;
  setFavoriteSolutionIndex: (n: number | null) => void;
  requireOpenSections: boolean;
  setRequireOpenSections: (v: boolean) => void;
  recalculateSolutions: (requireOpenOverride?: boolean) => Promise<void>;
  /** Prefetched per-course solve payloads (client-side DFS when complete). */
  solvePacks: Record<string, CourseSolvePack>;
  mergeSolvePack: (pack: CourseSolvePack) => void;
};

const PlannerContext = createContext<PlannerContextValue | null>(null);

type ProviderProps = {
  termCode: string;
  initialPlannerItems: PlannerItemRow[];
  initialCatalog: PlannerCatalogJson;
  initialTermUiState: {
    lastSolutionIndex: number;
    favoriteSolutionIndex: number | null;
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

  const [solutions, setSolutions] = useState<ScheduleSolution[]>([]);
  const [solutionsCapped, setSolutionsCapped] = useState(false);
  const [solutionsTimedOut, setSolutionsTimedOut] = useState(false);
  const [solutionIndex, setSolutionIndexState] = useState(() =>
    Math.max(0, initialTermUiState?.lastSolutionIndex ?? 0),
  );
  const [favoriteSolutionIndex, setFavoriteSolutionIndex] = useState<
    number | null
  >(initialTermUiState?.favoriteSolutionIndex ?? null);
  const [requireOpenSections, setRequireOpenSections] = useState(false);
  const [solvePacks, setSolvePacks] = useState<Record<string, CourseSolvePack>>(
    {},
  );
  const solvePacksRef = useRef(solvePacks);
  solvePacksRef.current = solvePacks;

  const mergeSolvePack = useCallback((pack: CourseSolvePack) => {
    solvePacksRef.current = { ...solvePacksRef.current, [pack.courseKey]: pack };
    setSolvePacks(solvePacksRef.current);
  }, []);

  const solutionsRef = useRef(solutions);
  useEffect(() => {
    solutionsRef.current = solutions;
  }, [solutions]);

  useEffect(() => {
    setPlannerItems(initialPlannerItems);
  }, [initialPlannerItems]);

  useEffect(() => {
    setCatalog(initialCatalog);
  }, [initialCatalog]);

  useEffect(() => {
    solvePacksRef.current = {};
    setSolvePacks({});
  }, [termCode]);

  const itemsRef = useRef(plannerItems);
  const termRef = useRef(termCode);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistInFlightRef = useRef(false);
  const uiPersistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requireOpenRef = useRef(requireOpenSections);

  useEffect(() => {
    itemsRef.current = plannerItems;
  }, [plannerItems]);
  useEffect(() => {
    termRef.current = termCode;
  }, [termCode]);
  useEffect(() => {
    requireOpenRef.current = requireOpenSections;
  }, [requireOpenSections]);

  const setSolutionIndex = useCallback((n: number) => {
    const sols = solutionsRef.current;
    if (sols.length === 0) {
      setSolutionIndexState(0);
      return;
    }
    setSolutionIndexState(Math.min(Math.max(0, n), sols.length - 1));
  }, []);

  useEffect(() => {
    if (solutions.length === 0) {
      setSolutionIndexState(0);
      return;
    }
    setSolutionIndexState((prev) => Math.min(prev, solutions.length - 1));
  }, [solutions.length]);

  const effectivePlannerItems = useMemo(() => {
    const sol = solutions[solutionIndex] ?? null;
    return applySolutionToPlannerItems(plannerItems, sol);
  }, [plannerItems, solutions, solutionIndex]);

  const calendarBlocks = useMemo(
    () => buildCalendarBlocksFromCatalog(effectivePlannerItems, catalog),
    [effectivePlannerItems, catalog],
  );

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

  const schedulePersist = useCallback(() => {
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = null;
      void flushPersist();
    }, PERSIST_DEBOUNCE_MS);
  }, [flushPersist]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        if (persistTimerRef.current) {
          clearTimeout(persistTimerRef.current);
          persistTimerRef.current = null;
        }
        void flushPersist();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [flushPersist]);

  useEffect(() => {
    const onLeave = () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
      void flushPersist();
    };
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [flushPersist]);

  useEffect(() => {
    if (uiPersistTimerRef.current) clearTimeout(uiPersistTimerRef.current);
    uiPersistTimerRef.current = setTimeout(() => {
      uiPersistTimerRef.current = null;
      void updatePlannerTermUiStateAction({
        termCode: termRef.current,
        lastSolutionIndex: solutionIndex,
        favoriteSolutionIndex: favoriteSolutionIndex,
      });
    }, UI_STATE_DEBOUNCE_MS);
    return () => {
      if (uiPersistTimerRef.current) {
        clearTimeout(uiPersistTimerRef.current);
        uiPersistTimerRef.current = null;
      }
    };
  }, [solutionIndex, favoriteSolutionIndex, termCode]);

  const refreshCatalogFromServer = useCallback(async (): Promise<boolean> => {
    const res = await loadPlannerCatalogBootstrapAction(termCode);
    if (!res.ok) {
      setSyncError(res.error);
      return false;
    }
    setPlannerItems(res.plannerItems);
    setCatalog(res.catalog);
    setSolutions([]);
    setSolutionIndexState(
      Math.max(0, res.termUiState?.lastSolutionIndex ?? 0),
    );
    setFavoriteSolutionIndex(res.termUiState?.favoriteSolutionIndex ?? null);
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
      setPlannerItems((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      );
      schedulePersist();
    },
    [schedulePersist],
  );

  const recalculateSolutions = useCallback(async (requireOpenOverride?: boolean) => {
    const requireOpen =
      requireOpenOverride !== undefined
        ? requireOpenOverride
        : requireOpenRef.current;
    const rows = itemsRef.current;
    const packs = solvePacksRef.current;

    if (rows.length === 0) {
      setSyncError(null);
      setSolutions([]);
      setSolutionsCapped(false);
      setSolutionsTimedOut(false);
      setSolutionIndexState(0);
      return;
    }

    if (everyPlannerItemHasSolvePack(rows, packs)) {
      const result = solveSchedulesFromPacks(rows, packs, {
        requireOpenSections: requireOpen,
      });
      setSyncError(null);
      setSolutions(result.solutions);
      setSolutionsCapped(result.capped);
      setSolutionsTimedOut(result.timedOut);
      setSolutionIndexState((prev) => {
        if (result.solutions.length === 0) return 0;
        return Math.min(Math.max(0, prev), result.solutions.length - 1);
      });
      return;
    }

    const res = await solveSchedulesAction(termRef.current, requireOpen);
    if (!res.ok) {
      setSyncError(res.error);
      return;
    }
    setSyncError(null);
    const sols = res.result.solutions;
    setSolutions(sols);
    setSolutionsCapped(res.result.capped);
    setSolutionsTimedOut(res.result.timedOut);
    setSolutionIndexState((prev) => {
      if (sols.length === 0) return 0;
      return Math.min(Math.max(0, prev), sols.length - 1);
    });
  }, []);

  const recalculateSolutionsRef = useRef(recalculateSolutions);
  recalculateSolutionsRef.current = recalculateSolutions;

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
      clearSyncError: () => setSyncError(null),
      refreshCatalogFromServer,
      setPlannerItems: (items) => {
        setPlannerItems(items);
        schedulePersist();
      },
      removePlannerItem,
      updatePlannerItem,
      schedulePersist,
      solutions,
      solutionsCapped,
      solutionsTimedOut,
      solutionIndex,
      setSolutionIndex,
      favoriteSolutionIndex,
      setFavoriteSolutionIndex,
      requireOpenSections,
      setRequireOpenSections,
      recalculateSolutions,
      solvePacks,
      mergeSolvePack,
    }),
    [
      termCode,
      plannerItems,
      catalog,
      effectivePlannerItems,
      calendarBlocks,
      syncError,
      refreshCatalogFromServer,
      removePlannerItem,
      updatePlannerItem,
      schedulePersist,
      solutions,
      solutionsCapped,
      solutionsTimedOut,
      solutionIndex,
      setSolutionIndex,
      favoriteSolutionIndex,
      requireOpenSections,
      recalculateSolutions,
      solvePacks,
      mergeSolvePack,
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
