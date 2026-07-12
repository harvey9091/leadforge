import { describe, it, expect } from "vitest";
import { DISCOVERY_SOURCES, getSource, getSources, SOURCE_METADATA } from "@/server/discovery/registry";

describe("discovery source registry", () => {
  it("registers all 6 required sources", () => {
    expect(DISCOVERY_SOURCES.length).toBeGreaterThanOrEqual(6);

    const sourceIds = DISCOVERY_SOURCES.map((s) => s.id);
    expect(sourceIds).toContain("HACKER_NEWS");
    expect(sourceIds).toContain("PRODUCT_HUNT");
    expect(sourceIds).toContain("YC");
    expect(sourceIds).toContain("BETALIST");
    expect(sourceIds).toContain("DEVHUNT");
    expect(sourceIds).toContain("UNEED");
  });

  it("each source has required properties", () => {
    for (const source of DISCOVERY_SOURCES) {
      expect(source.id).toBeTruthy();
      expect(source.label).toBeTruthy();
      expect(source.rateLimitPerSec).toBeGreaterThan(0);
      expect(source.defaultPageSize).toBeGreaterThan(0);
      expect(typeof source.discover).toBe("function");
    }
  });

  it("getSource returns source by ID", () => {
    const hn = getSource("HACKER_NEWS");
    expect(hn).toBeDefined();
    expect(hn?.label).toBe("Hacker News (Show HN)");
  });

  it("getSource returns undefined for unknown ID", () => {
    expect(getSource("UNKNOWN" as never)).toBeUndefined();
  });

  it("getSources returns all sources when no IDs given", () => {
    const sources = getSources([]);
    expect(sources.length).toBe(DISCOVERY_SOURCES.length);
  });

  it("getSources filters by IDs", () => {
    const sources = getSources(["HACKER_NEWS", "PRODUCT_HUNT"]);
    expect(sources.length).toBe(2);
    expect(sources.map((s) => s.id).sort()).toEqual(["HACKER_NEWS", "PRODUCT_HUNT"]);
  });

  it("SOURCE_METADATA has entries for all sources", () => {
    expect(SOURCE_METADATA.length).toBe(DISCOVERY_SOURCES.length);
    for (const meta of SOURCE_METADATA) {
      expect(meta.description).toBeTruthy();
    }
  });
});
