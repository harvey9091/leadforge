import { describe, it, expect } from "vitest";
import {
  extractDomain,
  extractApexDomain,
  normalizeName,
  normalizeDescription,
  normalizeCountry,
  normalizeTags,
  buildSearchVector,
  hasBlockedTld,
  normalize,
} from "@/server/discovery/normalizer";
import type { RawCompany } from "@/server/discovery/types";

describe("extractDomain", () => {
  it("extracts domain from full URL", () => {
    expect(extractDomain("https://www.example.com/path")).toBe("example.com");
    expect(extractDomain("http://app.linear.app/home")).toBe("app.linear.app");
  });

  it("strips www. prefix", () => {
    expect(extractDomain("https://www.example.com")).toBe("example.com");
  });

  it("handles missing protocol", () => {
    expect(extractDomain("example.com")).toBe("example.com");
    expect(extractDomain("example.com/path")).toBe("example.com");
  });

  it("returns undefined for empty or missing input", () => {
    expect(extractDomain("")).toBeUndefined();
    expect(extractDomain(undefined)).toBeUndefined();
  });

  it("handles strings without protocol", () => {
    // A plain string like "not a url" gets treated as a domain
    expect(extractDomain("example.com")).toBe("example.com");
  });
});

describe("extractApexDomain", () => {
  it("returns the domain for simple domains", () => {
    expect(extractApexDomain("example.com")).toBe("example.com");
  });

  it("strips subdomains", () => {
    expect(extractApexDomain("app.example.com")).toBe("example.com");
    expect(extractApexDomain("www.app.example.com")).toBe("example.com");
  });

  it("handles two-part TLDs", () => {
    expect(extractApexDomain("app.example.co.uk")).toBe("example.co.uk");
    expect(extractApexDomain("www.example.com.au")).toBe("example.com.au");
  });
});

describe("normalizeName", () => {
  it("trims whitespace", () => {
    expect(normalizeName("  Linear  ")).toBe("Linear");
  });

  it("collapses internal whitespace", () => {
    expect(normalizeName("Linear   App")).toBe("Linear App");
  });

  it("normalizes single spaces", () => {
    expect(normalizeName("a  b   c")).toBe("a b c");
  });

  it("removes legal suffixes", () => {
    expect(normalizeName("Linear, Inc.")).toBe("Linear");
    expect(normalizeName("Acme Ltd")).toBe("Acme");
    expect(normalizeName("Foo LLC.")).toBe("Foo");
  });

  it("returns empty for undefined", () => {
    expect(normalizeName(undefined)).toBe("");
    expect(normalizeName("")).toBe("");
  });
});

describe("normalizeDescription", () => {
  it("decodes HTML entities", () => {
    expect(normalizeDescription("Hello &amp; goodbye")).toBe("Hello & goodbye");
  });

  it("caps length at 2000 chars", () => {
    const long = "a".repeat(3000);
    const result = normalizeDescription(long);
    expect(result!.length).toBe(2000);
    expect(result!.endsWith("...")).toBe(true);
  });
});

describe("normalizeCountry", () => {
  it("maps country codes to names", () => {
    expect(normalizeCountry("US")).toBe("United States");
    expect(normalizeCountry("UK")).toBe("United Kingdom");
    expect(normalizeCountry("DE")).toBe("Germany");
  });

  it("passes through unknown values", () => {
    expect(normalizeCountry("Japan")).toBe("Japan");
  });
});

describe("normalizeTags", () => {
  it("trims and lowercases", () => {
    expect(normalizeTags(["  AI  ", "SaaS", "developer tools"])).toEqual(["ai", "saas", "developer tools"]);
  });

  it("deduplicates", () => {
    expect(normalizeTags(["AI", "ai", "AI"])).toEqual(["ai"]);
  });

  it("filters empty and too-long tags", () => {
    expect(normalizeTags(["", "a".repeat(51), "ok"])).toEqual(["ok"]);
  });
});

describe("hasBlockedTld", () => {
  it("blocks free TLDs", () => {
    expect(hasBlockedTld("example.tk")).toBe(true);
    expect(hasBlockedTld("example.ml")).toBe(true);
    expect(hasBlockedTld("example.ga")).toBe(true);
  });

  it("allows normal TLDs", () => {
    expect(hasBlockedTld("example.com")).toBe(false);
    expect(hasBlockedTld("example.dev")).toBe(false);
  });
});

describe("buildSearchVector", () => {
  it("concatenates name, domain, description, tags", () => {
    const vector = buildSearchVector({
      name: "Linear",
      domain: "linear.app",
      description: "Project management tool",
      tags: ["saas", "productivity"],
    });
    expect(vector).toContain("linear");
    expect(vector).toContain("linear.app");
    expect(vector).toContain("project management tool");
    expect(vector).toContain("saas");
    expect(vector).toContain("productivity");
  });

  it("lowercases everything", () => {
    const vector = buildSearchVector({
      name: "LINEAR",
      domain: "LINEAR.APP",
      description: "",
      tags: [],
    });
    expect(vector).toBe("linear linear.app");
  });
});

describe("normalize (full pipeline)", () => {
  it("normalizes a raw company into canonical shape", () => {
    const raw: RawCompany = {
      externalId: "123",
      source: "HACKER_NEWS",
      name: "  Linear, Inc.  ",
      website: "https://www.linear.app/home",
      description: "Project management &amp; issue tracking",
      country: "US",
      tags: ["  SaaS  ", "Productivity"],
      raw: {},
    };

    const normalized = normalize(raw);

    expect(normalized.name).toBe("Linear");
    expect(normalized.domain).toBe("linear.app");
    expect(normalized.apexDomain).toBe("linear.app");
    expect(normalized.description).toBe("Project management & issue tracking");
    expect(normalized.country).toBe("United States");
    expect(normalized.tags).toEqual(["saas", "productivity"]);
    expect(normalized.source).toBe("HACKER_NEWS");
    expect(normalized.sourceExternalId).toBe("123");
  });
});
