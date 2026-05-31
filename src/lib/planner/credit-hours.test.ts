import { describe, expect, it } from "vitest";
import {
  computePlannerCreditHours,
  effectiveCreditHours,
  formatCreditValue,
} from "./credit-hours";
import type { CalendarBlock, PlannerItemRow } from "./data";

describe("effectiveCreditHours", () => {
  it("uses creditHours when present (ARE3030)", () => {
    expect(
      effectiveCreditHours({
        creditHours: 3,
        creditHourLow: 3,
        creditHourHigh: null,
        creditHourIndicator: null,
      }),
    ).toBe(3);
  });

  it("falls back to creditHourLow when creditHours is null and no indicator (ECON5330)", () => {
    expect(
      effectiveCreditHours({
        creditHours: null,
        creditHourLow: 3,
        creditHourHigh: null,
        creditHourIndicator: null,
      }),
    ).toBe(3);
  });

  it("keeps zero creditHours for lab sections (LIFE1010 lab)", () => {
    expect(
      effectiveCreditHours({
        creditHours: 0,
        creditHourLow: 0,
        creditHourHigh: 4,
        creditHourIndicator: "OR",
      }),
    ).toBe(0);
  });

  it("returns null for genuinely variable TO ranges", () => {
    expect(
      effectiveCreditHours({
        creditHours: null,
        creditHourLow: 1,
        creditHourHigh: 12,
        creditHourIndicator: "TO",
      }),
    ).toBeNull();
  });
});

describe("formatCreditValue", () => {
  it("shows the effective single value", () => {
    expect(
      formatCreditValue({
        creditHours: null,
        creditHourLow: 3,
        creditHourHigh: null,
        creditHourIndicator: null,
      }),
    ).toBe("3");
  });

  it("shows a range when credits are variable", () => {
    expect(
      formatCreditValue({
        creditHours: null,
        creditHourLow: 1,
        creditHourHigh: 12,
        creditHourIndicator: "TO",
      }),
    ).toBe("1–12");
  });

  it("shows em dash when nothing is known", () => {
    expect(
      formatCreditValue({
        creditHours: null,
        creditHourLow: null,
        creditHourHigh: null,
        creditHourIndicator: null,
      }),
    ).toBe("—");
  });
});

describe("computePlannerCreditHours", () => {
  const plannerItems = [
    {
      id: 1,
      termCode: "202710",
      subject: "ECON",
      courseNumber: "5330",
      anchorCrn: "10613",
      linkedBundleId: null,
      sortOrder: 0,
    },
  ] as unknown as PlannerItemRow[];

  const calendarBlocks: CalendarBlock[] = [];

  it("counts creditHourLow when creditHours is null on the anchor section", () => {
    const total = computePlannerCreditHours(plannerItems, calendarBlocks, [
      {
        crn: "10613",
        creditHours: null,
        creditHourLow: 3,
        creditHourHigh: null,
        creditHourIndicator: null,
      },
    ]);
    expect(total).toBe(3);
  });

  it("does not count variable-credit sections without a fixed value", () => {
    const total = computePlannerCreditHours(
      [
        {
          id: 2,
          termCode: "202710",
          subject: "PSYC",
          courseNumber: "5980",
          anchorCrn: "20001",
          linkedBundleId: null,
          sortOrder: 0,
        },
      ] as unknown as PlannerItemRow[],
      calendarBlocks,
      [
        {
          crn: "20001",
          creditHours: null,
          creditHourLow: 1,
          creditHourHigh: 12,
          creditHourIndicator: "TO",
        },
      ],
    );
    expect(total).toBe(0);
  });
});
