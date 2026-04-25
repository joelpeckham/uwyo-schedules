"use client";

import {
  loadPlannerCatalogBootstrapAction,
  syncPlannerStateAction,
} from "@/app/planner/actions";
import type { PlannerCatalogJson } from "@/lib/planner/client/catalog-types";
import {
  buildCalendarBlocksFromCatalog,
  buildSwapGhostsPrefetchMapFromCatalog,
  resolvePlannerSwapClient,
} from "@/lib/planner/client/derive";
import type { CalendarBlock, PlannerItemRow, SwapGhostMeeting } from "@/lib/planner/data";
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

type PlannerContextValue = {
  termCode: string;
  plannerItems: PlannerItemRow[];
  catalog: PlannerCatalogJson;
  calendarBlocks: CalendarBlock[];
  swapGhostsPrefetch: Record<string, SwapGhostMeeting[]>;
  syncError: string | null;
  clearSyncError: () => void;
  /** Replace planner + catalog (e.g. after add course or full bootstrap). */
  replacePlannerAndCatalog: (
    items: PlannerItemRow[],
    catalog: PlannerCatalogJson,
  ) => void;
  /** Refresh catalog from server; optionally replace items with server order. */
  refreshCatalogFromServer: () => Promise<boolean>;
  setPlannerItems: (items: PlannerItemRow[]) => void;
  removePlannerItem: (id: number) => void;
  updatePlannerItem: (id: number, patch: Partial<PlannerItemRow>) => void;
  applyCalendarSwap: (input: {
    plannerItemId: number;
    targetCrn: string;
    sourceSectionCrn: string;
    sourceMeetingId: number;
  }) => { ok: true } | { ok: false; error: string };
  schedulePersist: () => void;
};

const PlannerContext = createContext<PlannerContextValue | null>(null);

type ProviderProps = {
  termCode: string;
  initialPlannerItems: PlannerItemRow[];
  initialCatalog: PlannerCatalogJson;
  children: React.ReactNode;
};

export function PlannerProvider({
  termCode,
  initialPlannerItems,
  initialCatalog,
  children,
}: ProviderProps) {
  const [plannerItems, setPlannerItems] =
    useState<PlannerItemRow[]>(initialPlannerItems);
  const [catalog, setCatalog] = useState<PlannerCatalogJson>(initialCatalog);
  const [syncError, setSyncError] = useState<string | null>(null);

  const itemsRef = useRef(plannerItems);
  const termRef = useRef(termCode);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistInFlightRef = useRef(false);

  useEffect(() => {
    itemsRef.current = plannerItems;
  }, [plannerItems]);
  useEffect(() => {
    termRef.current = termCode;
  }, [termCode]);

  const calendarBlocks = useMemo(
    () => buildCalendarBlocksFromCatalog(plannerItems, catalog),
    [plannerItems, catalog],
  );

  const swapGhostsPrefetch = useMemo(
    () => buildSwapGhostsPrefetchMapFromCatalog(calendarBlocks, catalog),
    [calendarBlocks, catalog],
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

  const replacePlannerAndCatalog = useCallback(
    (items: PlannerItemRow[], nextCatalog: PlannerCatalogJson) => {
      setPlannerItems(items);
      setCatalog(nextCatalog);
      schedulePersist();
    },
    [schedulePersist],
  );

  const refreshCatalogFromServer = useCallback(async (): Promise<boolean> => {
    const res = await loadPlannerCatalogBootstrapAction(termCode);
    if (!res.ok) {
      setSyncError(res.error);
      return false;
    }
    setPlannerItems(res.plannerItems);
    setCatalog(res.catalog);
    setSyncError(null);
    return true;
  }, [termCode]);

  const removePlannerItem = useCallback(
    (id: number) => {
      setPlannerItems((prev) => prev.filter((r) => r.id !== id));
      schedulePersist();
    },
    [schedulePersist],
  );

  const updatePlannerItem = useCallback(
    (id: number, patch: Partial<PlannerItemRow>) => {
      setPlannerItems((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
      );
      schedulePersist();
    },
    [schedulePersist],
  );

  const catalogRef = useRef(catalog);
  useEffect(() => {
    catalogRef.current = catalog;
  }, [catalog]);

  const applyCalendarSwap = useCallback(
    (input: {
      plannerItemId: number;
      targetCrn: string;
      sourceSectionCrn: string;
      sourceMeetingId: number;
    }): { ok: true } | { ok: false; error: string } => {
      const item = itemsRef.current.find((i) => i.id === input.plannerItemId);
      if (!item) return { ok: false, error: "Item not found." };
      const resolved = resolvePlannerSwapClient(
        item,
        input,
        catalogRef.current,
      );
      if (!resolved.ok) return resolved;
      setPlannerItems((prev) =>
        prev.map((r) =>
          r.id === input.plannerItemId
            ? {
                ...r,
                selectionKind: resolved.selectionKind,
                anchorCrn: resolved.anchorCrn,
                linkedBundleId: resolved.linkedBundleId,
              }
            : r,
        ),
      );
      schedulePersist();
      return { ok: true };
    },
    [schedulePersist],
  );

  const value = useMemo<PlannerContextValue>(
    () => ({
      termCode,
      plannerItems,
      catalog,
      calendarBlocks,
      swapGhostsPrefetch,
      syncError,
      clearSyncError: () => setSyncError(null),
      replacePlannerAndCatalog,
      refreshCatalogFromServer,
      setPlannerItems: (items) => {
        setPlannerItems(items);
        schedulePersist();
      },
      removePlannerItem,
      updatePlannerItem,
      applyCalendarSwap,
      schedulePersist,
    }),
    [
      termCode,
      plannerItems,
      catalog,
      calendarBlocks,
      swapGhostsPrefetch,
      syncError,
      replacePlannerAndCatalog,
      refreshCatalogFromServer,
      removePlannerItem,
      updatePlannerItem,
      applyCalendarSwap,
      schedulePersist,
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
