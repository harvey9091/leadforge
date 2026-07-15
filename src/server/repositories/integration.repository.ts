/**
 * =============================================================================
 * Integration Repository — database persistence for integration configs
 * =============================================================================
 *
 * Stores integration configurations in a single key-value table.
 * API keys are stored encrypted via AES-256-GCM.
 * =============================================================================
 */

import { db } from "@/lib/db";
import { encryptApiKey, decryptApiKey } from "@/server/ai/freellm-settings";

export interface IntegrationRow {
  id: string;
  baseUrl: string;
  apiKeyEnc: string;
  enabled: boolean;
  timeout: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

export async function loadIntegrationConfig(id: string): Promise<IntegrationRow | null> {
  try {
    const row = await db.integrationConfig.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      baseUrl: row.baseUrl,
      apiKeyEnc: row.apiKeyEnc,
      enabled: row.enabled,
      timeout: row.timeout,
      maxRetries: row.maxRetries,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  } catch {
    return null;
  }
}

export async function saveIntegrationConfig(
  id: string,
  data: {
    baseUrl: string;
    apiKey: string;
    enabled: boolean;
    timeout: number;
    maxRetries: number;
  }
): Promise<void> {
  const encryptedKey = data.apiKey ? encryptApiKey(data.apiKey) : "";

  await db.integrationConfig.upsert({
    where: { id },
    create: {
      id,
      baseUrl: data.baseUrl.trim(),
      apiKeyEnc: encryptedKey,
      enabled: data.enabled,
      timeout: data.timeout,
      maxRetries: data.maxRetries,
    },
    update: {
      baseUrl: data.baseUrl.trim(),
      apiKeyEnc: encryptedKey || undefined,
      enabled: data.enabled,
      timeout: data.timeout,
      maxRetries: data.maxRetries,
    },
  });
}

export async function deleteIntegrationConfig(id: string): Promise<void> {
  try {
    await db.integrationConfig.delete({ where: { id } }).catch(() => {});
  } catch {
    // ignore if table doesn't exist
  }
}

export async function listAllIntegrationConfigs(): Promise<IntegrationRow[]> {
  try {
    const rows = await db.integrationConfig.findMany();
    return rows.map((row) => ({
      id: row.id,
      baseUrl: row.baseUrl,
      apiKeyEnc: row.apiKeyEnc,
      enabled: row.enabled,
      timeout: row.timeout,
      maxRetries: row.maxRetries,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  } catch {
    return [];
  }
}
