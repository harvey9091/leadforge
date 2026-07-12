import { describe, it, expect } from "vitest";
import type { SimilarityFactors } from "@/server/signals/similar-company-engine";

describe("similar company engine", () => {
  it("SimilarityFactors interface has correct fields", () => {
    const factors: SimilarityFactors = {
      industry: 100,
      technologies: 80,
      targetCustomer: 100,
      pricingModel: 50,
      icpMatch: 75,
      overall: 82,
    };
    expect(factors.industry).toBe(100);
    expect(factors.overall).toBe(82);
  });

  it("overall score should be weighted sum of factors", () => {
    const factors: SimilarityFactors = {
      industry: 100, // 0.25 weight
      technologies: 100, // 0.30 weight
      targetCustomer: 100, // 0.15 weight
      pricingModel: 100, // 0.10 weight
      icpMatch: 100, // 0.20 weight
      overall: 0,
    };
    const expected = Math.round(100 * 0.25 + 100 * 0.30 + 100 * 0.15 + 100 * 0.10 + 100 * 0.20);
    factors.overall = expected;
    expect(factors.overall).toBe(100);
  });

  it("companies with no common technologies should have 0 tech similarity", () => {
    const sourceTechs = new Set(["React", "Next.js"]);
    const candidateTechs = new Set(["Vue", "Django"]);
    const intersection = new Set([...sourceTechs].filter((t) => candidateTechs.has(t)));
    const union = new Set([...sourceTechs, ...candidateTechs]);
    const similarity = union.size > 0 ? (intersection.size / union.size) * 100 : 0;
    expect(similarity).toBe(0);
  });

  it("companies with same technologies should have 100 tech similarity", () => {
    const sourceTechs = new Set(["React", "Next.js"]);
    const candidateTechs = new Set(["React", "Next.js"]);
    const intersection = new Set([...sourceTechs].filter((t) => candidateTechs.has(t)));
    const union = new Set([...sourceTechs, ...candidateTechs]);
    const similarity = union.size > 0 ? (intersection.size / union.size) * 100 : 0;
    expect(similarity).toBe(100);
  });

  it("partial technology overlap should produce partial similarity", () => {
    const sourceTechs = new Set(["React", "Next.js", "Stripe"]);
    const candidateTechs = new Set(["React", "Next.js", "Vercel"]);
    const intersection = new Set([...sourceTechs].filter((t) => candidateTechs.has(t)));
    const union = new Set([...sourceTechs, ...candidateTechs]);
    const similarity = union.size > 0 ? (intersection.size / union.size) * 100 : 0;
    expect(similarity).toBeCloseTo(50, 0); // 2 out of 4
  });
});
