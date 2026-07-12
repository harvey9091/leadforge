import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildUserPrompt, hashPrompt, hashWebsiteContent, type PromptContext } from "@/server/ai/prompt-builder";

describe("prompt builder", () => {
  const mockContext: PromptContext = {
    company: {
      name: "Acme",
      domain: "acme.com",
      website: "https://acme.com",
      description: "A SaaS tool for developers",
      industry: "Developer Tools",
      country: "United States",
      foundedYear: 2020,
      fundingStage: "Seed",
      employeeEstimate: "11-50",
      headline: "Build better software",
      pricingModel: "subscription",
      pricingDetected: true,
      trialDetected: true,
      freemiumDetected: false,
      enterpriseDetected: false,
      callToAction: "Start free trial",
      supportEmail: "support@acme.com",
      contactEmail: "hello@acme.com",
      linkedinUrl: "https://linkedin.com/company/acme",
      twitterUrl: null,
      websiteHttps: true,
      websiteStatus: 200,
      websiteSpeedMs: 500,
      enrichmentPages: 5,
    },
    contentBlocks: [
      { pageType: "HOMEPAGE", blockType: "heading", heading: "Welcome", content: "Build better software with Acme" },
      { pageType: "PRICING", blockType: "paragraph", heading: null, content: "Starts at $29 per month" },
    ],
    technologies: [
      { name: "Next.js", category: "frontend" },
      { name: "Stripe", category: "payments" },
    ],
    icp: {
      industries: ["Developer Tools"],
      categories: ["SaaS"],
      targetMarkets: ["B2B"],
      minEmployees: 10,
      maxEmployees: 200,
      fundingStages: ["Seed", "Series A"],
      hiringRoles: ["Engineering"],
      pricingVisible: true,
      regions: ["North America"],
    },
  };

  it("builds a system prompt with JSON instructions", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("JSON");
    expect(prompt).toContain("evidence");
    expect(prompt).toContain("confidence");
    expect(prompt.length).toBeGreaterThan(500);
  });

  it("builds a user prompt with company data", () => {
    const prompt = buildUserPrompt(mockContext);
    expect(prompt).toContain("Acme");
    expect(prompt).toContain("acme.com");
    expect(prompt).toContain("Developer Tools");
    expect(prompt).toContain("Next.js");
    expect(prompt).toContain("Stripe");
    expect(prompt).toContain("$29");
    expect(prompt).toContain("ICP Configuration");
  });

  it("handles missing optional fields gracefully", () => {
    const minimalContext: PromptContext = {
      company: {
        name: "Test Co",
        domain: null,
        website: null,
        description: null,
        industry: null,
        country: null,
        foundedYear: null,
        fundingStage: null,
        employeeEstimate: null,
        headline: null,
        pricingModel: null,
        pricingDetected: false,
        trialDetected: false,
        freemiumDetected: false,
        enterpriseDetected: false,
        callToAction: null,
        supportEmail: null,
        contactEmail: null,
        linkedinUrl: null,
        twitterUrl: null,
        websiteHttps: null,
        websiteStatus: null,
        websiteSpeedMs: null,
        enrichmentPages: null,
      },
      contentBlocks: [],
      technologies: [],
    };
    const prompt = buildUserPrompt(minimalContext);
    expect(prompt).toContain("Test Co");
    expect(prompt).not.toContain("Domain:");
  });

  it("computes consistent prompt hash", () => {
    const sys = buildSystemPrompt();
    const user = buildUserPrompt(mockContext);
    const hash1 = hashPrompt(sys, user);
    const hash2 = hashPrompt(sys, user);
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(32);
  });

  it("computes different hashes for different content", () => {
    const ctx1 = { ...mockContext };
    const ctx2 = { ...mockContext, company: { ...mockContext.company, description: "Different description" } };
    const hash1 = hashWebsiteContent(ctx1);
    const hash2 = hashWebsiteContent(ctx2);
    expect(hash1).not.toBe(hash2);
  });

  it("includes ICP configuration when provided", () => {
    const prompt = buildUserPrompt(mockContext);
    expect(prompt).toContain("ICP Configuration");
    expect(prompt).toContain("Developer Tools");
    expect(prompt).toContain("North America");
  });
});
