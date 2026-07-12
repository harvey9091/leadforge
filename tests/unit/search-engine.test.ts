import { describe, it, expect } from "vitest";
import { parseQuery } from "@/server/workspace/search-engine";

describe("search engine query parser", () => {
  it("parses simple terms", () => {
    const result = parseQuery("linear saas");
    expect(result.terms).toContain("linear");
    expect(result.terms).toContain("saas");
  });

  it("parses quoted phrases", () => {
    const result = parseQuery('"project management tool"');
    expect(result.phrases).toContain("project management tool");
  });

  it("parses exclusions with minus", () => {
    const result = parseQuery("ai -healthcare");
    expect(result.terms).toContain("ai");
    expect(result.exclusions).toContain("healthcare");
  });

  it("parses field-specific filters", () => {
    const result = parseQuery("industry:AI country:US");
    expect(result.fieldFilters.length).toBe(2);
    expect(result.fieldFilters[0]).toEqual({ field: "industry", value: "ai" });
    expect(result.fieldFilters[1]).toEqual({ field: "country", value: "us" });
  });

  it("parses boolean operators", () => {
    const result = parseQuery("ai AND saas OR enterprise NOT free");
    expect(result.terms).toContain("ai");
    expect(result.terms).toContain("saas");
    expect(result.terms).toContain("enterprise");
    expect(result.exclusions).toContain("free");
  });

  it("handles mixed queries", () => {
    const result = parseQuery('"developer tools" industry:saas -wordpress');
    expect(result.phrases).toContain("developer tools");
    expect(result.fieldFilters).toContainEqual({ field: "industry", value: "saas" });
    expect(result.exclusions).toContain("wordpress");
  });

  it("handles empty query", () => {
    const result = parseQuery("");
    expect(result.terms).toHaveLength(0);
    expect(result.phrases).toHaveLength(0);
    expect(result.exclusions).toHaveLength(0);
  });

  it("lowercases all terms", () => {
    const result = parseQuery("LINEAR SaaS");
    expect(result.terms.every((t) => t === t.toLowerCase())).toBe(true);
  });
});
