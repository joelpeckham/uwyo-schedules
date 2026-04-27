import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  linkedFetchAnchorCrns,
  mapSectionRowToGraph,
  parseLinkedData,
  pickLinkedAnchorCrn,
} from "./mappers";
import type { BannerSectionRow, SearchResultsResponse } from "./types";

const fixture = (name: string) =>
  JSON.parse(
    readFileSync(
      join(process.cwd(), "docs/banner-ssb-fixtures", name),
      "utf-8",
    ),
  ) as unknown;

describe("mapSectionRowToGraph", () => {
  it("maps a PHYS searchResults row", () => {
    const doc = fixture("07-searchResults-PHYS-page0.json") as SearchResultsResponse;
    expect(doc.success).toBe(true);
    const row = doc.data?.[0] as BannerSectionRow;
    const g = mapSectionRowToGraph("202710", row);
    expect(g).not.toBeNull();
    expect(g!.section.termCode).toBe("202710");
    expect(g!.section.crn).toBe("11568");
    expect(g!.section.subject).toBe("PHYS");
    expect(g!.meetings.length).toBeGreaterThan(0);
  });

  it("decodes HTML entities in Banner prose fields", () => {
    const row = {
      courseReferenceNumber: "1",
      subject: "MATH",
      courseNumber: "1000",
      courseTitle: "Waves &amp; Optics",
      subjectDescription: "Math &amp; stat",
    } as BannerSectionRow;
    const g = mapSectionRowToGraph("202610", row);
    expect(g?.section.courseTitle).toBe("Waves & Optics");
    expect(g?.section.subjectDescription).toBe("Math & stat");
  });
});

describe("linkedData OR/AND semantics (fixture 08)", () => {
  it("parses bundles: 49 OR-options, inner length 2, anchor absent from members", () => {
    const payload = fixture("08-fetchLinkedSections-10224.json") as {
      linkedData: BannerSectionRow[][];
    };
    expect(Array.isArray(payload.linkedData)).toBe(true);
    expect(payload.linkedData.length).toBe(49);

    const anchor = "10224";
    const parsed = parseLinkedData(anchor, payload);
    expect(parsed.length).toBe(49);

    for (let i = 0; i < payload.linkedData.length; i++) {
      const inner = payload.linkedData[i];
      expect(inner.length).toBe(2);
      for (const row of inner) {
        expect(row.courseReferenceNumber).not.toBe(anchor);
      }
      const d = inner[0]?.scheduleTypeDescription;
      const l = inner[1]?.scheduleTypeDescription;
      expect(d === "Discussion" || d === "Lab").toBe(true);
      expect(l === "Discussion" || l === "Lab").toBe(true);
      expect(d).not.toBe(l);
    }

    const first = payload.linkedData[0];
    const ids = new Set(
      first.map((r) => `${r.linkIdentifier}:${r.courseReferenceNumber}`),
    );
    expect(ids.has("D1:10238")).toBe(true);
    expect(ids.has("L1:10230")).toBe(true);
  });

  it("pickLinkedAnchorCrn prefers lecture CRN when present", () => {
    const rows: BannerSectionRow[] = [
      {
        courseReferenceNumber: "20000",
        scheduleTypeDescription: "Lab",
        subject: "PHYS",
        courseNumber: "1110",
      },
      {
        courseReferenceNumber: "10224",
        scheduleTypeDescription: "Lecture",
        subject: "PHYS",
        courseNumber: "1110",
      },
    ];
    expect(pickLinkedAnchorCrn(rows)).toBe("10224");
  });

  it("linkedFetchAnchorCrns returns all lecture CRNs sorted", () => {
    const rows: BannerSectionRow[] = [
      {
        courseReferenceNumber: "10225",
        scheduleTypeDescription: "Lecture",
        subject: "PHYS",
        courseNumber: "1110",
      },
      {
        courseReferenceNumber: "20000",
        scheduleTypeDescription: "Lab",
        subject: "PHYS",
        courseNumber: "1110",
      },
      {
        courseReferenceNumber: "10224",
        scheduleTypeDescription: "Lecture",
        subject: "PHYS",
        courseNumber: "1110",
      },
    ];
    expect(linkedFetchAnchorCrns(rows)).toEqual(["10224", "10225"]);
  });

  it("linkedFetchAnchorCrns single lecture returns one CRN", () => {
    const rows: BannerSectionRow[] = [
      {
        courseReferenceNumber: "20000",
        scheduleTypeDescription: "Lab",
        subject: "PHYS",
        courseNumber: "1110",
      },
      {
        courseReferenceNumber: "10224",
        scheduleTypeDescription: "Lecture",
        subject: "PHYS",
        courseNumber: "1110",
      },
    ];
    expect(linkedFetchAnchorCrns(rows)).toEqual(["10224"]);
  });

  it("linkedFetchAnchorCrns lab-only group falls back to pickLinkedAnchorCrn", () => {
    const rows: BannerSectionRow[] = [
      {
        courseReferenceNumber: "30000",
        scheduleTypeDescription: "Lab",
        subject: "CHEM",
        courseNumber: "1000",
      },
      {
        courseReferenceNumber: "20000",
        scheduleTypeDescription: "Discussion",
        subject: "CHEM",
        courseNumber: "1000",
      },
    ];
    expect(linkedFetchAnchorCrns(rows)).toEqual(["20000"]);
    expect(pickLinkedAnchorCrn(rows)).toBe("20000");
  });
});
