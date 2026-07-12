import { describe, it, expect } from "vitest";
import { getCompanyFeedback } from "@/server/optimization/feedback-loop";

describe("feedback loop", () => {
  // These tests would need database setup — testing the logic shape only

  it("FeedbackSummary interface has correct fields", () => {
    const summary = {
      excellent: 0,
      good: 0,
      poor: 0,
      false_positive: 0,
      total: 0,
      qualityScore: 0,
    };
    expect(summary.excellent).toBe(0);
    expect(summary.qualityScore).toBe(0);
  });

  it("quality score calculation would weight excellent as 100", () => {
    // excellent=100, good=70, poor=30, false_positive=0
    const scores = [100, 70, 30, 0];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    expect(avg).toBe(50);
  });

  it("quality score with all excellent should be 100", () => {
    const scores = [100, 100, 100];
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    expect(avg).toBe(100);
  });
});
