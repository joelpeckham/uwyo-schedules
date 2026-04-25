"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { SearchResultsRow } from "@/lib/banner-ssb/types";
import {
  parseLinkedResponse,
  sectionSummaryLine,
  type LinkedEntry,
  type TermCatalogBundle,
} from "@/lib/catalog/bundle";
import {
  formatFacultyNamesList,
  formatMeetingLinesFromRow,
  formatSectionHeadline,
  primaryFacultyName,
} from "@/lib/catalog/section-format";
import { ChevronDown } from "lucide-react";

function str(v: unknown): string | null {
  return typeof v === "string" && v.length ? v : null;
}

function LinkedSectionEntry({
  row,
  idx,
}: {
  row: SearchResultsRow | Record<string, unknown>;
  idx: number;
}) {
  const r = row as Record<string, unknown>;
  const crn = str(r.courseReferenceNumber);
  const head = formatSectionHeadline(r);
  const inst = primaryFacultyName(r);
  const meet = formatMeetingLinesFromRow(r);

  return (
    <li className="border-b border-border/60 py-2 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs">
        {crn ? <span className="font-mono font-medium">CRN {crn}</span> : null}
        {head ? (
          <span className="text-foreground/90 font-medium">{head}</span>
        ) : null}
        {!head && !crn ? <span>Section {idx + 1}</span> : null}
      </div>
      {inst ? (
        <p className="text-muted-foreground mt-0.5 text-xs">{inst}</p>
      ) : null}
      {meet.length > 0 ? (
        <ul className="text-muted-foreground mt-1 list-inside list-disc text-xs">
          {meet.map((m, j) => (
            <li key={j}>{m}</li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function SectionLinkedBlock({
  linked,
}: {
  linked: LinkedEntry | undefined;
}) {
  if (!linked) {
    return (
      <p className="text-muted-foreground text-xs">
        No linked fetch for this CRN (only representative CRNs are stored).
      </p>
    );
  }
  const parsed = parseLinkedResponse(linked.response);
  const bundles = parsed?.linkedData;
  if (!bundles || !Array.isArray(bundles)) {
    return (
      <Collapsible>
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs underline-offset-2 hover:underline">
          <ChevronDown className="size-3" />
          Raw linked response
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScrollArea className="mt-2 max-h-48 rounded-md border p-2">
            <pre className="text-xs whitespace-pre-wrap break-all font-mono">
              {JSON.stringify(linked.response, null, 2)}
            </pre>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium">Registration options (linked sets)</span>
        <Badge variant="secondary">
          {bundles.length} option{bundles.length === 1 ? "" : "s"}
        </Badge>
        <span className="text-muted-foreground">fetched {linked.fetchedAt}</span>
      </div>
      <p className="text-muted-foreground text-xs">
        You register the linked course as one of these co-section bundles (pick
        one; sections within a bundle are taken together).
      </p>
      <ol className="list-decimal space-y-2 pl-4 text-xs marker:font-medium">
        {bundles.map((bundle, i) => {
          const n = Array.isArray(bundle) ? bundle.length : 0;
          return (
            <li
              key={i}
              className="space-y-2 rounded-md border bg-muted/20 py-1 pl-0"
            >
              <div className="pr-1 pl-1 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                Option {i + 1} · {n} section{n === 1 ? "" : "s"}
              </div>
              {Array.isArray(bundle) ? (
                <ul className="m-0 list-none p-0">
                  {bundle.map((sec, j) => (
                    <LinkedSectionEntry
                      key={j}
                      row={sec as SearchResultsRow}
                      idx={j}
                    />
                  ))}
                </ul>
              ) : null}
              <div className="pl-1">
                <Collapsible defaultOpen={false}>
                  <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-[0.65rem] underline-offset-2 hover:underline">
                    <ChevronDown className="size-3" />
                    Raw JSON (option {i + 1})
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ScrollArea className="mt-1 max-h-36 rounded border p-1.5">
                      <pre className="text-[0.65rem] leading-snug whitespace-pre-wrap break-all font-mono">
                        {JSON.stringify(bundle, null, 2)}
                      </pre>
                    </ScrollArea>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function SectionDetailBlock({ row }: { row: SearchResultsRow }) {
  const r = row as Record<string, unknown>;
  const part = str(r.partOfTerm);
  const campus = str(r.campusDescription) ?? str(r.campus);
  const seq = str(r.sequenceNumber);
  const inst = formatFacultyNamesList(r);
  const meet = formatMeetingLinesFromRow(r);
  const wait =
    r.waitCount != null
      ? `Wait: ${String(r.waitCount)} / ${r.waitCapacity != null ? String(r.waitCapacity) : "—"}`
      : null;

  return (
    <div className="text-muted-foreground space-y-1.5 text-xs">
      {str(r.courseTitle) ? (
        <p>
          <span className="text-foreground/80 font-medium">Title </span>
          {String(r.courseTitle)}
        </p>
      ) : null}
      {part || campus || seq ? (
        <p className="grid gap-1 sm:grid-cols-2 sm:gap-x-3">
          {part ? (
            <span>
              <span className="text-foreground/80">Part of term</span> {part}
            </span>
          ) : null}
          {campus ? (
            <span>
              <span className="text-foreground/80">Campus</span> {campus}
            </span>
          ) : null}
          {seq ? (
            <span>
              <span className="text-foreground/80">Sequence</span> {seq}
            </span>
          ) : null}
        </p>
      ) : null}
      {r.seatsAvailable != null ? (
        <p>
          <span className="text-foreground/80">Seats open</span>{" "}
          {String(r.seatsAvailable)}
        </p>
      ) : null}
      {wait ? <p>{wait}</p> : null}
      {inst.length > 0 ? (
        <div>
          <span className="text-foreground/80">Instructor</span>
          {inst.length === 1 ? (
            <p className="ml-0">{inst[0]}</p>
          ) : (
            <ul className="mt-0.5 list-inside list-disc">
              {inst.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
      {meet.length > 0 ? (
        <div>
          <span className="text-foreground/80">Meetings</span>
          <ul className="mt-0.5 list-inside list-disc">
            {meet.map((m, j) => (
              <li key={j}>{m}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SectionRow({
  row,
  linkedByCrn,
}: {
  row: SearchResultsRow;
  linkedByCrn: Map<string, LinkedEntry>;
}) {
  const crn = row.courseReferenceNumber;
  const crnStr = typeof crn === "string" ? crn : null;
  const schedule = str(
    (row as Record<string, unknown>).scheduleTypeDescription
  );
  const credits = (row as Record<string, unknown>).creditHours;
  const open = (row as Record<string, unknown>).openSection;
  const enroll = (row as Record<string, unknown>).enrollment;
  const maxEn = (row as Record<string, unknown>).maximumEnrollment;
  const linkId = row.linkIdentifier;
  const isLinked = row.isSectionLinked;
  const r0 = row as Record<string, unknown>;
  const termDesc = str(r0.termDesc);

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        {crnStr ? <Badge variant="outline">CRN {crnStr}</Badge> : null}
        {isLinked ? (
          <Badge variant="default">linked section</Badge>
        ) : (
          <Badge variant="secondary">not linked</Badge>
        )}
        {typeof linkId === "string" && linkId ? (
          <Badge variant="outline">link {linkId}</Badge>
        ) : null}
        {termDesc ? (
          <Badge variant="secondary" className="font-normal">
            {termDesc}
          </Badge>
        ) : null}
      </div>
      <p className="text-sm font-medium leading-snug">{sectionSummaryLine(row)}</p>
      <div className="text-muted-foreground grid gap-1 text-xs sm:grid-cols-2">
        {schedule ? <span>Schedule: {schedule}</span> : null}
        {credits != null ? <span>Credits: {String(credits)}</span> : null}
        {open != null ? <span>Open: {String(open)}</span> : null}
        {enroll != null || maxEn != null ? (
          <span>
            Enrolled: {enroll != null ? String(enroll) : "—"} / cap{" "}
            {maxEn != null ? String(maxEn) : "—"}
          </span>
        ) : null}
      </div>
      <SectionDetailBlock row={row} />
      <Separator />
      <div>
        <h4 className="mb-1.5 text-xs font-medium">Linked class options</h4>
        <SectionLinkedBlock
          linked={crnStr ? linkedByCrn.get(crnStr) : undefined}
        />
      </div>
      <Collapsible defaultOpen={false}>
        <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs underline-offset-2 hover:underline">
          <ChevronDown className="size-3" />
          Full section row (JSON)
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ScrollArea className="mt-2 max-h-64 rounded-md border p-2">
            <pre className="text-xs whitespace-pre-wrap break-all font-mono">
              {JSON.stringify(row, null, 2)}
            </pre>
          </ScrollArea>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function TermCatalogView({
  bundle,
  courseEntries,
  totalCourses,
  filterQuery,
}: {
  bundle: TermCatalogBundle;
  courseEntries: [string, SearchResultsRow[]][];
  totalCourses: number;
  filterQuery: string;
}) {
  const q = filterQuery.trim();
  const totalSections = bundle.sectionRows.length;
  const visibleSections = courseEntries.reduce((n, [, rows]) => n + rows.length, 0);
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {q ? (
          <>
            Showing {courseEntries.length} of {totalCourses} course
            {totalCourses === 1 ? "" : "s"} ({visibleSections} of {totalSections}{" "}
            section
            {totalSections === 1 ? "" : "s"}) · {bundle.linkedByCrn.size} linked
            CRN fetches
          </>
        ) : (
          <>
            {totalSections} section{totalSections === 1 ? "" : "s"} ·{" "}
            {courseEntries.length} course
            {courseEntries.length === 1 ? "" : "s"} · {bundle.linkedByCrn.size}{" "}
            linked CRN responses
          </>
        )}
      </p>
      {q && courseEntries.length === 0 ? (
        <p className="text-muted-foreground border-destructive/20 bg-destructive/5 rounded-md border p-3 text-sm">
          No classes match <span className="text-foreground font-medium">“{q}”</span>
          . Try a subject code, course number, CRN, or instructor name.
        </p>
      ) : null}
      {courseEntries.length > 0 ? (
        <div className="space-y-4">
          {courseEntries.map(([courseKey, rows]) => {
            const [subject, courseNum] = courseKey.split("|");
            return (
              <Card key={courseKey} size="sm">
                <CardHeader className="border-b pb-3">
                  <CardTitle className="text-base">
                    {subject} {courseNum}
                  </CardTitle>
                  <CardDescription>
                    {rows.length} section{rows.length === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  {rows.map((row, idx) => {
                    const rcrn = row.courseReferenceNumber;
                    const key =
                      typeof rcrn === "string" && rcrn
                        ? rcrn
                        : `${courseKey}-${idx}`;
                    return (
                      <SectionRow
                        key={key}
                        row={row}
                        linkedByCrn={bundle.linkedByCrn}
                      />
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
