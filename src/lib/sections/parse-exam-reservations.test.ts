import { describe, expect, it } from "vitest";
import { parseExamReservations } from "./parse-exam-reservations";

describe("parseExamReservations", () => {
  it("parses LIFE 1010 midterm reservation", () => {
    const { reservations, vagueExamNote } = parseExamReservations(
      "Tuesday 5:10-6:50 pm reserved for midterm exams",
    );
    expect(vagueExamNote).toBe(false);
    expect(reservations).toHaveLength(1);
    expect(reservations[0]?.days).toEqual([1]);
    expect(reservations[0]?.startMinutes).toBe(17 * 60 + 10);
    expect(reservations[0]?.endMinutes).toBe(18 * 60 + 50);
    expect(reservations[0]?.kind).toBe("midterm");
  });

  it("parses PHYS 1110 Thursday evening exam reservation", () => {
    const { reservations } = parseExamReservations(
      "Reserve Thursday evenings 5:10-7pm for exams",
    );
    expect(reservations).toHaveLength(1);
    expect(reservations[0]?.days).toEqual([3]);
    expect(reservations[0]?.startMinutes).toBe(17 * 60 + 10);
    expect(reservations[0]?.endMinutes).toBe(19 * 60);
    expect(reservations[0]?.kind).toBe("exam");
  });

  it("parses CHEM 2420 Wednesday reservation", () => {
    const { reservations } = parseExamReservations(
      "Reserve Wednesdays 5:10pm-7pm for exams",
    );
    expect(reservations).toHaveLength(1);
    expect(reservations[0]?.days).toEqual([2]);
    expect(reservations[0]?.startMinutes).toBe(17 * 60 + 10);
    expect(reservations[0]?.endMinutes).toBe(19 * 60);
  });

  it("parses CHEM 1020 Wednesday reservation in full section information", () => {
    const { reservations, vagueExamNote } = parseExamReservations(
      "Students must enroll in a laboratory (Sections 13A - 13H) and discussion (23A - 23H). Wednesdays 5-7 pm are reserved for exams. Labs begin September 4. Students who have not attended lab on September 4 may be administratively dropped from the course. Prerequisites required: ACT Math score of 23 or successful completion of or concurrent enrollment in MATH 1400, 1405, or 1450. Students not meeting prerequisites will be dropped.",
    );
    expect(vagueExamNote).toBe(false);
    expect(reservations).toHaveLength(1);
    expect(reservations[0]?.days).toEqual([2]);
    expect(reservations[0]?.startMinutes).toBe(17 * 60);
    expect(reservations[0]?.endMinutes).toBe(19 * 60);
    expect(reservations[0]?.kind).toBe("exam");
  });

  it("flags vague exam notes without a parseable slot", () => {
    const { reservations, vagueExamNote } = parseExamReservations(
      "Evening exams will be scheduled.",
    );
    expect(reservations).toHaveLength(0);
    expect(vagueExamNote).toBe(true);
  });

  it("returns empty for non-exam text", () => {
    const { reservations, vagueExamNote } = parseExamReservations(
      "Labs begin the first week of classes.",
    );
    expect(reservations).toHaveLength(0);
    expect(vagueExamNote).toBe(false);
  });
});
