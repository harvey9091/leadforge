/**
 * =============================================================================
 * Integration Manager — Unit Tests
 * =============================================================================
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { IntegrationManager } from "@/server/integrations/manager";
import type { IIntegration, IntegrationHealth, IntegrationConfig } from "@/server/integrations/base";

const createMockIntegration = (overrides: Partial<IIntegration> = {}): IIntegration => ({
  id: "test-service",
  name: "Test Service",
  description: "A test integration",
  capabilities: { healthCheck: true, testConnection: true },
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  healthCheck: vi.fn().mockResolvedValue({
    status: "connected",
    latencyMs: 50,
    lastChecked: new Date().toISOString(),
  } as IntegrationHealth),
  test: vi.fn().mockResolvedValue({ success: true, latencyMs: 50 } as import("@/server/integrations/base").IntegrationTestResult),
  validate: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  saveConfiguration: vi.fn().mockResolvedValue(undefined),
  loadConfiguration: vi.fn().mockResolvedValue({
    id: "test-service",
    name: "Test Service",
    description: "A test integration",
    icon: "test",
    baseUrl: "https://test.example.com",
    apiKey: "test-key",
    enabled: true,
    timeout: 5000,
    maxRetries: 2,
    updatedAt: new Date().toISOString(),
  } as IntegrationConfig),
  getDefaultConfig: vi.fn().mockReturnValue({
    id: "test-service",
    name: "Test Service",
    description: "A test integration",
    icon: "test",
    baseUrl: "",
    apiKey: "",
    enabled: false,
    timeout: 5000,
    maxRetries: 2,
    updatedAt: new Date().toISOString(),
  } as IntegrationConfig),
  ...overrides,
});

describe("IntegrationManager", () => {
  let manager: IntegrationManager;

  beforeEach(() => {
    manager = new IntegrationManager();
  });

  it("registers integrations", () => {
    const integration = createMockIntegration();
    manager.register(integration);
    expect(manager.get("test-service")).toBe(integration);
    expect(manager.getAll()).toHaveLength(1);
  });

  it("returns undefined for unknown integration", () => {
    expect(manager.get("unknown")).toBeUndefined();
  });

  it("checks health for a registered integration", async () => {
    const integration = createMockIntegration();
    manager.register(integration);

    const health = await manager.checkHealth("test-service", true);
    expect(health.status).toBe("connected");
    expect(health.latencyMs).toBe(50);
  });

  it("returns error for unknown integration health check", async () => {
    const health = await manager.checkHealth("unknown", true);
    expect(health.status).toBe("error");
    expect(health.error).toContain("Unknown integration");
  });

  it("tests connection for a registered integration", async () => {
    const integration = createMockIntegration();
    manager.register(integration);

    const result = await manager.testConnection("test-service");
    expect(result.success).toBe(true);
    expect(result.latencyMs).toBe(50);
  });

  it("validates all integrations", async () => {
    const validIntegration = createMockIntegration({
      id: "valid",
      validate: vi.fn().mockReturnValue({ valid: true, errors: [] }),
    });
    const invalidIntegration = createMockIntegration({
      id: "invalid",
      validate: vi.fn().mockReturnValue({ valid: false, errors: ["missing URL"] }),
    });

    manager.register(validIntegration);
    manager.register(invalidIntegration);

    const results = await manager.validateAll();
    const validResult = results.find((r) => r.id === "valid");
    const invalidResult = results.find((r) => r.id === "invalid");

    expect(validResult?.valid).toBe(true);
    expect(invalidResult?.valid).toBe(false);
    expect(invalidResult?.errors).toContain("missing URL");
  });

  it("caches health results", async () => {
    const integration = createMockIntegration();
    const healthSpy = vi.spyOn(integration, "healthCheck");
    manager.register(integration);

    await manager.checkHealth("test-service", true);
    await manager.checkHealth("test-service", false); // Should use cache

    expect(healthSpy).toHaveBeenCalledTimes(1);
  });

  it("clears health cache", async () => {
    const integration = createMockIntegration();
    const healthSpy = vi.spyOn(integration, "healthCheck");
    manager.register(integration);

    await manager.checkHealth("test-service", true);
    manager.clearCache();
    await manager.checkHealth("test-service", true);

    expect(healthSpy).toHaveBeenCalledTimes(2);
  });

  it("saves configuration for a registered integration", async () => {
    const integration = createMockIntegration();
    const saveSpy = vi.spyOn(integration, "saveConfiguration");
    manager.register(integration);

    const config = integration.getDefaultConfig();
    await manager.saveConfiguration("test-service", { ...config, baseUrl: "https://new.example.com" });

    expect(saveSpy).toHaveBeenCalled();
  });

  it("throws for unknown integration on save", async () => {
    await expect(manager.saveConfiguration("unknown", {} as IntegrationConfig)).rejects.toThrow();
  });

  it("discovers models for integrations that support it", async () => {
    const integration = createMockIntegration({
      discoverModels: vi.fn().mockResolvedValue([
        { id: "gpt-4", label: "GPT-4", isDefault: false },
        { id: "auto", label: "Auto (server default)", isDefault: true },
      ]),
    });
    manager.register(integration);

    const models = await manager.discoverModels("test-service");
    expect(models).toHaveLength(2);
    expect(models[0].id).toBe("gpt-4");
    expect(models[1].id).toBe("auto");
  });

  it("returns empty array for integrations without discoverModels", async () => {
    const integration = createMockIntegration();
    manager.register(integration);

    const models = await manager.discoverModels("test-service");
    expect(models).toEqual([]);
  });

  it("returns empty array for unknown integration on discoverModels", async () => {
    const models = await manager.discoverModels("unknown");
    expect(models).toEqual([]);
  });

  it("returns empty array when discoverModels throws", async () => {
    const integration = createMockIntegration({
      discoverModels: vi.fn().mockRejectedValue(new Error("Model discovery failed")),
    });
    manager.register(integration);

    const models = await manager.discoverModels("test-service");
    expect(models).toEqual([]);
  });
});
