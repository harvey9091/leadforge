import { describe, it, expect } from "vitest";
import { findDuplicate, similarity, type ExistingCompany } from "@/server/discovery/dedup";
import type { NormalizedCompany } from "@/server/discovery/types";

function makeNormalized(overrides: Partial<NormalizedCompany> = {}): NormalizedCompany {
  return {
    name: "Linear",
    website: "https://linear.app",
    domain: "linear.app",
    apexDomain: "linear.app",
    description: "Project management",
    tags: ["saas"],
    source: "HACKER_NEWS",
    sourceExternalId: "123",
    ...overrides,
  };
}

function makeExisting(overrides: Partial<ExistingCompany> = {}): ExistingCompany {
  return {
    id: "company-1",
    name: "Linear",
    nameNormalized: "Linear",
    domain: "linear.app",
    apexDomain: "linear.app",
    ...overrides,
  };
}

describe("similarity", () => {
  it("returns 1 for identical strings", () => {
    expect(similarity("hello", "hello")).toBe(1);
  });

  it("returns 0 for empty strings", () => {
    expect(similarity("", "hello")).toBe(0);
  });

  it("returns high similarity for close matches", () => {
    expect(similarity("linear", "linear.app")).toBeGreaterThan(0.5);
  });

  it("returns low similarity for different strings", () => {
    expect(similarity("apple", "microsoft")).toBeLessThan(0.3);
  });
});

describe("findDuplicate", () => {
  it("matches by apex domain (strongest signal)", () => {
    const company = makeNormalized({ apexDomain: "linear.app", domain: "app.linear.app" });
    const existing = [makeExisting({ apexDomain: "linear.app", domain: "linear.app" })];

    const result = findDuplicate(company, existing);

    expect(result.isNew).toBe(false);
    expect(result.existingCompanyId).toBe("company-1");
    expect(result.matchStrategy).toBe("apex_domain");
    expect(result.confidence).toBeGreaterThan(0.95);
  });

  it("matches by full domain when apex differs", () => {
    const company = makeNormalized({ domain: "linear.app", apexDomain: "linear.app" });
    const existing = [makeExisting({ domain: "linear.app", apexDomain: "linear.app" })];

    const result = findDuplicate(company, existing);

    expect(result.isNew).toBe(false);
    expect(result.matchStrategy).toBe("apex_domain");
  });

  it("matches by exact name when domains differ", () => {
    const company = makeNormalized({
      name: "Linear",
      domain: "linear.io",
      apexDomain: "linear.io",
    });
    const existing = [makeExisting({
      name: "Linear",
      nameNormalized: "Linear",
      domain: "linear.app",
      apexDomain: "linear.app",
    })];

    const result = findDuplicate(company, existing);

    expect(result.isNew).toBe(false);
    expect(result.matchStrategy).toBe("name_exact");
  });

  it("matches by fuzzy name when similar but not exact", () => {
    const company = makeNormalized({
      name: "Acme Tools",
      domain: "acme-tools.app",
      apexDomain: "acme-tools.app",
    });
    const existing = [makeExisting({
      name: "Acme Tool",
      nameNormalized: "Acme Tool",
      domain: "acme.app",
      apexDomain: "acme.app",
    })];

    const result = findDuplicate(company, existing);

    expect(result.isNew).toBe(false);
    expect(result.matchStrategy).toBe("name_fuzzy");
  });

  it("returns new when no match", () => {
    const company = makeNormalized({
      name: "Totally Different",
      domain: "different.app",
      apexDomain: "different.app",
    });
    const existing = [makeExisting()];

    const result = findDuplicate(company, existing);

    expect(result.isNew).toBe(true);
    expect(result.matchStrategy).toBe("none");
  });

  it("returns new when existing array is empty", () => {
    const result = findDuplicate(makeNormalized(), []);
    expect(result.isNew).toBe(true);
  });

  it("does not fuzzy-match very different names", () => {
    const company = makeNormalized({
      name: "Microsoft",
      domain: "microsoft.com",
      apexDomain: "microsoft.com",
    });
    const existing = [makeExisting({
      name: "Apple",
      nameNormalized: "Apple",
      domain: "apple.com",
      apexDomain: "apple.com",
    })];

    const result = findDuplicate(company, existing);
    expect(result.isNew).toBe(true);
  });
});
