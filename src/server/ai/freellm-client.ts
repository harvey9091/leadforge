/**
 * =============================================================================
 * FreeLLM Client — Lead Intelligence Engine (Production)
 * =============================================================================
 *
 * Connects to the external FreeLLM API (OpenAI-compatible) running on
 * Server 2 (automation-server-2). Never installs AI services locally.
 *
 * Configuration (from environment or database):
 *   FREELLM_BASE_URL  — e.g. http://your-server-2:3002/v1
 *   FREELLM_API_KEY   — API key (never hardcoded)
 *
 * Database config (set via Settings > FreeLLM) takes precedence over
 * environment variables.
 *
 * Features:
 *  - Retry with exponential backoff
 *  - Timeout handling
 *  - Circuit breaker (5 consecutive failures = 60s cooldown)
 *  - Structured JSON output enforcement
 *  - Token usage tracking
 *  - Streaming support
 *  - Batch processing support
 * =============================================================================
 */

import { logger } from "@/server/utils/logger";

export interface LLMConfig {
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  retries: number;
  baseUrl: string;
  apiKey: string;
}

let _dbConfig: { baseUrl: string; apiKey: string; model: string; temperature: number; maxTokens: number; timeout: number; streaming: boolean } | null = null;
let _dbConfigLoaded = false;

async function loadDbConfig(): Promise<{ baseUrl: string; apiKey: string; model: string; temperature: number; maxTokens: number; timeout: number } | null> {
  if (_dbConfigLoaded) {
    if (_dbConfig && (_dbConfig.baseUrl || _dbConfig.apiKey)) {
      return {
        baseUrl: _dbConfig.baseUrl,
        apiKey: _dbConfig.apiKey,
        model: _dbConfig.model,
        temperature: _dbConfig.temperature,
        maxTokens: _dbConfig.maxTokens,
        timeout: _dbConfig.timeout,
      };
    }
    return null;
  }
  try {
    const { loadFreeLLMConfig } = await import("./freellm-settings");
    const cfg = await loadFreeLLMConfig();
    if (cfg.baseUrl || cfg.apiKey) {
      _dbConfig = cfg;
      _dbConfigLoaded = true;
      return {
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        model: cfg.model,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        timeout: cfg.timeout,
      };
    }
  } catch {
    // DB not available
  }
  _dbConfigLoaded = true;
  return null;
}

export async function getLLMConfig(): Promise<LLMConfig> {
  const dbCfg = await loadDbConfig();
  if (dbCfg) {
    return {
      model: dbCfg.model,
      temperature: dbCfg.temperature,
      maxTokens: dbCfg.maxTokens,
      timeout: dbCfg.timeout,
      retries: parseInt(process.env.AI_RETRIES ?? "3", 10),
      baseUrl: dbCfg.baseUrl,
      apiKey: dbCfg.apiKey,
    };
  }
  return {
    model: process.env.FREELLM_MODEL ?? "default",
    temperature: parseFloat(process.env.AI_TEMPERATURE ?? "0.3"),
    maxTokens: parseInt(process.env.AI_MAX_TOKENS ?? "4000", 10),
    timeout: parseInt(process.env.AI_TIMEOUT ?? "60000", 10),
    retries: parseInt(process.env.AI_RETRIES ?? "3", 10),
    baseUrl: process.env.FREELLM_BASE_URL ?? "",
    apiKey: process.env.FREELLM_API_KEY ?? "",
  };
}

export interface LLMResult {
  content: string;
  tokensUsed: number;
  durationMs: number;
  model: string;
  fromCache: boolean;
}

// Circuit breaker state
let _consecutiveFailures = 0;
let _circuitOpenUntil = 0;
const CIRCUIT_THRESHOLD = 5;
const CIRCUIT_RESET_MS = 60_000;

function isCircuitOpen(): boolean {
  if (_consecutiveFailures >= CIRCUIT_THRESHOLD) {
    if (Date.now() < _circuitOpenUntil) return true;
    _consecutiveFailures = 0;
    _circuitOpenUntil = 0;
  }
  return false;
}

function recordSuccess() {
  _consecutiveFailures = 0;
  _circuitOpenUntil = 0;
}

function recordFailure() {
  _consecutiveFailures++;
  if (_consecutiveFailures >= CIRCUIT_THRESHOLD) {
    _circuitOpenUntil = Date.now() + CIRCUIT_RESET_MS;
    logger.warn("freellm.circuitBreaker.open", {
      failures: _consecutiveFailures,
      resetIn: CIRCUIT_RESET_MS,
    });
  }
}

/**
 * Call FreeLLM with a system + user prompt.
 * Uses the OpenAI-compatible /chat/completions endpoint.
 */
export async function callFreeLLM(
  systemPrompt: string,
  userPrompt: string,
  config?: Partial<LLMConfig>
): Promise<LLMResult> {
  const fullConfig = { ...await getLLMConfig(), ...config };

  if (!fullConfig.baseUrl) {
    throw new Error("FREELLM_BASE_URL not configured — cannot call FreeLLM");
  }
  if (!fullConfig.apiKey) {
    throw new Error("FREELLM_API_KEY not configured — cannot call FreeLLM");
  }

  if (isCircuitOpen()) {
    throw new Error("Circuit breaker open — too many consecutive FreeLLM failures");
  }

  const startTime = Date.now();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= fullConfig.retries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10_000);
      logger.debug("freellm.retry", { attempt, delayMs: delay });
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), fullConfig.timeout);

      const response = await fetch(`${fullConfig.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${fullConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: fullConfig.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: fullConfig.temperature,
          max_tokens: fullConfig.maxTokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutHandle);

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "unknown");
        throw new Error(`FreeLLM HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { total_tokens?: number };
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content || content.trim().length === 0) {
        throw new Error("Empty response from FreeLLM");
      }

      recordSuccess();
      const durationMs = Date.now() - startTime;

      return {
        content: content.trim(),
        tokensUsed: data.usage?.total_tokens ?? estimateTokens(content),
        durationMs,
        model: fullConfig.model,
        fromCache: false,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn("freellm.callFailed", {
        attempt: attempt + 1,
        error: lastError.message,
      });
      recordFailure();
    }
  }

  throw lastError ?? new Error("FreeLLM call failed after all retries");
}

/**
 * Call FreeLLM and parse the response as JSON.
 * Retries if JSON parsing fails.
 */
export async function callFreeLLMForJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  config?: Partial<LLMConfig>
): Promise<{ data: T; tokensUsed: number; durationMs: number; raw: string }> {
  const fullConfig = await getLLMConfig();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= fullConfig.retries; attempt++) {
    try {
      const result = await callFreeLLM(systemPrompt, userPrompt, config);

      const jsonStr = extractJSON(result.content);
      if (!jsonStr) {
        throw new Error("No JSON found in FreeLLM response");
      }

      const parsed = JSON.parse(jsonStr) as T;
      return {
        data: parsed,
        tokensUsed: result.tokensUsed,
        durationMs: result.durationMs,
        raw: result.content,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn("freellm.jsonParseFailed", {
        attempt: attempt + 1,
        error: lastError.message,
      });
      if (attempt >= fullConfig.retries) break;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }

  throw lastError ?? new Error("FreeLLM JSON call failed after all retries");
}

/**
 * Stream a response from FreeLLM (for future use).
 */
export async function* streamFreeLLM(
  systemPrompt: string,
  userPrompt: string,
  config?: Partial<LLMConfig>
): AsyncGenerator<string, void, void> {
  const fullConfig = { ...await getLLMConfig(), ...config };
  if (!fullConfig.baseUrl || !fullConfig.apiKey) {
    throw new Error("FreeLLM not configured");
  }

  const response = await fetch(`${fullConfig.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${fullConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: fullConfig.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: fullConfig.temperature,
      max_tokens: fullConfig.maxTokens,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`FreeLLM stream failed: HTTP ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") return;
        try {
          const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) yield content;
        } catch {
          // skip malformed chunks
        }
      }
    }
  }
}

/**
 * Extract JSON from a response that may contain markdown code fences.
 */
function extractJSON(content: string): string | null {
  // Try direct parse
  try {
    JSON.parse(content);
    return content;
  } catch { /* continue */ }

  // Try extracting from code fences
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    try {
      JSON.parse(fenceMatch[1].trim());
      return fenceMatch[1].trim();
    } catch { /* continue */ }
  }

  // Try finding JSON object/array boundaries
  const objStart = content.indexOf("{");
  const arrStart = content.indexOf("[");
  const start = objStart >= 0 && (arrStart < 0 || objStart < arrStart) ? objStart : arrStart;
  if (start < 0) return null;

  const end = start === objStart ? content.lastIndexOf("}") : content.lastIndexOf("]");
  if (end < 0 || end <= start) return null;

  const jsonStr = content.slice(start, end + 1);
  try {
    JSON.parse(jsonStr);
    return jsonStr;
  } catch {
    return null;
  }
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Test the FreeLLM connection.
 */
export async function testConnection(): Promise<{
  success: boolean;
  latencyMs?: number;
  model?: string;
  error?: string;
}> {
  try {
    const start = Date.now();
    const result = await callFreeLLM(
      "You are a test assistant. Respond with 'OK'.",
      "Say OK.",
      { retries: 0, timeout: 15_000, maxTokens: 10 }
    );
    return {
      success: true,
      latencyMs: Date.now() - start,
      model: result.model,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Force reload of FreeLLM config from database (discards cache).
 */
export async function reloadLLMConfig(): Promise<void> {
  _dbConfig = null;
  _dbConfigLoaded = false;
}

/**
 * Get circuit breaker status.
 */
export function getCircuitBreakerStatus() {
  return {
    consecutiveFailures: _consecutiveFailures,
    isOpen: isCircuitOpen(),
    resetIn: _circuitOpenUntil > 0 ? Math.max(0, _circuitOpenUntil - Date.now()) : 0,
  };
}

/**
 * Check if FreeLLM is configured.
 */
export async function isFreeLLMConfigured(): Promise<boolean> {
  const config = await getLLMConfig();
  return !!config.baseUrl && !!config.apiKey;
}
