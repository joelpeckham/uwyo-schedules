"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getSectionDetailAction } from "@/app/planner/actions";
import { parseSectionRawJson } from "@/lib/planner/section-detail-view";
import { SectionDetailPanels } from "./SectionDetailPanels";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  termCode: string;
  crn: string | null;
};

type BodyState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "parse_error"; message: string }
  | { kind: "ok"; root: Record<string, unknown> };

export function SectionJsonModal({ open, onOpenChange, termCode, crn }: Props) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState<BodyState>({ kind: "idle" });
  const loadGenRef = useRef(0);

  // The previous implementation wrapped `await getSectionDetailAction(...)` in
  // `startTransition(async () => …)`, but `useTransition`'s `pending` only
  // tracks the synchronous body of the callback; it flips back to `false` as
  // soon as the async function returns its first promise, so the loading
  // spinner would disappear before the data actually arrived. We drive the
  // loading UI from `body.kind === "loading"` instead.
  const load = useCallback(async () => {
    if (!crn || !termCode) return;
    const gen = ++loadGenRef.current;
    setBody({ kind: "loading" });
    const row = await getSectionDetailAction(termCode, crn);
    if (gen !== loadGenRef.current) return;
    if (!row) {
      setTitle("Section not found");
      setBody({ kind: "not_found" });
      return;
    }
    setTitle(row.title);
    const parsed = parseSectionRawJson(row.rawJson);
    if (gen !== loadGenRef.current) return;
    if (!parsed.ok) {
      setBody({ kind: "parse_error", message: parsed.message });
      return;
    }
    setBody({ kind: "ok", root: parsed.root });
  }, [crn, termCode]);

  useEffect(() => {
    if (!open || !crn) return undefined;
    const t = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, crn, load]);

  const showLoading = body.kind === "loading";

  const handleOpenChange = (next: boolean) => {
    if (!next) setBody({ kind: "idle" });
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        className="flex w-full flex-col gap-3 overflow-hidden p-4 max-sm:left-0 max-sm:top-auto max-sm:bottom-0 max-sm:translate-x-0 max-sm:translate-y-0 max-sm:max-h-[88vh] max-sm:max-w-full max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:data-open:slide-in-from-bottom-4 sm:max-h-[min(92vh,52rem)] sm:max-w-[min(100vw-2rem,56rem)] sm:p-5"
      >
        <DialogHeader className="shrink-0 space-y-1.5">
          <DialogDescription className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Section details
          </DialogDescription>
          <DialogTitle className="pr-8 font-mono text-sm font-normal leading-snug">
            {showLoading ? "Loading…" : title}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-xl border border-border/80 bg-muted/20 [-webkit-overflow-scrolling:touch]">
          <div className="p-4">
            {showLoading ? (
              <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                Loading section details…
              </p>
            ) : body.kind === "not_found" ? (
              <p className="rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
                No row exists for this term and CRN.
              </p>
            ) : body.kind === "parse_error" ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-foreground">
                {body.message}
              </p>
            ) : body.kind === "ok" ? (
              <SectionDetailPanels root={body.root} />
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                Open a section block.
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
