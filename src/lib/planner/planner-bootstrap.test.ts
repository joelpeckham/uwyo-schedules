import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildPlannerBootstrapScript,
  getStoredItemCount,
} from "@/lib/planner/planner-bootstrap";
import {
  PLANNER_LOCAL_STORAGE_KEY,
  writeTerm,
} from "@/lib/planner/local-state";
import { defaultItemScheduleFilters } from "@/lib/planner/schedule-filters";

const storage = new Map<string, string>();

function mockLocalStorage() {
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      storage.set(k, v);
    },
    removeItem: (k: string) => {
      storage.delete(k);
    },
  });
}

afterEach(() => {
  storage.clear();
  vi.unstubAllGlobals();
});

describe("planner-bootstrap", () => {
  it("getStoredItemCount returns 0 for missing term", () => {
    mockLocalStorage();
    expect(getStoredItemCount("202610")).toBe(0);
  });

  it("getStoredItemCount returns item length for stored term", () => {
    mockLocalStorage();
    writeTerm("202610", {
      items: [
        {
          id: 1,
          sessionId: "",
          termCode: "202610",
          subject: "MATH",
          courseNumber: "1400",
          displayColor: "#E6194B",
          selectionKind: "unresolved",
          anchorCrn: null,
          linkedBundleId: null,
          instructorPrefs: { v: 1, primary: [] },
          sectionPins: { v: 1, byType: {} },
          scheduleFilters: defaultItemScheduleFilters(),
        },
      ],
    });
    expect(getStoredItemCount("202610")).toBe(1);
    expect(getStoredItemCount("202520")).toBe(0);
  });

  it("getStoredItemCount treats malformed JSON as empty", () => {
    mockLocalStorage();
    storage.set(PLANNER_LOCAL_STORAGE_KEY, "{not valid");
    expect(getStoredItemCount("202610")).toBe(0);
  });

  it("buildPlannerBootstrapScript embeds term and storage key", () => {
    const script = buildPlannerBootstrapScript("202610");
    expect(script).toContain("uwyoschedule:planner:v2");
    expect(script).toContain('"202610"');
    expect(script).toContain("dataset.plannerItems");
    expect(script).toContain("dataset.plannerNoTransition");
  });
});
