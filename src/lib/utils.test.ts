import { expect, it } from "vitest";
import { cn } from "./utils";

it("cn merges classes", () => {
  expect(cn("a", "b")).toBe("a b");
  expect(cn("a", { b: true, c: false })).toBe("a b");
});
