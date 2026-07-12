import { describe, it, expect } from "vitest";
import { parseSemanticQuery } from "@/server/signals/semantic-search";

describe("semantic search parser", () => {
  it("detects industries", () => {
    const filters = parseSemanticQuery("AI startups hiring frontend engineers");
    expect(filters.industries).toContain("AI");
  });

  it("detects technologies", () => {
    const filters = parseSemanticQuery("companies using Next.js and Stripe");
    expect(filters.technologies).toContain("Next.js");
    expect(filters.technologies).toContain("Stripe");
  });

  it("detects funding stages", () => {
    const filters = parseSemanticQuery("Series A cybersecurity companies");
    expect(filters.fundingStages).toContain("Series A");
    expect(filters.industries).toContain("Security");
  });

  it("detects max price", () => {
    const filters = parseSemanticQuery("Developer tools with pricing under $50");
    expect(filters.maxPrice).toBe(50);
    expect(filters.industries).toContain("Developer Tools");
  });

  it("detects target customers", () => {
    const filters = parseSemanticQuery("B2B SaaS marketplace companies");
    expect(filters.targetCustomers).toContain("B2B");
    expect(filters.targetCustomers).toContain("Marketplace");
  });

  it("detects hiring roles", () => {
    const filters = parseSemanticQuery("AI startups hiring frontend engineers");
    expect(filters.hiringRoles).toContain("Frontend");
    expect(filters.hiringRoles).toContain("Engineering");
  });

  it("detects regions", () => {
    const filters = parseSemanticQuery("European AI startups");
    expect(filters.regions).toContain("Europe");
  });

  it("handles complex queries", () => {
    const filters = parseSemanticQuery("YC companies using Next.js with Series A funding");
    expect(filters.technologies).toContain("Next.js");
    expect(filters.fundingStages).toContain("Series A");
  });

  it("extracts keywords not matched by patterns", () => {
    const filters = parseSemanticQuery("cybersecurity companies using kubernetes");
    expect(filters.industries).toContain("Security");
    expect(filters.technologies).toContain("Kubernetes");
  });

  it("handles empty query", () => {
    const filters = parseSemanticQuery("");
    expect(filters.industries).toHaveLength(0);
    expect(filters.technologies).toHaveLength(0);
  });
});
