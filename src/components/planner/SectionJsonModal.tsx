"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
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
  const [pending, startTransition] = useTransition();

  const load = useCallback(() => {
    if (!crn || !termCode) return;
    setBody({ kind: "loading" });
    startTransition(async () => {
      const row = await getSectionDetailAction(termCode, crn);
      if (!row) {
        setTitle("Section not found");
        setBody({ kind: "not_found" });
        return;
      }
      setTitle(row.title);
      const parsed = parseSectionRawJson(row.rawJson);
      if (!parsed.ok) {
        setBody({ kind: "parse_error", message: parsed.message });
        return;
      }
      setBody({ kind: "ok", root: parsed.root });
    });
  }, [crn, termCode]);

  useEffect(() => {
    if (!open || !crn) return undefined;
    const t = window.setTimeout(() => {
      load();
    }, 0);
    return () => window.clearTimeout(t);
  }, [open, crn, load]);

  const showLoading = pending || body.kind === "loading";

  const handleOpenChange = (next: boolean) => {
    if (!next) setBody({ kind: "idle" });
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        className="flex max-h-[min(92vh,52rem)] w-full max-w-[min(100vw-1.5rem,56rem)] flex-col gap-3 overflow-hidden p-4 sm:max-w-[min(100vw-2rem,56rem)] sm:p-5"
      >
        <DialogHeader className="shrink-0 space-y-1.5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Section details
          </p>
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
