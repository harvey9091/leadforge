/**
 * =============================================================================
 * FreeLLM Settings — encrypted persistence for FreeLLM configuration
 * =============================================================================
 *
 * Stores FreeLLM config in the database with the API key encrypted via
 * AES-256-GCM. The encryption key is derived from SETTINGS_ENCRYPTION_KEY
 * env var (must be 32 bytes / 64 hex chars).
 *
 * Config loading precedence:
 *  1. Integration Manager (integration_configs table) — primary
 *  2. Legacy FreeLLMConfig table — fallback for backward compatibility
 *  3. Environment variables — last resort fallback
 * =============================================================================
 */

import { logger } from "@/server/utils/logger";
import { db } from "@/lib/db";
import { FreeLLMConfig } from "@prisma/client";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { integrationManager } from "@/server/integrations/manager";
import { env } from "@/server/config/env";

let _cachedConfig: { baseUrl: string; apiKey: string; model: string; temperature: number; maxTokens: number; timeout: number; streaming: boolean } | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000;

function getEncryptionKey(): Buffer {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY ?? "";
  const key = raw.replace(/[^a-fA-F0-9]/g, "");
  if (key.length >= 64) {
    return Buffer.from(key.slice(0, 64), "hex");
  }
  const padded = raw.padEnd(32, "0").slice(0, 32);
  return Buffer.from(padded, "utf-8");
}

export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}:${tag.toString("base64url")}:${ciphertext.toString("base64url")}`;
}

export function decryptApiKey(encrypted: string): string {
  try {
    const key = getEncryptionKey();
    const [ivB64, tagB64, cipherB64] = encrypted.split(":");
    if (!ivB64 || !tagB64 || !cipherB64) throw new Error("Malformed encrypted key");
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const ciphertext = Buffer.from(cipherB64, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf-8");
  } catch {
    return "";
  }
}

async function loadFromIntegrationManager(): Promise<{
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  streaming: boolean;
} | null> {
  try {
    const integration = integrationManager.get("freellm");
    if (!integration) return null;
    const config = await integration.loadConfiguration();
    if (!config || (!config.baseUrl && !config.apiKey)) return null;
    return {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: "auto",
      temperature: 0.3,
      maxTokens: 4000,
      timeout: config.timeout,
      streaming: false,
    };
  } catch {
    return null;
  }
}

async function loadFromLegacyTable(): Promise<{
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  streaming: boolean;
} | null> {
  try {
    const row = await db.freeLLMConfig.findUnique({ where: { id: "singleton" } });
    if (row && (row.baseUrl || row.apiKeyEnc)) {
      return {
        baseUrl: row.baseUrl,
        apiKey: decryptApiKey(row.apiKeyEnc),
        model: row.model,
        temperature: row.temperature,
        maxTokens: row.maxTokens,
        timeout: row.timeout,
        streaming: row.streaming,
      };
    }
  } catch {
    // table may not exist yet during first migration
  }
  return null;
}

export async function loadFreeLLMConfig(): Promise<{
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  streaming: boolean;
}> {
  const now = Date.now();
  if (_cachedConfig && now - _cacheTimestamp < CACHE_TTL_MS) {
    return _cachedConfig;
  }

  // Priority: Integration Manager > legacy table > env vars
  const fromManager = await loadFromIntegrationManager();
  if (fromManager) {
    _cachedConfig = fromManager;
    _cacheTimestamp = now;
    return _cachedConfig;
  }

  const fromLegacy = await loadFromLegacyTable();
  if (fromLegacy) {
    _cachedConfig = fromLegacy;
    _cacheTimestamp = now;
    return _cachedConfig;
  }

  _cachedConfig = {
    baseUrl: env.freellm.baseUrl,
    apiKey: env.freellm.apiKey,
    model: env.freellm.model,
    temperature: parseFloat(env.freellm.baseUrl ? "0.3" : "0.3"),
    maxTokens: 4000,
    timeout: 60000,
    streaming: false,
  };
  _cacheTimestamp = now;
  return _cachedConfig;
}

export async function saveFreeLLMConfig(data: {
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  streaming: boolean;
}): Promise<void> {
  _cachedConfig = null;
  _cacheTimestamp = 0;

  const encryptedKey = data.apiKey ? encryptApiKey(data.apiKey) : "";

  await db.freeLLMConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      baseUrl: data.baseUrl.trim(),
      apiKeyEnc: encryptedKey,
      model: data.model.trim() || "auto",
      temperature: data.temperature,
      maxTokens: data.maxTokens,
      timeout: data.timeout,
      streaming: data.streaming,
    },
    update: {
      baseUrl: data.baseUrl.trim(),
      apiKeyEnc: encryptedKey,
      model: data.model.trim() || "auto",
      temperature: data.temperature,
      maxTokens: data.maxTokens,
      timeout: data.timeout,
      streaming: data.streaming,
    },
  });

  logger.info("freellm.settings.saved", { baseUrl: data.baseUrl, model: data.model });
}

export async function clearFreeLLMConfig(): Promise<void> {
  _cachedConfig = null;
  _cacheTimestamp = 0;
  try {
    await db.freeLLMConfig.delete({ where: { id: "singleton" } }).catch(() => {});
  } catch {
    // ignore if table doesn't exist
  }
  logger.info("freellm.settings.cleared");
}
