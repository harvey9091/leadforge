/**
 * =============================================================================
 * Integrations barrel export
 * =============================================================================
 */

export { FirecrawlIntegration } from "./firecrawl";
export { FreeLLMIntegration } from "./freellm";
export { RedisIntegration } from "./redis";
export { RabbitMQIntegration } from "./rabbitmq";
export { PostgreSQLIntegration } from "./postgres";
export { SearXNGIntegration } from "./searxng";
export { ChromaDBIntegration } from "./chromadb";
export {
  classifyHttpError,
  classifyNetworkError,
  buildDiagnosticError,
} from "./diagnostics";
export type {
  IIntegration,
  IntegrationHealth,
  IntegrationConfig,
  IntegrationTestResult,
  IntegrationCapabilities,
  DiscoveredModel,
} from "./base";
