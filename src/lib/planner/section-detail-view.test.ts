import { describe, expect, it } from "vitest";
import {
  formatBannerTimeDisplay,
  formatBannerTimeRange,
  formatMeetingDays,
  parseSectionRawJson,
} from "./section-detail-view";

describe("parseSectionRawJson", () => {
  it("accepts object root", () => {
    const r = parseSectionRawJson({ subject: "MATH" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.root.subject).toBe("MATH");
  });

  it("parses JSON object string", () => {
    const r = parseSectionRawJson('{"crn":"1"}');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.root.crn).toBe("1");
  });

  it("rejects invalid JSON string", () => {
    const r = parseSectionRawJson("{");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/parse/i);
  });

  it("rejects array root", () => {
    const r = parseSectionRawJson([]);
    expect(r.ok).toBe(false);
  });
});

describe("formatBannerTimeDisplay", () => {
  it("formats afternoon time", () => {
    expect(formatBannerTimeDisplay("1510")).toBe("3:10 p.m.");
  });

  it("formats morning with leading zeros", () => {
    expect(formatBannerTimeDisplay("0900")).toBe("9:00 a.m.");
  });

  it("formats noon", () => {
    expect(formatBannerTimeDisplay("1200")).toBe("12:00 p.m.");
  });

  it("returns null for empty", () => {
    expect(formatBannerTimeDisplay("")).toBeNull();
    expect(formatBannerTimeDisplay(null)).toBeNull();
  });
});

describe("formatBannerTimeRange", () => {
  it("joins begin and end", () => {
    expect(formatBannerTimeRange("1510", "1600")).toBe(
      "3:10 p.m. – 4:00 p.m.",
    );
  });
});

describe("formatMeetingDays", () => {
  it("lists selected weekdays", () => {
    expect(
      formatMeetingDays({
        monday: true,
        wednesday: true,
        friday: true,
        tuesday: false,
        thursday: false,
        saturday: false,
        sunday: false,
      }),
    ).toBe("Mon, Wed, Fri");
  });

  it("returns null when no day is true", () => {
    expect(
      formatMeetingDays({
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false,
      }),
    ).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(formatMeetingDays(undefined)).toBeNull();
  });
});
