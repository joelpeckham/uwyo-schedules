"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "uwyoschedule-theme";

type ThemePref = "light" | "dark" | "system";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStoredPref(): ThemePref {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* private mode */
  }
  return "system";
}

function applyToDocument(pref: ThemePref): "light" | "dark" {
  const dark =
    pref === "dark" || (pref === "system" && systemPrefersDark());
  document.documentElement.classList.toggle("dark", dark);
  return dark ? "dark" : "light";
}

// `useSyncExternalStore` lets us read the persisted preference once during the
// client's initial render (avoiding the previous `setState`-in-`useEffect`
// pattern that triggered cascading renders) while still rendering the neutral
// "system" icon during SSR. Storage events keep multiple tabs in sync.
function subscribePref(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
  };
}

function getServerPref(): ThemePref {
  return "system";
}

export function ThemeToggle({ className }: { className?: string }) {
  const pref = useSyncExternalStore(
    subscribePref,
    readStoredPref,
    getServerPref,
  );
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readStoredPref() === "system") applyToDocument("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const apply = useCallback((next: ThemePref) => {
    applyToDocument(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    // Same-tab `storage` events don't fire, so notify subscribers manually.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY }),
      );
    }
  }, []);

  const cycle = useCallback(() => {
    const order: ThemePref[] = ["system", "light", "dark"];
    const idx = order.indexOf(pref);
    const next = order[(idx + 1) % order.length]!;
    apply(next);
  }, [pref, apply]);

  const Icon =
    pref === "dark" ? Moon : pref === "light" ? Sun : Monitor;
  const label =
    pref === "dark"
      ? "Dark theme (click for system)"
      : pref === "light"
        ? "Light theme (click for dark)"
        : "Match system theme (click for light)";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className={cn("touch-manipulation shrink-0", className)}
      aria-label={label}
      title={label}
      onClick={cycle}
      // The icon legitimately differs from the SSR ("system") snapshot once we
      // read the stored preference on the client, so suppress the warning for
      // the entire toggle subtree rather than render a placeholder shell.
      suppressHydrationWarning
    >
      <Icon className="size-4" aria-hidden suppressHydrationWarning />
    </Button>
  );
}
