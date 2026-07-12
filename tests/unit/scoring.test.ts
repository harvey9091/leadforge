import { describe, it, expect } from "vitest";
import { computeScore } from "../../services/scoring/src";

describe("computeScore", () => {
  it("returns grade A for high signals", () => {
    const result = computeScore({
      icpFit: 98,
      maturity: 95,
      pricingAvailability: 92,
      hiring: 90,
      funding: 88,
      launchRecency: 95,
      websiteQuality: 95,
      videoOpportunity: 90,
    });
    expect(result.grade).toBe("A");
    expect(result.overall).toBeGreaterThanOrEqual(90);
  });

  it("returns grade F for low signals", () => {
    const result = computeScore({
      icpFit: 30,
      maturity: 25,
      pricingAvailability: 20,
      hiring: 15,
      funding: 30,
      launchRecency: 40,
      websiteQuality: 50,
      videoOpportunity: 20,
    });
    expect(result.grade).toBe("F");
    expect(result.overall).toBeLessThan(60);
  });

  it("produces a weighted overall between 0 and 100", () => {
    const result = computeScore({
      icpFit: 70,
      maturity: 70,
      pricingAvailability: 70,
      hiring: 70,
      funding: 70,
      launchRecency: 70,
      websiteQuality: 70,
      videoOpportunity: 70,
    });
    expect(result.overall).toBe(70);
    expect(result.grade).toBe("C");
  });
});
