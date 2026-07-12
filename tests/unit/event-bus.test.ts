import { describe, it, expect } from "vitest";
import { eventBus } from "@/server/events/event-bus";

describe("event bus", () => {
  it("calls registered handler when event is emitted", async () => {
    let received: unknown = null;
    eventBus.on("CompanyDiscovered", (payload) => {
      received = payload;
    });

    await eventBus.emit("CompanyDiscovered", {
      companyId: "test-1",
      source: "HACKER_NEWS",
      name: "Test Co",
      confidence: 84,
      timestamp: new Date(),
    });

    expect(received).not.toBeNull();
    expect((received as { companyId: string }).companyId).toBe("test-1");
    eventBus.clear();
  });

  it("supports multiple handlers for same event", async () => {
    let count = 0;
    eventBus.on("CompanyDiscovered", () => { count++; });
    eventBus.on("CompanyDiscovered", () => { count++; });

    await eventBus.emit("CompanyDiscovered", {
      companyId: "test-2",
      source: "YC",
      name: "Test Co 2",
      confidence: 98,
      timestamp: new Date(),
    });

    expect(count).toBe(2);
    eventBus.clear();
  });

  it("supports async handlers", async () => {
    let result = "";
    eventBus.on("DiscoveryCompleted", async (payload) => {
      await new Promise((r) => setTimeout(r, 10));
      result = `Completed with ${payload.stored} companies`;
    });

    await eventBus.emit("DiscoveryCompleted", {
      jobId: "job-1",
      found: 10,
      stored: 8,
      duplicates: 2,
      errors: 0,
      durationMs: 5000,
      timestamp: new Date(),
    });

    expect(result).toBe("Completed with 8 companies");
    eventBus.clear();
  });

  it("returns unsubscribe function", async () => {
    let count = 0;
    const unsub = eventBus.on("CompanyMerged", () => { count++; });

    await eventBus.emit("CompanyMerged", {
      companyId: "c1",
      duplicateName: "Dup",
      matchStrategy: "domain",
      similarity: 0.95,
      timestamp: new Date(),
    });
    expect(count).toBe(1);

    unsub();
    await eventBus.emit("CompanyMerged", {
      companyId: "c1",
      duplicateName: "Dup",
      matchStrategy: "domain",
      similarity: 0.95,
      timestamp: new Date(),
    });
    expect(count).toBe(1); // still 1 — handler was removed
    eventBus.clear();
  });

  it("does not crash when no handlers registered", async () => {
    await eventBus.emit("DiscoveryFailed", {
      jobId: "job-x",
      error: "test",
      timestamp: new Date(),
    });
    // should not throw
  });

  it("isolates handler errors", async () => {
    let secondCalled = false;
    eventBus.on("CompanyDiscovered", () => {
      throw new Error("handler error");
    });
    eventBus.on("CompanyDiscovered", () => {
      secondCalled = true;
    });

    await eventBus.emit("CompanyDiscovered", {
      companyId: "test",
      source: "YC",
      name: "Test",
      confidence: 100,
      timestamp: new Date(),
    });

    expect(secondCalled).toBe(true);
    eventBus.clear();
  });

  it("tracks registered handler count", () => {
    eventBus.clear();
    eventBus.on("CompanyDiscovered", () => {});
    eventBus.on("CompanyDiscovered", () => {});
    eventBus.on("DiscoveryCompleted", () => {});

    expect(eventBus.handlerCount("CompanyDiscovered")).toBe(2);
    expect(eventBus.handlerCount("DiscoveryCompleted")).toBe(1);
    expect(eventBus.handlerCount("EnrichmentFailed")).toBe(0);
    eventBus.clear();
  });
});
