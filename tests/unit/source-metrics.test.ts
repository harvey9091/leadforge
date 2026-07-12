import { describe, it, expect } from "vitest";
import { calculateCompositeScore, DEFAULT_SOURCE_PRIORITIES, type SourceMetricData } from "@/server/optimization/source-metrics";

describe("source metrics engine", () => {
  const baseMetric: SourceMetricData = {
    sourceType: "YC",
    priority: 100,
    companiesDiscovered: 100,
    companiesRetained: 80,
    duplicateCount: 20,
    enrichmentSuccess: 70,
    enrichmentFailure: 10,
    avgQualificationScore: 75,
    avgConfidence: 85,
    avgIcpMatch: 80,
    exportRate: 30,
    reliabilityScore: 90,
    lastCrawlAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    failureCount: 0,
    consecutiveFailures: 0,
  };

  it("has default priorities for all sources", () => {
    expect(DEFAULT_SOURCE_PRIORITIES.YC).toBe(100);
    expect(DEFAULT_SOURCE_PRIORITIES.PRODUCT_HUNT).toBe(90);
    expect(DEFAULT_SOURCE_PRIORITIES.HACKER_NEWS).toBe(80);
    expect(DEFAULT_SOURCE_PRIORITIES.BETALIST).toBe(60);
  });

  it("calculates composite score with high quality metrics", () => {
    const score = calculateCompositeScore(baseMetric);
    expect(score).toBeGreaterThan(50);
    expect(score).toBeLessThanOrEqual(100);
  });

  it("scores high-retention sources higher", () => {
    const lowRetention = { ...baseMetric, companiesRetained: 20 };
    const highRetention = { ...baseMetric, companiesRetained: 90 };
    expect(calculateCompositeScore(highRetention)).toBeGreaterThan(calculateCompositeScore(lowRetention));
  });

  it("scores high-confidence sources higher", () => {
    const lowConf = { ...baseMetric, avgConfidence: 40, avgIcpMatch: 40 };
    const highConf = { ...baseMetric, avgConfidence: 90, avgIcpMatch: 90 };
    expect(calculateCompositeScore(highConf)).toBeGreaterThan(calculateCompositeScore(lowConf));
  });

  it("penalizes high duplicate rates", () => {
    const lowDupe = { ...baseMetric, duplicateCount: 5, companiesDiscovered: 100 };
    const highDupe = { ...baseMetric, duplicateCount: 80, companiesDiscovered: 100 };
    expect(calculateCompositeScore(lowDupe)).toBeGreaterThan(calculateCompositeScore(highDupe));
  });

  it("scores reliable sources higher", () => {
    const unreliable = { ...baseMetric, reliabilityScore: 20 };
    const reliable = { ...baseMetric, reliabilityScore: 95 };
    expect(calculateCompositeScore(reliable)).toBeGreaterThan(calculateCompositeScore(unreliable));
  });

  it("handles zero discoveries gracefully", () => {
    const zeroMetric: SourceMetricData = {
      ...baseMetric,
      companiesDiscovered: 0,
      companiesRetained: 0,
      duplicateCount: 0,
    };
    const score = calculateCompositeScore(zeroMetric);
    expect(score).not.toBeNaN();
    expect(score).toBeGreaterThanOrEqual(0);
  });
});
