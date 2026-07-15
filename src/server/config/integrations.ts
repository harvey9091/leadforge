/**
 * =============================================================================
 * Config Service — centralized access to all integrations
 * =============================================================================
 *
 * This is the ONLY place components should read integration configs from.
 * No component should directly read process.env for external service URLs.
 *
 * Usage:
 *  const config = await getIntegrationConfig("firecrawl");
 *  const url = config?.baseUrl;
 * =============================================================================
 */

import { integrationManager } from "@/server/integrations/manager";

export type IntegrationId = "firecrawl" | "freellm" | "redis" | "rabbitmq" | "postgresql" | "searxng" | "chromadb";

export async function getFirecrawl() {
  const integration = integrationManager.get("firecrawl");
  if (!integration) return null;
  return integration.loadConfiguration();
}

export async function getFreeLLM() {
  const integration = integrationManager.get("freellm");
  if (!integration) return null;
  return integration.loadConfiguration();
}

export async function getRedis() {
  const integration = integrationManager.get("redis");
  if (!integration) return null;
  return integration.loadConfiguration();
}

export async function getRabbitMQ() {
  const integration = integrationManager.get("rabbitmq");
  if (!integration) return null;
  return integration.loadConfiguration();
}

export async function getDatabase() {
  const integration = integrationManager.get("postgresql");
  if (!integration) return null;
  return integration.loadConfiguration();
}

export async function getSearXNG() {
  const integration = integrationManager.get("searxng");
  if (!integration) return null;
  return integration.loadConfiguration();
}

export async function getChromaDB() {
  const integration = integrationManager.get("chromadb");
  if (!integration) return null;
  return integration.loadConfiguration();
}

export async function getIntegrationConfig(id: IntegrationId) {
  const integration = integrationManager.get(id);
  if (!integration) return null;
  return integration.loadConfiguration();
}

export async function isIntegrationConfigured(id: IntegrationId): Promise<boolean> {
  const config = await getIntegrationConfig(id);
  return !!(config?.baseUrl && config?.enabled);
}

export async function checkAllIntegrations() {
  return integrationManager.checkAllHealth(true);
}
