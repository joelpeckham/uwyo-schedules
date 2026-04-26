"use client";

import { useRouter } from "next/navigation";
import type { TermOption } from "@/lib/planner/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PlannerTermSelect({
  terms,
  termCode,
}: {
  terms: TermOption[];
  termCode: string;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="sr-only text-xs font-medium text-muted-foreground sm:not-sr-only sm:inline">
        Term
      </span>
      <Select
        value={termCode}
        onValueChange={(next) => {
          router.replace(`/planner?term=${encodeURIComponent(next)}`);
        }}
      >
        <SelectTrigger
          size="sm"
          className="h-9 min-w-[12rem] touch-manipulation sm:w-56"
          aria-label="Term"
        >
          <SelectValue placeholder="Choose term" />
        </SelectTrigger>
        <SelectContent>
          {terms.map((t) => (
            <SelectItem key={t.code} value={t.code}>
              {`${t.description} (${t.code})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
