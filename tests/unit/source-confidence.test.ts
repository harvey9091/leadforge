import { describe, it, expect } from "vitest";
import { getSourceConfidence, calculateCompanyConfidence, SOURCE_CONFIDENCE } from "@/server/discovery/source-confidence";

describe("source confidence", () => {
  it("has confidence values for all sources", () => {
    expect(SOURCE_CONFIDENCE.YC).toBe(98);
    expect(SOURCE_CONFIDENCE.PRODUCT_HUNT).toBe(90);
    expect(SOURCE_CONFIDENCE.HACKER_NEWS).toBe(84);
    expect(SOURCE_CONFIDENCE.BETALIST).toBe(72);
  });

  it("YC has highest confidence", () => {
    expect(getSourceConfidence("YC")).toBeGreaterThan(getSourceConfidence("PRODUCT_HUNT"));
    expect(getSourceConfidence("PRODUCT_HUNT")).toBeGreaterThan(getSourceConfidence("HACKER_NEWS"));
    expect(getSourceConfidence("HACKER_NEWS")).toBeGreaterThan(getSourceConfidence("BETALIST"));
  });

  it("returns 50 for unknown sources", () => {
    expect(getSourceConfidence("UNKNOWN_SOURCE")).toBe(50);
  });

  it("calculates company confidence from single source", () => {
    const confidence = calculateCompanyConfidence([{ type: "YC" }]);
    expect(confidence).toBe(98);
  });

  it("increases confidence with multiple sources", () => {
    const single = calculateCompanyConfidence([{ type: "YC" }]);
    const multi = calculateCompanyConfidence([
      { type: "YC" },
      { type: "PRODUCT_HUNT" },
    ]);
    expect(multi).toBeGreaterThan(single);
  });

  it("caps confidence at 100", () => {
    const confidence = calculateCompanyConfidence([
      { type: "YC" },
      { type: "PRODUCT_HUNT" },
      { type: "HACKER_NEWS" },
      { type: "BETALIST" },
      { type: "DEVHUNT" },
      { type: "UNEED" },
    ]);
    expect(confidence).toBeLessThanOrEqual(100);
  });

  it("returns 0 for no sources", () => {
    expect(calculateCompanyConfidence([])).toBe(0);
  });

  it("uses highest source as base", () => {
    const confidence = calculateCompanyConfidence([
      { type: "BETALIST" },
      { type: "YC" },
      { type: "HACKER_NEWS" },
    ]);
    // base is YC (98) + 2 bonus sources * 5 = 108, capped at 100
    expect(confidence).toBe(100);
  });
});
