import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("merges class names", () => {
    expect(cn("a", "b")).toBe("a b");
  });

  it("dedupes conflicting tailwind classes (later wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("handles falsy values", () => {
    expect(cn("a", null, undefined, false, "b")).toBe("a b");
  });

  it("supports conditional objects", () => {
    expect(cn({ a: true, b: false, c: true })).toContain("a");
  });
});
