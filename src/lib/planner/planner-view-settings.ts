"use client";

import { useCallback, useSyncExternalStore } from "react";

type PlannerViewSettings = {
  showCourseSelector: boolean;
  showFilters: boolean;
  showTransitionWarnings: boolean;
  autoPinAfterMove: boolean;
};

const STORAGE_KEY = "uwyoschedule:planner:view:v1";

const DEFAULT_SETTINGS: PlannerViewSettings = {
  showCourseSelector: true,
  showFilters: true,
  showTransitionWarnings: true,
  autoPinAfterMove: true,
};

const listeners = new Set<() => void>();

let cachedSnapshot: PlannerViewSettings = DEFAULT_SETTINGS;

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function parseSettings(raw: unknown): PlannerViewSettings {
  if (!isRecord(raw)) return DEFAULT_SETTINGS;
  return {
    showCourseSelector:
      typeof raw.showCourseSelector === "boolean"
        ? raw.showCourseSelector
        : DEFAULT_SETTINGS.showCourseSelector,
    showFilters:
      typeof raw.showFilters === "boolean"
        ? raw.showFilters
        : DEFAULT_SETTINGS.showFilters,
    showTransitionWarnings:
      typeof raw.showTransitionWarnings === "boolean"
        ? raw.showTransitionWarnings
        : DEFAULT_SETTINGS.showTransitionWarnings,
    autoPinAfterMove:
      typeof raw.autoPinAfterMove === "boolean"
        ? raw.autoPinAfterMove
        : DEFAULT_SETTINGS.autoPinAfterMove,
  };
}

function readFromStorage(): PlannerViewSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return parseSettings(JSON.parse(raw) as unknown);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeToStorage(settings: PlannerViewSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* quota / private mode — best effort */
  }
}

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

function refreshSnapshot(): void {
  cachedSnapshot = readFromStorage();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  if (typeof window !== "undefined") {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        refreshSnapshot();
        notifyListeners();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onStoreChange);
      window.removeEventListener("storage", onStorage);
    };
  }
  return () => {
    listeners.delete(onStoreChange);
  };
}

function getSnapshot(): PlannerViewSettings {
  return cachedSnapshot;
}

function getServerSnapshot(): PlannerViewSettings {
  return DEFAULT_SETTINGS;
}

function updateSettings(
  patch: Partial<PlannerViewSettings>,
): PlannerViewSettings {
  const next = { ...cachedSnapshot, ...patch };
  cachedSnapshot = next;
  writeToStorage(next);
  notifyListeners();
  return next;
}

if (typeof window !== "undefined") {
  refreshSnapshot();
}

export function usePlannerViewSettings() {
  const settings = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setShowCourseSelector = useCallback((showCourseSelector: boolean) => {
    updateSettings({ showCourseSelector });
  }, []);

  const setShowFilters = useCallback((showFilters: boolean) => {
    updateSettings({ showFilters });
  }, []);

  const setShowTransitionWarnings = useCallback(
    (showTransitionWarnings: boolean) => {
      updateSettings({ showTransitionWarnings });
    },
    [],
  );

  const setAutoPinAfterMove = useCallback((autoPinAfterMove: boolean) => {
    updateSettings({ autoPinAfterMove });
  }, []);

  return {
    ...settings,
    setShowCourseSelector,
    setShowFilters,
    setShowTransitionWarnings,
    setAutoPinAfterMove,
  };
}
