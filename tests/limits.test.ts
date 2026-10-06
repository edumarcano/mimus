import { describe, expect, it } from "vitest";
import { countCodePoints } from "@/lib/limits";

describe("countCodePoints", () => {
  it("counts ASCII characters", () => {
    expect(countCodePoints("hello")).toBe(5);
  });

  it("counts emoji as one code point each", () => {
    expect(countCodePoints("a🎉b")).toBe(3);
  });

  it("counts combining marks separately", () => {
    expect(countCodePoints("e\u0301")).toBe(2);
  });
});
