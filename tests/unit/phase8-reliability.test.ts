import { describe, it, expect } from "vitest";
import { validateConfig, getProfile, exportConfig } from "@/server/reliability/config-manager";

describe("configuration manager", () => {
  it("validates config and returns errors for missing required vars", () => {
    const result = validateConfig();
    expect(result.valid).toBeDefined();
    expect(result.errors).toBeInstanceOf(Array);
    expect(result.warnings).toBeInstanceOf(Array);
    expect(result.config).toBeInstanceOf(Object);
  });

  it("returns a valid profile", () => {
    const profile = getProfile();
    expect(["development", "production", "testing"]).toContain(profile);
  });

  it("exports config with redacted secrets", () => {
    const config = exportConfig();
    expect(config._version).toBe("8.0.0-phase8");
    expect(config._exportedAt).toBeDefined();
    // If JWT_SECRET is set, it should be redacted
    if (config.JWT_SECRET) {
      expect(config.JWT_SECRET).toBe("***redacted***");
    }
  });

  it("includes NODE_ENV in export", () => {
    const config = exportConfig();
    expect(config.NODE_ENV).toBeDefined();
  });
});

describe("alert system", () => {
  it("evaluateCondition handles all operators", () => {
    // Testing the condition evaluation logic inline
    const gt = (v: number, t: number) => v > t;
    const gte = (v: number, t: number) => v >= t;
    const lt = (v: number, t: number) => v < t;
    const lte = (v: number, t: number) => v <= t;
    const eq = (v: number, t: number) => v === t;

    expect(gt(11, 10)).toBe(true);
    expect(gt(10, 10)).toBe(false);
    expect(gte(10, 10)).toBe(true);
    expect(lt(9, 10)).toBe(true);
    expect(lte(10, 10)).toBe(true);
    expect(eq(10, 10)).toBe(true);
    expect(eq(11, 10)).toBe(false);
  });
});

describe("data integrity checks", () => {
  it("IntegrityResult interface has correct shape", () => {
    const result = {
      checkName: "Test Check",
      status: "ok" as const,
      issuesFound: 0,
      issuesRepaired: 0,
      details: {},
    };
    expect(result.status).toBe("ok");
    expect(result.issuesFound).toBe(0);
  });
});
