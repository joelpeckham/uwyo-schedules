import { afterEach, describe, expect, it, vi } from "vitest";

import {
  allocateNextItemId,
  mergeMigrationTerms,
  PLANNER_LOCAL_STORAGE_KEY,
  readLocalDoc,
  readTerm,
  writeLocalDoc,
  writeTerm,
} from "@/lib/planner/local-state";

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

describe("local-state", () => {
  it("read/write round-trip", () => {
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
        },
      ],
    });
    const term = readTerm("202610");
    expect(term.items).toHaveLength(1);
    expect(term.items[0]?.subject).toBe("MATH");
  });

  it("allocateNextItemId is monotonic", () => {
    mockLocalStorage();
    expect(allocateNextItemId()).toBe(1);
    expect(allocateNextItemId()).toBe(2);
    expect(readLocalDoc().nextId).toBe(3);
  });

  it("rejects malformed stored JSON", () => {
    mockLocalStorage();
    storage.set(PLANNER_LOCAL_STORAGE_KEY, "{not valid");
    expect(readLocalDoc().v).toBe(2);
    expect(readLocalDoc().terms).toEqual({});
  });

  it("mergeMigrationTerms sets migrated and bumps nextId", () => {
    mockLocalStorage();
    writeLocalDoc({ v: 2, migrated: false, nextId: 1, terms: {} });
    mergeMigrationTerms({
      "202610": {
        items: [
          {
            id: 99,
            sessionId: "x",
            termCode: "202610",
            subject: "CHEM",
            courseNumber: "1020",
            displayColor: "#3CB44B",
            selectionKind: "unresolved",
            anchorCrn: null,
            linkedBundleId: null,
            instructorPrefs: { v: 1, primary: [] },
            sectionPins: { v: 1, byType: {} },
          },
        ],
        blackouts: { v: 1, items: [] },
        timePrefs: { v: 1 },
        lastSolutionIndex: 2,
      },
    });
    const doc = readLocalDoc();
    expect(doc.migrated).toBe(true);
    expect(doc.nextId).toBeGreaterThanOrEqual(100);
    expect(readTerm("202610").items).toHaveLength(1);
    expect(readTerm("202610").lastSolutionIndex).toBe(2);
  });
});
