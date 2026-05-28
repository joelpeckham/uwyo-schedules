import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addCourseLocal,
  addCourseWithOptionalPinLocal,
} from "@/lib/planner/add-course-local";
import { MAX_PLANNER_COURSES_PER_TERM } from "@/lib/planner/constants";
import { PLANNER_LOCAL_STORAGE_KEY, readTerm } from "@/lib/planner/local-state";

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

describe("addCourseWithOptionalPinLocal", () => {
  it("adds a new course", () => {
    mockLocalStorage();
    const res = addCourseWithOptionalPinLocal({
      termCode: "202610",
      subject: "PHYS",
      courseNumber: "1110",
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.wasAdded).toBe(true);
    expect(res.item.subject).toBe("PHYS");
    expect(readTerm("202610").items).toHaveLength(1);
  });

  it("pins a section when adding from a CRN page", () => {
    mockLocalStorage();
    const res = addCourseWithOptionalPinLocal({
      termCode: "202610",
      subject: "PHYS",
      courseNumber: "1110",
      sectionPin: { crn: "10225", scheduleTypeKey: "lecture" },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.item.sectionPins).toEqual({
      v: 1,
      byType: { lecture: "10225" },
    });
  });

  it("updates pin when course already exists", () => {
    mockLocalStorage();
    addCourseLocal({
      termCode: "202610",
      subject: "PHYS",
      courseNumber: "1110",
    });
    const res = addCourseWithOptionalPinLocal({
      termCode: "202610",
      subject: "PHYS",
      courseNumber: "1110",
      sectionPin: { crn: "10225", scheduleTypeKey: "lecture" },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.wasAdded).toBe(false);
    expect(readTerm("202610").items).toHaveLength(1);
    expect(readTerm("202610").items[0]?.sectionPins).toEqual({
      v: 1,
      byType: { lecture: "10225" },
    });
  });

  it("returns error when term is at course limit and course is new", () => {
    mockLocalStorage();
    for (let i = 0; i < MAX_PLANNER_COURSES_PER_TERM; i++) {
      addCourseLocal({
        termCode: "202610",
        subject: "SUBJ",
        courseNumber: String(1000 + i),
      });
    }
    const res = addCourseWithOptionalPinLocal({
      termCode: "202610",
      subject: "PHYS",
      courseNumber: "1110",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain(String(MAX_PLANNER_COURSES_PER_TERM));
  });

  it("ignores empty schedule type keys", () => {
    mockLocalStorage();
    const res = addCourseWithOptionalPinLocal({
      termCode: "202610",
      subject: "PHYS",
      courseNumber: "1110",
      sectionPin: { crn: "10225", scheduleTypeKey: "   " },
    });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.item.sectionPins).toEqual({ v: 1, byType: {} });
  });

  it("persists across readTerm", () => {
    mockLocalStorage();
    addCourseWithOptionalPinLocal({
      termCode: "202610",
      subject: "MATH",
      courseNumber: "1400",
      sectionPin: { crn: "20001", scheduleTypeKey: "lecture" },
    });
    const raw = storage.get(PLANNER_LOCAL_STORAGE_KEY);
    expect(raw).toBeTruthy();
    const item = readTerm("202610").items[0];
    expect(item?.sectionPins).toEqual({
      v: 1,
      byType: { lecture: "20001" },
    });
  });
});
