"use client";

import { useCallback, useState } from "react";
import { Copy, Download, Link2, Loader2, Printer, SquareArrowUp } from "lucide-react";

import { createShareLinkAction } from "@/app/planner/actions";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { collectDisplayCrnsForItems } from "@/lib/planner/client/derive";
import { buildIcsForPlannerWeek } from "@/lib/planner/ics";
import { encodePrintSelections } from "@/lib/planner/print-state";
import {
  showPlannerError,
  showPlannerSuccess,
} from "@/lib/planner/planner-toast";
import { track } from "@/lib/analytics/track";
import { cn } from "@/lib/utils";

import { usePlannerData, usePlannerSolve, usePlannerUi } from "./PlannerContext";

export function ExportMenu() {
  const { termCode, plannerItems, catalog } = usePlannerData();
  const { effectivePlannerItems } = usePlannerSolve();
  const { blackouts } = usePlannerUi();
  const [open, setOpen] = useState(false);
  const [sharePending, setSharePending] = useState(false);

  const crns = collectDisplayCrnsForItems(effectivePlannerItems, catalog);
  const disabled = crns.length === 0;

  const onCopySpaceSeparated = useCallback(async () => {
    if (crns.length === 0) return;
    try {
      await navigator.clipboard.writeText(crns.join(" "));
      track("planner_export_used", { format: "crns" });
      showPlannerSuccess("Copied CRNs (space-separated).");
    } catch {
      showPlannerError("Couldn't copy. Try manually selecting text.");
    }
    setOpen(false);
  }, [crns]);

  const onCopyOnePerLine = useCallback(async () => {
    if (crns.length === 0) return;
    try {
      await navigator.clipboard.writeText(crns.join("\n"));
      track("planner_export_used", { format: "crn_list" });
      showPlannerSuccess("Copied CRNs (one per line).");
    } catch {
      showPlannerError("Couldn't copy. Try manually selecting text.");
    }
    setOpen(false);
  }, [crns]);

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
      showPlannerSuccess("Downloaded .ics file.");
    } catch {
      showPlannerError("Couldn't download. Try the print view instead.");
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    setOpen(false);
  }, [termCode, effectivePlannerItems, catalog]);

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
    if (sharePending) return;
    setSharePending(true);
    try {
      const res = await createShareLinkAction({
        termCode,
        items: plannerItems,
        blackouts,
      });
      if (!res.ok) {
        showPlannerError(res.error);
        return;
      }
      const url = `${window.location.origin}/planner?s=${res.code}`;
      await navigator.clipboard.writeText(url);
      track("planner_share_link_copied", { length: url.length });
      showPlannerSuccess("Share link copied to clipboard.");
      setOpen(false);
    } catch {
      showPlannerError("Couldn't copy share link.");
    } finally {
      setSharePending(false);
    }
  }, [plannerItems, termCode, blackouts, sharePending]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="inline-flex items-center overflow-hidden rounded-md border border-input">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="touch-manipulation rounded-none border-0"
            disabled={disabled}
            aria-label="Export schedule"
          >
            <SquareArrowUp className="size-4" aria-hidden />
          </Button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        align="start"
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
          icon={
            sharePending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )
          }
          label="Copy share link"
          description="Anyone with the link sees this schedule."
          onClick={onShareLink}
          disabled={plannerItems.length === 0 || sharePending}
        />
      </PopoverContent>
    </Popover>
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
