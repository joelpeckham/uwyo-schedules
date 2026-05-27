"use client";

import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("[contenteditable='true']"));
}

type Options = {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

/** Maps ⌘Z / Ctrl+Z and ⇧⌘Z / Shift+Ctrl+Z to planner undo/redo. */
export function usePlannerUndoRedoShortcuts({
  undo,
  redo,
  canUndo,
  canRedo,
}: Options) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.key.toLowerCase() !== "z") return;

      if (e.shiftKey) {
        if (!canRedo) return;
        e.preventDefault();
        redo();
        return;
      }

      if (!canUndo) return;
      e.preventDefault();
      undo();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, canUndo, canRedo]);
}
