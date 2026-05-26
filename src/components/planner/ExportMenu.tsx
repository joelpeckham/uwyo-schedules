"use client";

import { useCallback, useState } from "react";
import { Check, ChevronDown, Copy, Download, Link2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { collectDisplayCrnsForItems } from "@/lib/planner/client/derive";
import { buildIcsForPlannerWeek } from "@/lib/planner/ics";
import { encodePrintSelections } from "@/lib/planner/print-state";
import { encodeShareState, type SharePinV1 } from "@/lib/planner/share-state";
import { track } from "@/lib/analytics/track";
import { cn } from "@/lib/utils";

import { usePlanner } from "./PlannerContext";

type Status = "idle" | "ok" | "err";

export function ExportMenu() {
  const {
    termCode,
    plannerItems,
    effectivePlannerItems,
    catalog,
    blackouts,
    timePrefs,
  } = usePlanner();
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");

  const flash = useCallback((kind: Status, msg: string) => {
    setStatus(kind);
    setStatusMessage(msg);
    window.setTimeout(() => {
      setStatus((cur) => (cur === kind ? "idle" : cur));
      setStatusMessage("");
    }, 2200);
  }, []);

  const crns = collectDisplayCrnsForItems(effectivePlannerItems, catalog);
  const disabled = crns.length === 0;

  const onCopySpaceSeparated = useCallback(async () => {
    if (crns.length === 0) return;
    try {
      await navigator.clipboard.writeText(crns.join(" "));
      track("planner_export_used", { format: "crns" });
      flash("ok", "Copied CRNs (space-separated).");
    } catch {
      flash("err", "Couldn't copy. Try manually selecting text.");
    }
    setOpen(false);
  }, [crns, flash]);

  const onCopyOnePerLine = useCallback(async () => {
    if (crns.length === 0) return;
    try {
      await navigator.clipboard.writeText(crns.join("\n"));
      track("planner_export_used", { format: "crn_list" });
      flash("ok", "Copied CRNs (one per line).");
    } catch {
      flash("err", "Couldn't copy. Try manually selecting text.");
    }
    setOpen(false);
  }, [crns, flash]);

  const onDownloadIcs = useCallback(() => {
    const text = buildIcsForPlannerWeek({
      termCode,
      items: effectivePlannerItems,
      catalog,
    });
    const blob = new Blob([text], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = `uw-schedule-${termCode}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      track("planner_export_used", { format: "ics" });
      flash("ok", "Downloaded .ics file.");
    } catch {
      flash("err", "Couldn't download. Try the print view instead.");
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    setOpen(false);
  }, [termCode, effectivePlannerItems, catalog, flash]);

  const onPrint = useCallback(() => {
    track("planner_export_used", { format: "print" });
    if (typeof window !== "undefined") {
      const p = encodePrintSelections(effectivePlannerItems);
      const qs = new URLSearchParams({ term: termCode, p });
      window.open(`/planner/print?${qs.toString()}`, "_blank");
    }
    setOpen(false);
  }, [termCode, effectivePlannerItems]);

  const onShareLink = useCallback(async () => {
    const pins: SharePinV1[] = plannerItems.map((it) => ({
      sub: it.subject,
      num: it.courseNumber,
      crn:
        it.selectionKind === "single_crn" || it.selectionKind === "linked_bundle"
          ? it.anchorCrn ?? null
          : null,
      lbid: it.selectionKind === "linked_bundle" ? it.linkedBundleId ?? null : null,
    }));
    const code = encodeShareState({
      termCode,
      pins,
      blackouts,
      timePrefs,
    });
    const url = `${window.location.origin}/planner?s=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      track("planner_share_link_copied", { length: url.length });
      flash("ok", "Share link copied to clipboard.");
    } catch {
      flash("err", "Couldn't copy share link.");
    }
    setOpen(false);
  }, [plannerItems, termCode, blackouts, timePrefs, flash]);

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-9 touch-manipulation"
            disabled={disabled}
          >
            <Copy className="mr-1.5 size-4" aria-hidden />
            <span>Copy / export</span>
            <ChevronDown className="ml-1.5 size-3.5 opacity-60" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-64 p-1 text-sm"
          aria-label="Export menu"
        >
          <ExportItem
            icon={<Copy className="size-4" />}
            label="Copy CRNs (space-separated)"
            description="Default — paste into Banner."
            onClick={onCopySpaceSeparated}
            disabled={disabled}
          />
          <ExportItem
            icon={<Copy className="size-4" />}
            label="Copy CRNs (one per line)"
            description="For lists and notes."
            onClick={onCopyOnePerLine}
            disabled={disabled}
          />
          <ExportItem
            icon={<Download className="size-4" />}
            label="Download .ics"
            description="Import into Apple, Google, or Outlook."
            onClick={onDownloadIcs}
            disabled={disabled}
          />
          <ExportItem
            icon={<Printer className="size-4" />}
            label="Print view"
            description="Opens a clean, paperable schedule."
            onClick={onPrint}
            disabled={disabled}
          />
          <ExportItem
            icon={<Link2 className="size-4" />}
            label="Copy share link"
            description="Anyone with the link sees this schedule."
            onClick={onShareLink}
            disabled={plannerItems.length === 0}
          />
        </PopoverContent>
      </Popover>
      {status !== "idle" ? (
        <span
          className={cn(
            "inline-flex min-w-0 items-center gap-1.5 text-xs",
            status === "ok" ? "text-muted-foreground" : "text-destructive",
          )}
          aria-live="polite"
          role="status"
        >
          {status === "ok" ? (
            <Check className="size-3.5 shrink-0 text-primary" aria-hidden strokeWidth={2.5} />
          ) : null}
          {statusMessage}
        </span>
      ) : null}
    </div>
  );
}

type ExportItemProps = {
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
};

function ExportItem({ icon, label, description, onClick, disabled }: ExportItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors",
        "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-60",
      )}
    >
      <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{description}</span>
      </span>
    </button>
  );
}
