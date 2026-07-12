import { describe, it, expect } from "vitest";
import { AdaptiveRateLimiter } from "@/server/optimization/adaptive-rate-limiter";

describe("adaptive rate limiter", () => {
  it("starts at minimum concurrency", () => {
    const limiter = new AdaptiveRateLimiter({ minConcurrency: 1, maxConcurrency: 5 });
    expect(limiter.getConcurrency()).toBe(1);
  });

  it("increases concurrency when healthy", () => {
    const limiter = new AdaptiveRateLimiter({
      minConcurrency: 1,
      maxConcurrency: 5,
      targetLatencyMs: 1000,
      adjustmentInterval: 0, // adjust immediately
    });

    // Record healthy results
    for (let i = 0; i < 10; i++) {
      limiter.recordResult(500, true);
    }

    expect(limiter.getConcurrency()).toBeGreaterThan(1);
  });

  it("decreases concurrency on high error rate", () => {
    const limiter = new AdaptiveRateLimiter({
      minConcurrency: 1,
      maxConcurrency: 5,
      targetLatencyMs: 2000,
      maxErrorRate: 0.1,
      adjustmentInterval: 0,
    });

    // Start by increasing
    for (let i = 0; i < 10; i++) {
      limiter.recordResult(500, true);
    }
    limiter.getConcurrency(); // trigger adjustment

    // Now record errors
    for (let i = 0; i < 10; i++) {
      limiter.recordResult(500, false);
    }

    const concurrency = limiter.getConcurrency();
    expect(concurrency).toBe(1); // should be at minimum
  });

  it("decreases concurrency on high latency", () => {
    const limiter = new AdaptiveRateLimiter({
      minConcurrency: 1,
      maxConcurrency: 5,
      targetLatencyMs: 1000,
      adjustmentInterval: 0,
    });

    // Record slow results
    for (let i = 0; i < 10; i++) {
      limiter.recordResult(5000, true);
    }

    expect(limiter.getConcurrency()).toBe(1);
  });

  it("respects rate limit headers", () => {
    const limiter = new AdaptiveRateLimiter({
      minConcurrency: 1,
      maxConcurrency: 5,
      adjustmentInterval: 0,
    });

    // Increase first
    for (let i = 0; i < 10; i++) {
      limiter.recordResult(500, true);
    }
    limiter.getConcurrency();

    // Hit rate limit
    limiter.recordResult(0, false, 5000);

    expect(limiter.getConcurrency()).toBe(1);
    const metrics = limiter.getMetrics();
    expect(metrics.isRateLimited).toBe(true);
  });

  it("reports metrics correctly", () => {
    const limiter = new AdaptiveRateLimiter();
    limiter.recordResult(100, true);
    limiter.recordResult(200, true);
    limiter.recordResult(150, false);

    const metrics = limiter.getMetrics();
    expect(metrics.totalRequests).toBe(3);
    expect(metrics.errorRate).toBeCloseTo(0.33, 1);
    expect(metrics.avgLatencyMs).toBeGreaterThan(0);
  });

  it("never exceeds max concurrency", () => {
    const limiter = new AdaptiveRateLimiter({
      minConcurrency: 1,
      maxConcurrency: 3,
      targetLatencyMs: 100,
      adjustmentInterval: 0,
    });

    for (let i = 0; i < 100; i++) {
      limiter.recordResult(50, true);
    }
    limiter.getConcurrency();
    limiter.getConcurrency();
    limiter.getConcurrency();

    expect(limiter.getConcurrency()).toBeLessThanOrEqual(3);
  });
});
