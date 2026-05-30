import { describe, expect, it } from "vitest";
import {
  computeSectionContentHash,
  extractSectionSeatSnapshot,
  mapSectionRowToGraph,
  sectionSeatsEqual,
  type SectionGraph,
} from "./mappers";
import { partitionTermGraphs } from "./ingest-term";
import type { BannerSectionRow } from "./types";

function makeGraph(
  crn: string,
  overrides: {
    section?: Partial<SectionGraph["section"]>;
    enrollment?: number | null;
  } = {},
): SectionGraph {
  const row = {
    courseReferenceNumber: crn,
    subject: "MATH",
    courseNumber: "2200",
    courseTitle: "Calculus",
    enrollment: overrides.enrollment ?? 10,
    maximumEnrollment: 30,
    seatsAvailable: 20,
    waitCapacity: 0,
    waitCount: 0,
    waitAvailable: 0,
    openSection: true,
    crossListCapacity: null,
    crossListCount: null,
    crossListAvailable: null,
    meetingsFaculty: [],
    faculty: [],
    sectionAttributes: [],
  } as BannerSectionRow;
  const graph = mapSectionRowToGraph("202710", row)!;
  if (overrides.section) {
    graph.section = { ...graph.section, ...overrides.section };
  }
  if (overrides.enrollment !== undefined) {
    graph.section.enrollment = overrides.enrollment;
  }
  return graph;
}

describe("partitionTermGraphs", () => {
  it("classifies new, unchanged, seat-only, content-changed, and removed CRNs", () => {
    const unchanged = makeGraph("10001");
    const seatOnly = makeGraph("10002");
    const contentChanged = makeGraph("10003", {
      section: { courseTitle: "Old title" },
    });
    const incomingSeatOnly = makeGraph("10002", { enrollment: 25 });
    const incomingContentChanged = makeGraph("10003", {
      section: { courseTitle: "New title" },
    });

    const unchangedHash = computeSectionContentHash(unchanged);
    const seatOnlyHash = computeSectionContentHash(seatOnly);
    const contentHash = computeSectionContentHash(contentChanged);

    const existingByCrn = new Map([
      [
        "10001",
        {
          crn: "10001",
          contentHash: unchangedHash,
          seats: extractSectionSeatSnapshot(unchanged.section),
        },
      ],
      [
        "10002",
        {
          crn: "10002",
          contentHash: seatOnlyHash,
          seats: extractSectionSeatSnapshot(seatOnly.section),
        },
      ],
      [
        "10003",
        {
          crn: "10003",
          contentHash: contentHash,
          seats: extractSectionSeatSnapshot(contentChanged.section),
        },
      ],
      [
        "99999",
        {
          crn: "99999",
          contentHash: "deadbeef",
          seats: extractSectionSeatSnapshot(makeGraph("99999").section),
        },
      ],
    ]);

    const result = partitionTermGraphs(
      [unchanged, incomingSeatOnly, incomingContentChanged],
      existingByCrn,
    );

    expect(result.insert).toHaveLength(0);
    expect(result.seatOnly.map((g) => g.section.crn)).toEqual(["10002"]);
    expect(result.contentChanged.map((g) => g.section.crn)).toEqual(["10003"]);
    expect(result.removeCrns).toEqual(["99999"]);
  });

  it("treats null content hash as content-changed when seats match", () => {
    const graph = makeGraph("10001");
    const existingByCrn = new Map([
      [
        "10001",
        {
          crn: "10001",
          contentHash: null,
          seats: extractSectionSeatSnapshot(graph.section),
        },
      ],
    ]);

    const result = partitionTermGraphs([graph], existingByCrn);
    expect(result.seatOnly).toHaveLength(0);
    expect(result.contentChanged.map((g) => g.section.crn)).toEqual(["10001"]);
  });
});

describe("computeSectionContentHash", () => {
  it("is stable for identical graphs", () => {
    const a = makeGraph("10001");
    const b = makeGraph("10001");
    expect(computeSectionContentHash(a)).toBe(computeSectionContentHash(b));
  });

  it("changes when catalog fields change but not when only seats change", () => {
    const base = makeGraph("10001");
    const seatChanged = makeGraph("10001", { enrollment: 99 });
    const titleChanged = makeGraph("10001", {
      section: { courseTitle: "Different title" },
    });

    expect(computeSectionContentHash(base)).toBe(
      computeSectionContentHash(seatChanged),
    );
    expect(computeSectionContentHash(base)).not.toBe(
      computeSectionContentHash(titleChanged),
    );
  });
});

describe("sectionSeatsEqual", () => {
  it("detects seat-group differences", () => {
    const a = extractSectionSeatSnapshot(makeGraph("1").section);
    const b = extractSectionSeatSnapshot(makeGraph("1", { enrollment: 2 }).section);
    expect(sectionSeatsEqual(a, b)).toBe(false);
  });
});
