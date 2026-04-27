"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

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

export function ThemeToggle({ className }: { className?: string }) {
  const [pref, setPref] = useState<ThemePref>("system");

  const apply = useCallback((next: ThemePref) => {
    applyToDocument(next);
    setPref(next);
    try {
      if (next === "system") localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const initial = readStoredPref();
    queueMicrotask(() => {
      setPref(initial);
      applyToDocument(initial);
    });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (readStoredPref() === "system") applyToDocument("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
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
    >
      <Icon className="size-4" aria-hidden />
    </Button>
  );
}
