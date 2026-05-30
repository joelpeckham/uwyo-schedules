"use client";

import { useEffect } from "react";

/** Clears any active text selection (Safari may start one before drag guards apply). */
export function clearTextSelection(): void {
  window.getSelection()?.removeAllRanges();
}

/**
 * WebKit often selects text during pointer drags even with CSS `user-select: none`.
 * Block `selectstart` while interactive drag is active.
 */
export function usePreventTextSelectionWhileDragging(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener("selectstart", prevent);
    return () => document.removeEventListener("selectstart", prevent);
  }, [active]);
}
