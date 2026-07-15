/**
 * =============================================================================
 * Integration Base Interface
 * =============================================================================
 *
 * Every external service integration must implement this interface.
 * This ensures:
 *  - Consistent API across all integrations
 *  - Easy addition of new services (implement the interface)
 *  - No duplicated code
 *  - Uniform health checking, testing, and configuration
 * =============================================================================
 */

export interface IntegrationHealth {
  status: "connected" | "disconnected" | "error";
  latencyMs?: number;
  version?: string;
  error?: string;
  lastChecked: string;
  lastSuccessAt?: string;
}

export interface IntegrationConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  timeout: number;
  maxRetries: number;
  updatedAt: string;
}

export interface IntegrationTestResult {
  success: boolean;
  latencyMs?: number;
  version?: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface IntegrationCapabilities {
  healthCheck: boolean;
  testConnection: boolean;
  modelsList?: boolean;
  versionEndpoint?: string;
  metrics?: string[];
}

export interface IIntegration {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly capabilities: IntegrationCapabilities;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<IntegrationHealth>;
  test(config?: Partial<IntegrationConfig>): Promise<IntegrationTestResult>;
  validate(config: Partial<IntegrationConfig>): { valid: boolean; errors: string[] };
  saveConfiguration(config: IntegrationConfig): Promise<void>;
  loadConfiguration(): Promise<IntegrationConfig | null>;
  getDefaultConfig(): IntegrationConfig;
}
