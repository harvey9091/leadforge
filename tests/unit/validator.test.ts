import { describe, it, expect } from "vitest";
import { validate } from "@/server/discovery/validator";
import { normalize } from "@/server/discovery/normalizer";
import type { RawCompany } from "@/server/discovery/types";
function makeRaw(overrides: Partial<RawCompany> = {}): RawCompany {
  return {
    externalId: "test-1",
    source: "HACKER_NEWS",
    name: "Test Company",
    website: "https://example.com",
    description: "A test company that does testing.",
    ...overrides,
  };
}

describe("validator", () => {
  it("accepts a valid company", () => {
    const result = validate(normalize(makeRaw()));
    expect(result.valid).toBe(true);
  });

  it("rejects missing name", () => {
    const result = validate(normalize(makeRaw({ name: "" })));
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("incomplete");
  });

  it("rejects name too short", () => {
    const result = validate(normalize(makeRaw({ name: "A" })));
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("incomplete");
  });

  it("rejects missing domain", () => {
    const result = validate(normalize(makeRaw({ website: undefined })));
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("incomplete");
  });

  it("rejects blocked TLD", () => {
    const result = validate(normalize(makeRaw({ website: "https://example.tk" })));
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("blocked_tld");
  });

  it("rejects malformed domain", () => {
    const result = validate(normalize(makeRaw({ website: "not-a-url" })));
    // "not-a-url" becomes "not-a-url" which passes domain regex check but might fail TLD
    // Let's use something that clearly fails
    expect(result.valid).toBe(false);
  });

  it("rejects spam-like names (all caps, long)", () => {
    const result = validate(normalize(makeRaw({ name: "BUY NOW CLICK HERE FOR FREE MONEY!!!" })));
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe("spam");
  });

  it("accepts company with just name+domain (Show HN-style)", () => {
    const result = validate(normalize(makeRaw({
      description: "short",
      country: undefined,
      industry: undefined,
      foundedYear: undefined,
      tags: [],
    })));
    expect(result.valid).toBe(true);
  });

  it("accepts company with description as useful data", () => {
    const result = validate(normalize(makeRaw({
      description: "A sufficiently long description to pass validation.",
    })));
    expect(result.valid).toBe(true);
  });

  it("accepts company with tags as useful data", () => {
    const result = validate(normalize(makeRaw({
      description: "short",
      tags: ["saas", "ai"],
    })));
    expect(result.valid).toBe(true);
  });
});
