import { describe, expect, it } from "vitest";
import {
  classifyDeliveryMode,
  deliveryModeLabel,
  meetingHasTimeBlock,
} from "./delivery-mode";

describe("classifyDeliveryMode", () => {
  it("classifies UW 'Online-Asynchronous' as online_async even without timed meetings", () => {
    expect(
      classifyDeliveryMode({
        instructionalMethod: "I",
        instructionalMethodDescription: "Online-Asynchronous",
        hasTimedMeetings: false,
      }),
    ).toBe("online_async");
  });

  it("classifies UW 'Traditional' with at least one timed meeting as in_person", () => {
    expect(
      classifyDeliveryMode({
        instructionalMethod: "TR",
        instructionalMethodDescription: "Traditional",
        hasTimedMeetings: true,
      }),
    ).toBe("in_person");
  });

  it("classifies a 'Traditional' section that ingest left without timed meetings as TBA", () => {
    expect(
      classifyDeliveryMode({
        instructionalMethod: "TR",
        instructionalMethodDescription: "Traditional",
        hasTimedMeetings: false,
      }),
    ).toBe("tba");
  });

  it("classifies hybrid descriptions as hybrid even with timed meetings", () => {
    expect(
      classifyDeliveryMode({
        instructionalMethod: "B",
        instructionalMethodDescription: "Hybrid",
        hasTimedMeetings: true,
      }),
    ).toBe("hybrid");
    expect(
      classifyDeliveryMode({
        instructionalMethod: null,
        instructionalMethodDescription: "Blended",
        hasTimedMeetings: true,
      }),
    ).toBe("hybrid");
  });

  it("classifies online without explicit async/sync as async when no timed meetings exist", () => {
    expect(
      classifyDeliveryMode({
        instructionalMethod: null,
        instructionalMethodDescription: "Online",
        hasTimedMeetings: false,
      }),
    ).toBe("online_async");
  });

  it("classifies online with timed meetings but no async hint as online_sync", () => {
    expect(
      classifyDeliveryMode({
        instructionalMethod: null,
        instructionalMethodDescription: "Online-Synchronous",
        hasTimedMeetings: true,
      }),
    ).toBe("online_sync");
  });
});

describe("deliveryModeLabel", () => {
  it("returns null for in_person so the table does not show a redundant pill", () => {
    expect(deliveryModeLabel("in_person")).toBeNull();
  });

  it("returns short labels for the other modes", () => {
    expect(deliveryModeLabel("online_async")).toMatch(/online/i);
    expect(deliveryModeLabel("hybrid")).toBe("Hybrid");
    expect(deliveryModeLabel("tba")).toBe("Time TBA");
  });
});

describe("meetingHasTimeBlock", () => {
  it("requires both a time and at least one day flag", () => {
    expect(
      meetingHasTimeBlock({
        beginTime: "1000",
        endTime: "1050",
        monday: true,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false,
      }),
    ).toBe(true);

    expect(
      meetingHasTimeBlock({
        beginTime: "1000",
        endTime: "1050",
        monday: false,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false,
      }),
    ).toBe(false);

    expect(
      meetingHasTimeBlock({
        beginTime: null,
        endTime: null,
        monday: true,
        tuesday: false,
        wednesday: false,
        thursday: false,
        friday: false,
        saturday: false,
        sunday: false,
      }),
    ).toBe(false);
  });
});
