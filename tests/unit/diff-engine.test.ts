import { describe, it, expect } from "vitest";
import { compareSnapshots } from "@/server/signals/diff-engine";

describe("diff engine", () => {
  it("detects no changes when data is identical", () => {
    const data = JSON.stringify({ name: "Acme", industry: "SaaS", pricingModel: "Freemium" });
    const changes = compareSnapshots(data, data);
    expect(changes).toHaveLength(0);
  });

  it("detects modified fields", () => {
    const old = JSON.stringify({ name: "Acme", industry: "SaaS", pricingModel: "Freemium" });
    const new_ = JSON.stringify({ name: "Acme", industry: "AI", pricingModel: "Enterprise" });
    const changes = compareSnapshots(old, new_);
    expect(changes).toHaveLength(2);
    expect(changes.find((c) => c.field === "industry")).toBeDefined();
    expect(changes.find((c) => c.field === "pricingModel")).toBeDefined();
  });

  it("detects added fields", () => {
    const old = JSON.stringify({ name: "Acme" });
    const new_ = JSON.stringify({ name: "Acme", industry: "SaaS" });
    const changes = compareSnapshots(old, new_);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.field).toBe("industry");
    expect(changes[0]!.changeType).toBe("added");
  });

  it("detects removed fields", () => {
    const old = JSON.stringify({ name: "Acme", industry: "SaaS" });
    const new_ = JSON.stringify({ name: "Acme" });
    const changes = compareSnapshots(old, new_);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.field).toBe("industry");
    expect(changes[0]!.changeType).toBe("removed");
  });

  it("ignores capturedAt field", () => {
    const old = JSON.stringify({ name: "Acme", capturedAt: "2024-01-01" });
    const new_ = JSON.stringify({ name: "Acme", capturedAt: "2024-02-01" });
    const changes = compareSnapshots(old, new_);
    expect(changes).toHaveLength(0);
  });

  it("handles multiple changes", () => {
    const old = JSON.stringify({ name: "Acme", industry: "SaaS", pricing: "Free", employees: 10 });
    const new_ = JSON.stringify({ name: "Acme Inc", industry: "AI", pricing: "Paid", employees: 50 });
    const changes = compareSnapshots(old, new_);
    expect(changes).toHaveLength(4);
  });
});
