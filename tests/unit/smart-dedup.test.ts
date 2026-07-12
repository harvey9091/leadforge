import { describe, it, expect } from "vitest";
import { findDuplicateSmart } from "@/server/optimization/smart-dedup";
import type { NormalizedCompany } from "@/server/discovery/types";
import type { ExistingCompany } from "@/server/discovery/dedup";

function makeCompany(overrides: Partial<NormalizedCompany> = {}): NormalizedCompany {
  return {
    name: "Acme",
    website: "https://acme.com",
    domain: "acme.com",
    apexDomain: "acme.com",
    description: "A SaaS company",
    tags: [],
    source: "HACKER_NEWS",
    sourceExternalId: "123",
    ...overrides,
  };
}

function makeExisting(overrides: Partial<ExistingCompany> = {}): ExistingCompany {
  return {
    id: "company-1",
    name: "Acme",
    nameNormalized: "Acme",
    domain: "acme.com",
    apexDomain: "acme.com",
    ...overrides,
  };
}

describe("smart deduplication", () => {
  it("matches by apex domain", async () => {
    const company = makeCompany({ apexDomain: "acme.com", domain: "app.acme.com" });
    const existing = [makeExisting({ apexDomain: "acme.com", domain: "acme.com" })];

    const result = await findDuplicateSmart(company, existing);

    expect(result.isNew).toBe(false);
    expect(result.matchStrategy).toBe("apex_domain");
    expect(result.confidence).toBeGreaterThan(0.95);
  });

  it("matches by fuzzy domain (same core, different TLD)", async () => {
    const company = makeCompany({ apexDomain: "acme.io", domain: "acme.io" });
    const existing = [makeExisting({ apexDomain: "acme.com", domain: "acme.com" })];

    const result = await findDuplicateSmart(company, existing);

    expect(result.isNew).toBe(false);
    expect(result.matchStrategy).toBe("fuzzy_domain");
    expect(result.confidence).toBeGreaterThan(0.85);
  });

  it("matches by exact name when domains differ significantly", async () => {
    const company = makeCompany({ name: "Acme", domain: "acme.io", apexDomain: "acme.io" });
    const existing = [makeExisting({ name: "Acme", nameNormalized: "Acme", domain: "verydifferent.com", apexDomain: "verydifferent.com" })];

    const result = await findDuplicateSmart(company, existing);

    expect(result.isNew).toBe(false);
    expect(result.matchStrategy).toBe("name_exact");
  });

  it("does not fuzzy-match very different domains", async () => {
    const company = makeCompany({ name: "Linear", domain: "linear.app", apexDomain: "linear.app" });
    const existing = [makeExisting({ name: "Apple", nameNormalized: "Apple", domain: "apple.com", apexDomain: "apple.com" })];

    const result = await findDuplicateSmart(company, existing);

    expect(result.isNew).toBe(true);
  });

  it("matches hyphenated domain variants", async () => {
    const company = makeCompany({ apexDomain: "acme-inc.com", domain: "acme-inc.com" });
    const existing = [makeExisting({ apexDomain: "acmeinc.com", domain: "acmeinc.com" })];

    const result = await findDuplicateSmart(company, existing);

    expect(result.isNew).toBe(false);
    expect(result.matchStrategy).toBe("fuzzy_domain");
    expect(result.confidence).toBeGreaterThan(0.85);
  });
});
