import { describe, it, expect } from "vitest";
import { estimateCost } from "@/server/optimization/prompt-versioning";

describe("prompt versioning", () => {
  it("estimates cost based on token usage", () => {
    expect(estimateCost(0)).toBe(0);
    expect(estimateCost(1000)).toBeCloseTo(0.002, 3);
    expect(estimateCost(10000)).toBeCloseTo(0.02, 2);
    expect(estimateCost(100000)).toBeCloseTo(0.2, 1);
  });

  it("scales linearly with tokens", () => {
    const cost1k = estimateCost(1000);
    const cost10k = estimateCost(10000);
    expect(cost10k).toBeCloseTo(cost1k * 10, 2);
  });

  it("returns 0 for zero tokens", () => {
    expect(estimateCost(0)).toBe(0);
  });
});
