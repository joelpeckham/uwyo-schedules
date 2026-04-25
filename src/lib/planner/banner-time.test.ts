import { describe, expect, it } from "vitest";
import {
  bannerClockToMinutes,
  minutesToDecimalHour,
  parseBannerClock,
} from "./banner-time";

describe("parseBannerClock", () => {
  it("parses 4-digit afternoon time", () => {
    expect(parseBannerClock("1510")).toEqual({ hour: 15, minute: 10 });
  });
  it("pads short strings", () => {
    expect(parseBannerClock("910")).toEqual({ hour: 9, minute: 10 });
  });
  it("returns null for empty", () => {
    expect(parseBannerClock("")).toBeNull();
    expect(parseBannerClock(null)).toBeNull();
  });
});

describe("bannerClockToMinutes", () => {
  it("converts to minutes from midnight", () => {
    expect(bannerClockToMinutes("0810")).toBe(490);
    expect(bannerClockToMinutes("0000")).toBe(0);
  });
});

describe("minutesToDecimalHour", () => {
  it("converts", () => {
    expect(minutesToDecimalHour(90)).toBe(1.5);
  });
});
