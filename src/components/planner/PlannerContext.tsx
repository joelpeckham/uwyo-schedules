"use client";

import {
  loadPlannerBootstrapAction,
  loadPlannerCatalogExamEnrichmentAction,
  loadPlannerCatalogForItemsAction,
  prefetchCourseSolvePacksAction,
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
import { mergePackConstraintMaps } from "@/lib/planner/planner-swap-feasibility";
import {
  cancelSolveRequest,
  requestSolve,
} from "@/lib/planner/solve-worker-client";
import type { InfeasibilityHint } from "@/lib/planner/infeasibility-hints";
import { showPlannerError, showPlannerSuccess } from "@/lib/planner/planner-toast";
import { courseDisplayTitle } from "@/lib/planner/course-display-title";
import {
  auditItemsWithFullSavedSections,
} from "@/lib/planner/seat-audit";
import {
  parseItemScheduleFilters,
  serializeItemScheduleFilters,
  type PlannerItemScheduleFiltersV1,
  type PlannerScheduleFilters,
} from "@/lib/planner/schedule-filters";
import type { CalendarBlock, PlannerItemRow } from "@/lib/planner/data";
import {
  defaultInstructorPrefs,
  hasInstructorPrefs,
  parseInstructorPrefs,
} from "@/lib/planner/instructor-prefs";
import {
  countPlannerSectionPins,
  EMPTY_SECTION_PINS,
  parseSectionPinsJson,
} from "@/lib/planner/section-pins";
import type { ResolvedPlannerSelection } from "@/lib/planner/resolve-display-crns-shared";
import {
  courseSolvePackCourseKey,
  plannerItemsFeasibility,
  everyPlannerItemHasSolvePack,
  WORKER_SOLVE_TIMEOUT_MS,
  type CourseSolvePack,
  type ScheduleSolution,
} from "@/lib/planner/solve-schedules-core";
import { yieldToMain } from "@/lib/planner/yield-to-main";
import { applyPlannerBootstrap, syncPlannerItemsDataset } from "@/lib/planner/planner-bootstrap";
import {
  plannerCourseTitleKey,
  readTerm,
  subscribeLocalDoc,
  writeTerm,
  writeTitles,
} from "@/lib/planner/local-state";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
  /** Cached course display titles (instant render before catalog loads). */
  courseTitles: Record<string, string>;
  catalog: PlannerCatalogJson;
  isHydrating: boolean;
  refreshCatalogFromServer: () => Promise<boolean>;
  reloadPlannerBootstrap: () => Promise<void>;
  setPlannerItems: (items: PlannerItemRow[]) => void;
  removePlannerItem: (id: number) => void;
  updatePlannerItem: (id: number, patch: Partial<PlannerItemRow>) => void;
  updateItemScheduleFilters: (
    itemId: number,
    patch: Partial<PlannerScheduleFilters>,
  ) => void;
  applyScheduleFiltersToAll: (filters: PlannerItemScheduleFiltersV1) => void;
  toggleSectionPin: (itemId: number, scheduleTypeKey: string, sectionCrn: string) => void;
  clearSectionPins: (itemId: number) => void;
  clearAllSectionPins: () => void;
  clearInstructorPrefs: (itemId: number) => void;
  clearAllInstructorPrefs: () => void;
  setSectionPinFromDrag: (
    itemId: number,
    scheduleTypeKey: string,
    sectionCrn: string,
    opts?: { unpinAfterRecalc?: boolean },
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
  solutions: ScheduleSolution[];
  infeasibilityHints: InfeasibilityHint[];
  recalculateSolutions: () => Promise<void>;
  scheduleRecalculateSolutions: () => void;
  isRecalculatingSolutions: boolean;
  hasAttemptedSolve: boolean;
};

type PlannerUiContextValue = {
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
  lastActionWasBusyAddOrUpdate: boolean;
};

const PlannerDataContext = createContext<PlannerDataContextValue | null>(null);
const PlannerSolveContext = createContext<PlannerSolveContextValue | null>(null);
const PlannerUiContext = createContext<PlannerUiContextValue | null>(null);
const PlannerHistoryContext = createContext<PlannerHistoryContextValue | null>(
  null,
);

function blackoutsChangeWasAddOrUpdate(
  prev: PlannerBlackoutsDocV1,
  next: PlannerBlackoutsDocV1,
): boolean {
  const prevById = new Map(prev.items.map((item) => [item.id, item]));
  for (const item of next.items) {
    const before = prevById.get(item.id);
    if (!before) return true;
    if (
      before.dayIndex !== item.dayIndex ||
      before.start !== item.start ||
      before.end !== item.end ||
      (before.label ?? "") !== (item.label ?? "")
    ) {
      return true;
    }
  }
  return false;
}

type ProviderProps = {
  termCode: string;
  children: React.ReactNode;
};

export function PlannerProvider({ termCode, children }: ProviderProps) {
  const [isHydrating, setIsHydrating] = useState(true);
  const [plannerItems, setPlannerItems] = useState<PlannerItemRow[]>([]);
  const [courseTitles, setCourseTitles] = useState<Record<string, string>>({});
  const [catalog, setCatalog] = useState<PlannerCatalogJson>(EMPTY_CATALOG);

  const [solutions, setSolutions] = useState<ScheduleSolution[]>([]);
  const [blackouts, setBlackoutsState] = useState<PlannerBlackoutsDocV1>(
    EMPTY_BLACKOUTS,
  );
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [lastActionWasBusyAddOrUpdate, setLastActionWasBusyAddOrUpdate] =
    useState(false);
  const [solvePacks, setSolvePacks] = useState<Record<string, CourseSolvePack>>(
    {},
  );
  const [isRecalculatingSolutions, setIsRecalculatingSolutions] = useState(false);
  const [hasAttemptedSolve, setHasAttemptedSolve] = useState(false);

  const recalcDepthRef = useRef(0);
  const recalcDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const recalcGenRef = useRef(0);
  const solveRequestIdRef = useRef(0);
  const [infeasibilityHints, setInfeasibilityHints] = useState<
    InfeasibilityHint[]
  >([]);
  const solvePacksRef = useRef(solvePacks);
  const solutionsRef = useRef(solutions);
  const itemsRef = useRef(plannerItems);
  const termRef = useRef(termCode);
  const prefetchGenRef = useRef(0);
  const catalogLoadGenRef = useRef(0);
  const blackoutsRef = useRef(blackouts);
  const catalogRef = useRef(catalog);
  const historyApiRef = useRef(createPlannerHistoryStacks());
  const historyStacksRef = useRef<PlannerHistoryStacks>({ undo: [], redo: [] });
  const isApplyingHistoryRef = useRef(false);
  const blackoutsUserGenRef = useRef(0);
  const blackoutsHandledGenRef = useRef(0);
  const initialBootstrapDoneRef = useRef(false);
  const seatAuditAppliedRef = useRef(false);
  const ephemeralUnpinAfterRecalcRef = useRef<{
    itemId: number;
    scheduleTypeKey: string;
  } | null>(null);

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
    blackoutsRef.current = blackouts;
  }, [blackouts]);
  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);

  const persistTerm = useCallback(() => {
    writeTerm(termRef.current, {
      items: itemsRef.current,
      blackouts: blackoutsRef.current,
    });
  }, []);

  const cacheTitlesFromCatalog = useCallback(
    (items: PlannerItemRow[], catalogSlice: PlannerCatalogJson) => {
      const term = readTerm(termRef.current);
      const patch: Record<string, string> = {};
      for (const item of items) {
        const key = plannerCourseTitleKey(item.subject, item.courseNumber);
        const title = courseDisplayTitle(
          catalogSlice.sections,
          item.subject,
          item.courseNumber,
        );
        if (title && term.titles[key] !== title) {
          patch[key] = title;
        }
      }
      if (Object.keys(patch).length > 0) {
        writeTitles(termRef.current, patch);
      }
      setCourseTitles({ ...term.titles, ...patch });
    },
    [],
  );

  const applySeatAuditOnLoad = useCallback(
    (
      items: PlannerItemRow[],
      packs: CourseSolvePack[],
      catalogSlice: PlannerCatalogJson,
    ): PlannerItemRow[] => {
      const hits = auditItemsWithFullSavedSections(items, packs, catalogSlice);
      if (hits.length === 0) return items;

      const hitIds = new Set(hits.map((h) => h.id));
      const next = items.map((item) => {
        if (!hitIds.has(item.id)) return item;
        const f = parseItemScheduleFilters(item.scheduleFilters);
        return {
          ...item,
          scheduleFilters: serializeItemScheduleFilters({
            ...f,
            requireOpenSections: false,
          }),
        };
      });

      const codes = hits.map((h) => `${h.subject} ${h.courseNumber}`);
      if (codes.length === 1) {
        showPlannerSuccess(
          `Turned off "Exclude full" for ${codes[0]} — that saved section is now full.`,
        );
      } else {
        showPlannerSuccess(
          `Turned off "Exclude full" for ${codes.join(", ")} — saved sections are now full.`,
        );
      }
      return next;
    },
    [],
  );

  const mergeSolvePack = useCallback((pack: CourseSolvePack) => {
    solvePacksRef.current = { ...solvePacksRef.current, [pack.courseKey]: pack };
    setSolvePacks(solvePacksRef.current);
  }, []);

  const mergeSolvePacks = useCallback((packs: CourseSolvePack[]) => {
    if (packs.length === 0) return;
    const next = { ...solvePacksRef.current };
    for (const pack of packs) {
      next[pack.courseKey] = pack;
    }
    solvePacksRef.current = next;
    setSolvePacks(next);
  }, []);

  const loadCatalog = useCallback(async (items: PlannerItemRow[]) => {
    const t = termRef.current;
    const myGen = ++catalogLoadGenRef.current;
    const res = await loadPlannerCatalogForItemsAction(t, items);
    if (myGen !== catalogLoadGenRef.current) return false;
    if (!res.ok) {
      showPlannerError(res.error);
      return false;
    }
    setCatalog(res.catalog);
    cacheTitlesFromCatalog(items, res.catalog);
    void (async () => {
      const enrichRes = await loadPlannerCatalogExamEnrichmentAction(t, items);
      if (myGen !== catalogLoadGenRef.current) return;
      if (!enrichRes.ok) return;
      setCatalog((prev) => ({
        ...prev,
        examReservationsByCrn: enrichRes.examReservationsByCrn,
        vagueExamNoteByCrn: enrichRes.vagueExamNoteByCrn,
      }));
    })();

    return true;
  }, [cacheTitlesFromCatalog]);

  const loadBootstrap = useCallback(
    async (items: PlannerItemRow[]) => {
      const t = termRef.current;
      const myGen = ++catalogLoadGenRef.current;
      try {
        const res = await loadPlannerBootstrapAction(t, items);
        if (myGen !== catalogLoadGenRef.current) return false;
        if (!res.ok) {
          showPlannerError(res.error);
          return false;
        }
        setCatalog(res.catalog);
        mergeSolvePacks(res.packs);
        cacheTitlesFromCatalog(itemsRef.current, res.catalog);

        if (!seatAuditAppliedRef.current) {
          seatAuditAppliedRef.current = true;
          const audited = applySeatAuditOnLoad(
            itemsRef.current,
            res.packs,
            res.catalog,
          );
          if (audited !== itemsRef.current) {
            itemsRef.current = audited;
            setPlannerItems(audited);
            persistTerm();
          }
        }

        void (async () => {
          const enrichRes = await loadPlannerCatalogExamEnrichmentAction(t, items);
          if (myGen !== catalogLoadGenRef.current) return;
          if (!enrichRes.ok) return;
          setCatalog((prev) => ({
            ...prev,
            examReservationsByCrn: enrichRes.examReservationsByCrn,
            vagueExamNoteByCrn: enrichRes.vagueExamNoteByCrn,
          }));
        })();

        return true;
      } finally {
        if (myGen === catalogLoadGenRef.current) {
          initialBootstrapDoneRef.current = true;
        }
      }
    },
    [mergeSolvePacks, cacheTitlesFromCatalog, applySeatAuditOnLoad, persistTerm],
  );

  const recalculateSolutions = useCallback(async () => {
      const myGen = ++recalcGenRef.current;
      recalcDepthRef.current += 1;
      if (recalcDepthRef.current === 1) setIsRecalculatingSolutions(true);
      try {
        const rows = itemsRef.current;
        const packs = solvePacksRef.current;

        if (rows.length === 0) {
          if (myGen === recalcGenRef.current) {
            setSolutions([]);
            setInfeasibilityHints([]);
          }
          return;
        }

        const blackoutIv = blackoutsDocToTimeIntervals(blackoutsRef.current);
        const prevSol = solutionsRef.current[0] ?? null;
        const prevSelections = prevSol?.selections ?? null;

        if (everyPlannerItemHasSolvePack(rows, packs)) {
          await yieldToMain();
          if (myGen !== recalcGenRef.current) return;

          const requestId = ++solveRequestIdRef.current;
          const result = await requestSolve(
            {
              items: rows,
              packs,
              blackoutIntervals: blackoutIv,
              previousSelections: prevSelections,
              timeoutMs: WORKER_SOLVE_TIMEOUT_MS,
              catalog: catalogRef.current,
              blackouts: blackoutsRef.current,
            },
            { requestId },
          );
          if (myGen !== recalcGenRef.current) {
            cancelSolveRequest(requestId);
            return;
          }
          setSolutions(result.solutions);
          setInfeasibilityHints(
            result.solutions.length > 0 ? [] : result.hints,
          );
          const ephemeralUnpin = ephemeralUnpinAfterRecalcRef.current;
          if (ephemeralUnpin) {
            ephemeralUnpinAfterRecalcRef.current = null;
            if (result.solutions.length > 0) {
              const unpinned = itemsRef.current.map((r) => {
                if (
                  r.id !== ephemeralUnpin.itemId ||
                  r.selectionKind !== "unresolved"
                ) {
                  return r;
                }
                const pins = parseSectionPinsJson(r.sectionPins);
                const byType = { ...pins.byType };
                delete byType[ephemeralUnpin.scheduleTypeKey];
                return { ...r, sectionPins: { v: pins.v, byType } };
              });
              itemsRef.current = unpinned;
              setPlannerItems(unpinned);
            }
          }
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

  const scheduleRecalculateSolutions = useCallback(() => {
      if (recalcDebounceTimerRef.current) {
        clearTimeout(recalcDebounceTimerRef.current);
      }
      recalcDebounceTimerRef.current = setTimeout(() => {
        recalcDebounceTimerRef.current = null;
        void recalculateSolutions();
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
        solutions: solutionsRef.current,
      });
    }, []);

  const recordHistorySnapshot = useCallback(() => {
    if (isApplyingHistoryRef.current) return;
    setLastActionWasBusyAddOrUpdate(false);
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

  const updateItemScheduleFilters = useCallback(
    (itemId: number, patch: Partial<PlannerScheduleFilters>) => {
      recordHistorySnapshot();
      setPlannerItems((prev) => {
        const next = prev.map((r) => {
          if (r.id !== itemId) return r;
          const cur = parseItemScheduleFilters(r.scheduleFilters);
          return {
            ...r,
            scheduleFilters: serializeItemScheduleFilters({
              v: 1,
              requireOpenSections:
                patch.requireOpenSections ?? cur.requireOpenSections,
              excludeTba: patch.excludeTba ?? cur.excludeTba,
              excludeOnlineAsync:
                patch.excludeOnlineAsync ?? cur.excludeOnlineAsync,
            }),
          };
        });
        itemsRef.current = next;
        return next;
      });
      persistTerm();
      scheduleRecalculateSolutions();
    },
    [persistTerm, recordHistorySnapshot, scheduleRecalculateSolutions],
  );

  const applyScheduleFiltersToAll = useCallback(
    (filters: PlannerItemScheduleFiltersV1) => {
      recordHistorySnapshot();
      const serialized = serializeItemScheduleFilters(filters);
      setPlannerItems((prev) => {
        const next = prev.map((r) =>
          r.selectionKind === "unresolved"
            ? { ...r, scheduleFilters: serialized }
            : r,
        );
        itemsRef.current = next;
        return next;
      });
      persistTerm();
      scheduleRecalculateSolutions();
    },
    [persistTerm, recordHistorySnapshot, scheduleRecalculateSolutions],
  );

  const applyHistorySnapshot = useCallback(
    (snap: PlannerHistorySnapshot) => {
      isApplyingHistoryRef.current = true;
      if (recalcDebounceTimerRef.current) {
        clearTimeout(recalcDebounceTimerRef.current);
        recalcDebounceTimerRef.current = null;
      }
      recalcGenRef.current += 1;
      itemsRef.current = snap.plannerItems;
      setPlannerItems(snap.plannerItems);
      blackoutsRef.current = snap.blackouts;
      setBlackoutsState(snap.blackouts);
      solutionsRef.current = snap.solutions;
      setSolutions(snap.solutions);
      persistTerm();
      void loadCatalog(snap.plannerItems);
      queueMicrotask(() => {
        isApplyingHistoryRef.current = false;
      });
    },
    [persistTerm, loadCatalog],
  );

  const undo = useCallback(() => {
    const result = historyApiRef.current.undo(
      historyStacksRef.current,
      captureCurrentHistorySnapshot(),
    );
    if (!result.snapshot) return;
    setLastActionWasBusyAddOrUpdate(false);
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
    setLastActionWasBusyAddOrUpdate(false);
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

  const reloadPlannerBootstrap = useCallback(async () => {
    seatAuditAppliedRef.current = false;
    const ok = await loadBootstrap(itemsRef.current);
    if (ok) scheduleRecalculateSolutions();
  }, [loadBootstrap, scheduleRecalculateSolutions]);

  useLayoutEffect(() => {
    initialBootstrapDoneRef.current = false;
    seatAuditAppliedRef.current = false;
    applyPlannerBootstrap(termCode);
    const term = readTerm(termCode);
    itemsRef.current = term.items;
    blackoutsRef.current = term.blackouts;
    syncPlannerItemsDataset(term.items.length);
    /* eslint-disable react-hooks/set-state-in-effect -- intentional one-shot local restore */
    setPlannerItems(term.items);
    setBlackoutsState(term.blackouts);
    setCourseTitles(term.titles);
    setIsHydrating(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [termCode]);

  useEffect(() => {
    let cancelled = false;
    const term = readTerm(termCode);
    void (async () => {
      if (cancelled) return;
      const ok = await loadBootstrap(term.items);
      if (cancelled) return;
      if (ok) scheduleRecalculateSolutions();
    })();
    return () => {
      cancelled = true;
    };
  }, [termCode, loadBootstrap, scheduleRecalculateSolutions]);

  useLayoutEffect(() => {
    syncPlannerItemsDataset(plannerItems.length);
  }, [plannerItems.length]);

  useEffect(() => {
    return subscribeLocalDoc(() => {
      const term = readTerm(termRef.current);
      itemsRef.current = term.items;
      setPlannerItems(term.items);
      blackoutsRef.current = term.blackouts;
      setBlackoutsState(term.blackouts);
      setCourseTitles(term.titles);
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
          blackoutIntervals: blackoutsDocToTimeIntervals(blackoutsRef.current),
          timeoutMs: PREVIEW_FEASIBILITY_TIMEOUT_MS,
        }) === "infeasible"
      ) {
        showPlannerError(
          "That section doesn't fit with your other courses and pins.",
        );
        return;
      }
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
          blackoutIntervals: blackoutsDocToTimeIntervals(blackoutsRef.current),
          timeoutMs: PREVIEW_FEASIBILITY_TIMEOUT_MS,
        }) === "infeasible"
      ) {
        showPlannerError(
          "That pin doesn't fit with your other courses and pins.",
        );
        return;
      }
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

  const clearSectionPins = useCallback(
    (itemId: number) => {
      const prev = itemsRef.current;
      const row = prev.find((r) => r.id === itemId);
      if (!row || row.selectionKind !== "unresolved") return;
      const pins = parseSectionPinsJson(row.sectionPins);
      if (Object.keys(pins.byType).length === 0) return;
      const next = prev.map((r) =>
        r.id === itemId && r.selectionKind === "unresolved"
          ? { ...r, sectionPins: EMPTY_SECTION_PINS }
          : r,
      );
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

  const clearAllSectionPins = useCallback(() => {
    const prev = itemsRef.current;
    const pinCount = countPlannerSectionPins(prev);
    if (pinCount === 0) return;
    const next = prev.map((r) =>
      r.selectionKind === "unresolved" &&
      Object.keys(parseSectionPinsJson(r.sectionPins).byType).length > 0
        ? { ...r, sectionPins: EMPTY_SECTION_PINS }
        : r,
    );
    recordHistorySnapshot();
    setPlannerItems(() => {
      itemsRef.current = next;
      return next;
    });
    persistTerm();
    scheduleRecalculateSolutions();
  }, [persistTerm, scheduleRecalculateSolutions, recordHistorySnapshot]);

  const clearInstructorPrefs = useCallback(
    (itemId: number) => {
      const prev = itemsRef.current;
      const row = prev.find((r) => r.id === itemId);
      if (!row || row.selectionKind !== "unresolved") return;
      const prefs = parseInstructorPrefs(row.instructorPrefs);
      if (!hasInstructorPrefs(prefs)) return;
      const next = prev.map((r) =>
        r.id === itemId && r.selectionKind === "unresolved"
          ? { ...r, instructorPrefs: defaultInstructorPrefs() }
          : r,
      );
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

  const clearAllInstructorPrefs = useCallback(() => {
    const prev = itemsRef.current;
    let courseCount = 0;
    const next = prev.map((r) => {
      if (r.selectionKind !== "unresolved") return r;
      const prefs = parseInstructorPrefs(r.instructorPrefs);
      if (!hasInstructorPrefs(prefs)) return r;
      courseCount += 1;
      return { ...r, instructorPrefs: defaultInstructorPrefs() };
    });
    if (courseCount === 0) return;
    recordHistorySnapshot();
    setPlannerItems(() => {
      itemsRef.current = next;
      return next;
    });
    persistTerm();
    scheduleRecalculateSolutions();
  }, [persistTerm, scheduleRecalculateSolutions, recordHistorySnapshot]);

  const setSectionPinFromDrag = useCallback(
    (
      itemId: number,
      scheduleTypeKey: string,
      sectionCrn: string,
      opts?: { unpinAfterRecalc?: boolean },
    ) => {
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
          blackoutIntervals: blackoutsDocToTimeIntervals(blackoutsRef.current),
          timeoutMs: PREVIEW_FEASIBILITY_TIMEOUT_MS,
        }) === "infeasible"
      ) {
        showPlannerError(
          "That move doesn't fit with your other courses and pins.",
        );
        return;
      }
      recordHistorySnapshot();
      setPlannerItems(() => {
        itemsRef.current = next;
        return next;
      });
      persistTerm();
      if (opts?.unpinAfterRecalc) {
        ephemeralUnpinAfterRecalcRef.current = { itemId, scheduleTypeKey };
      }
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
      const prev = blackoutsRef.current;
      const doc = typeof next === "function" ? next(prev) : next;
      const wasAddOrUpdate = blackoutsChangeWasAddOrUpdate(prev, doc);
      recordHistorySnapshot();
      if (wasAddOrUpdate) {
        setLastActionWasBusyAddOrUpdate(true);
      }
      blackoutsUserGenRef.current += 1;
      setBlackoutsState(() => {
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
    if (!initialBootstrapDoneRef.current) return;
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
        const missingCourses = missing.map(([, c]) => c);
        const res = await prefetchCourseSolvePacksAction(t, missingCourses);
        if (cancelled) return;
        if (myGen !== prefetchGenRef.current) return;
        if (termRef.current !== t) return;
        if (res.ok) mergeSolvePacks(res.packs);
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
    mergeSolvePacks,
    scheduleRecalculateSolutions,
  ]);

  const dataValue = useMemo<PlannerDataContextValue>(
    () => ({
      termCode,
      plannerItems,
      courseTitles,
      catalog,
      isHydrating,
      refreshCatalogFromServer,
      reloadPlannerBootstrap,
      setPlannerItems: setPlannerItemsFromContext,
      removePlannerItem,
      updatePlannerItem,
      updateItemScheduleFilters,
      applyScheduleFiltersToAll,
      toggleSectionPin,
      clearSectionPins,
      clearAllSectionPins,
      clearInstructorPrefs,
      clearAllInstructorPrefs,
      setSectionPinFromDrag,
      applyPlannerItemSelection,
      solvePacks,
      mergeSolvePack,
      mergedPackConstraintMaps,
    }),
    [
      termCode,
      plannerItems,
      courseTitles,
      catalog,
      isHydrating,
      refreshCatalogFromServer,
      reloadPlannerBootstrap,
      setPlannerItemsFromContext,
      removePlannerItem,
      updatePlannerItem,
      updateItemScheduleFilters,
      applyScheduleFiltersToAll,
      toggleSectionPin,
      clearSectionPins,
      clearAllSectionPins,
      clearInstructorPrefs,
      clearAllInstructorPrefs,
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
      blackouts,
      setBlackouts,
    }),
    [blackouts, setBlackouts],
  );

  const historyValue = useMemo<PlannerHistoryContextValue>(
    () => ({
      canUndo,
      canRedo,
      undo,
      redo,
      recordHistorySnapshot,
      lastActionWasBusyAddOrUpdate,
    }),
    [
      canUndo,
      canRedo,
      undo,
      redo,
      recordHistorySnapshot,
      lastActionWasBusyAddOrUpdate,
    ],
  );

  return (
    <PlannerDataContext.Provider value={dataValue}>
      <PlannerSolveContext.Provider value={solveValue}>
        <PlannerUiContext.Provider value={uiValue}>
          <PlannerHistoryContext.Provider value={historyValue}>
            {children}
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
