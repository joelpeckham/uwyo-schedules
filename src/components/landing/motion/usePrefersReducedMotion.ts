"use client";

import { useReducedMotion } from "motion/react";
import { useSyncExternalStore } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();
let mountedAfterHydration = false;
let mountedNotifyScheduled = false;

function scheduleMountedNotify() {
  if (mountedNotifyScheduled || typeof window === "undefined") {
    return;
  }
  mountedNotifyScheduled = true;
  queueMicrotask(() => {
    mountedAfterHydration = true;
    listeners.forEach((listener) => listener());
  });
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  scheduleMountedNotify();
  return () => listeners.delete(listener);
}

function getMountedSnapshot() {
  return mountedAfterHydration;
}

function getMountedServerSnapshot() {
  return false;
}

/** True only after React hydration completes on the client. */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    getMountedSnapshot,
    getMountedServerSnapshot,
  );
}

/**
 * System reduced-motion preference, safe for SSR/hydration.
 * Returns false until after hydration so server and first client render match.
 */
export function usePrefersReducedMotion(): boolean {
  const prefersReducedMotion = useReducedMotion();
  const hasMounted = useHasMounted();

  if (!hasMounted) {
    return false;
  }

  return prefersReducedMotion ?? false;
}
