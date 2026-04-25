"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TermCatalogBundle } from "@/lib/catalog/bundle";
import { filterCourseEntries } from "@/lib/catalog/section-format";
import { TermCatalogView } from "./term-catalog-view";

export function TermCatalogBrowser({ bundle }: { bundle: TermCatalogBundle }) {
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const totalCourses = bundle.courses.size;
  const courseEntries = useMemo(
    () => filterCourseEntries(bundle.courses, deferred),
    [bundle.courses, deferred]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1">
          <label
            htmlFor="term-catalog-search"
            className="text-sm font-medium"
          >
            Search classes
          </label>
          <Input
            id="term-catalog-search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
            placeholder="Subject, number, title, CRN, instructor, room…"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        {query ? (
          <Button type="button" variant="secondary" onClick={() => setQuery("")}>
            Clear
          </Button>
        ) : null}
      </div>
      <TermCatalogView
        bundle={bundle}
        courseEntries={courseEntries}
        totalCourses={totalCourses}
        filterQuery={deferred}
      />
    </div>
  );
}
