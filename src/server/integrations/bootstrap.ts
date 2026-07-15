/**
 * =============================================================================
 * Integration Bootstrap — register all integrations on app startup
 * =============================================================================
 *
 * Import this file once at app startup to register all integrations
 * with the Integration Manager.
 * =============================================================================
 */

import { integrationManager } from "@/server/integrations/manager";
import { FirecrawlIntegration } from "@/server/integrations/firecrawl";
import { FreeLLMIntegration } from "@/server/integrations/freellm";
import { RedisIntegration } from "@/server/integrations/redis";
import { RabbitMQIntegration } from "@/server/integrations/rabbitmq";
import { PostgreSQLIntegration } from "@/server/integrations/postgres";
import { SearXNGIntegration } from "@/server/integrations/searxng";
import { ChromaDBIntegration } from "@/server/integrations/chromadb";

export function registerAllIntegrations(): void {
  integrationManager.register(FirecrawlIntegration);
  integrationManager.register(FreeLLMIntegration);
  integrationManager.register(RedisIntegration);
  integrationManager.register(RabbitMQIntegration);
  integrationManager.register(PostgreSQLIntegration);
  integrationManager.register(SearXNGIntegration);
  integrationManager.register(ChromaDBIntegration);
}
