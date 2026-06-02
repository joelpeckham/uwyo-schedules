import { describe, expect, it } from "vitest";

import { defaultItemScheduleFilters } from "@/lib/planner/schedule-filters";
import {
  buildSharePayload,
  parseSharePayload,
} from "@/lib/planner/share-state";

describe("share-state", () => {
  it("round-trips a full planner payload", () => {
    const payload = buildSharePayload({
      termCode: "202610",
      items: [
        {
          id: 1,
          sessionId: "",
          termCode: "202610",
          subject: "MATH",
          courseNumber: "2200",
          displayColor: "#E6194B",
          selectionKind: "single_crn",
          anchorCrn: "12345",
          linkedBundleId: null,
          instructorPrefs: { v: 1, primary: ["Smith"] },
          sectionPins: { v: 1, byType: {} },
          scheduleFilters: defaultItemScheduleFilters(),
        },
      ],
      blackouts: { v: 1, items: [] },
    });
    const parsed = parseSharePayload(payload);
    expect(parsed?.termCode).toBe("202610");
    expect(parsed?.items).toHaveLength(1);
    expect(parsed?.items[0]?.anchorCrn).toBe("12345");
  });

  it("rejects invalid payloads", () => {
    expect(parseSharePayload(null)).toBeNull();
    expect(parseSharePayload({ v: 2 })).toBeNull();
  });
});
