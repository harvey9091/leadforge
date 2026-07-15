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
 *  1. Database (user-configured via Settings > FreeLLM)
 *  2. Environment variables (fallback)
 * =============================================================================
 */

import { logger } from "@/server/utils/logger";
import { db } from "@/lib/db";
import { FreeLLMConfig } from "@prisma/client";
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

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

  try {
    const row = await db.freeLLMConfig.findUnique({ where: { id: "singleton" } });
    if (row) {
      _cachedConfig = {
        baseUrl: row.baseUrl,
        apiKey: decryptApiKey(row.apiKeyEnc),
        model: row.model,
        temperature: row.temperature,
        maxTokens: row.maxTokens,
        timeout: row.timeout,
        streaming: row.streaming,
      };
      _cacheTimestamp = now;
      return _cachedConfig;
    }
  } catch {
    // table may not exist yet during first migration
  }

  _cachedConfig = {
    baseUrl: process.env.FREELLM_BASE_URL ?? "",
    apiKey: process.env.FREELLM_API_KEY ?? "",
    model: process.env.FREELLM_MODEL ?? "default",
    temperature: parseFloat(process.env.AI_TEMPERATURE ?? "0.3"),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS ?? "4000", 10),
    timeout: parseInt(process.env.AI_TIMEOUT ?? "60000", 10),
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
      model: data.model.trim() || "default",
      temperature: data.temperature,
      maxTokens: data.maxTokens,
      timeout: data.timeout,
      streaming: data.streaming,
    },
    update: {
      baseUrl: data.baseUrl.trim(),
      apiKeyEnc: encryptedKey,
      model: data.model.trim() || "default",
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
