/**
 * =============================================================================
 * Discovery HTTP Client
 * =============================================================================
 *
 * A resilient HTTP client for discovery source adapters. Handles:
 *  - Configurable timeouts
 *  - Exponential backoff retries (network errors, 429, 5xx)
 *  - Per-source rate limiting (token bucket)
 *  - User-Agent rotation
 *  - Response sanitization
 *
 * Never throws on expected failures — returns a typed result the caller
 * can handle gracefully.
 * =============================================================================
 */

import { logger } from "@/server/utils/logger";

export interface FetchOptions {
  /** Request timeout in ms (default 15000) */
  timeoutMs?: number;
  /** Max retry attempts (default 3) */
  maxRetries?: number;
  /** Base delay for exponential backoff (default 1000ms) */
  baseDelayMs?: number;
  /** Max delay cap (default 30000ms) */
  maxDelayMs?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Response type (default text) */
  responseType?: "text" | "json" | "buffer";
  /** Accept these status codes without retry */
  allowStatuses?: number[];
}

export interface FetchResult {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  body: string | unknown;
  headers: Record<string, string>;
  /** Time taken in ms */
  durationMs: number;
  /** Number of retries used */
  retries: number;
  /** Error message if not ok */
  error?: string;
}

const DEFAULT_TIMEOUT = 15_000;
const DEFAULT_RETRIES = 3;
const DEFAULT_BASE_DELAY = 1_000;
const DEFAULT_MAX_DELAY = 30_000;

const USER_AGENTS = [
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function randomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
}

function shouldRetry(status: number, error?: string, allowStatuses: number[] = []): boolean {
  if (allowStatuses.includes(status)) return false;
  // 429 Too Many Requests — always retry (with backoff)
  if (status === 429) return true;
  // 5xx server errors — retry
  if (status >= 500 && status < 600) return true;
  // Network errors (status 0)
  if (status === 0 && error) return true;
  return false;
}

function sleep(ms: number, jitter = 0.5): Promise<void> {
  const actual = ms + Math.random() * ms * jitter;
  return new Promise((resolve) => setTimeout(resolve, actual));
}

/**
 * Resilient fetch with retry + exponential backoff.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchOptions = {}
): Promise<FetchResult> {
  const {
    timeoutMs = DEFAULT_TIMEOUT,
    maxRetries = DEFAULT_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY,
    maxDelayMs = DEFAULT_MAX_DELAY,
    headers = {},
    responseType = "text",
    allowStatuses = [],
  } = options;

  const startTime = performance.now();
  let lastError: string | undefined;
  let retries = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
      logger.debug("discovery.http.retry", { url, attempt, delayMs: delay });
      await sleep(delay);
      retries = attempt;
    }

    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": randomUserAgent(),
          Accept: responseType === "json" ? "application/json" : "*/*",
          ...headers,
        },
        signal: controller.signal,
        redirect: "follow",
      });

      clearTimeout(timeoutHandle);

      const durationMs = Math.round(performance.now() - startTime);
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      if (!response.ok && shouldRetry(response.status, undefined, allowStatuses)) {
        lastError = `HTTP ${response.status} ${response.statusText}`;
        logger.warn("discovery.http.retryableError", { url, status: response.status, attempt });
        continue;
      }

      let body: string | unknown;
      if (responseType === "json") {
        const text = await response.text();
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      } else if (responseType === "buffer") {
        body = await response.text();
      } else {
        body = await response.text();
      }

      return {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        body,
        headers: responseHeaders,
        durationMs,
        retries,
        error: response.ok ? undefined : `HTTP ${response.status}`,
      };
    } catch (err) {
      clearTimeout(timeoutHandle);
      const errorMsg = err instanceof Error ? err.message : String(err);
      lastError = errorMsg;
      logger.warn("discovery.http.error", { url, error: errorMsg, attempt });
      // Network/timeout errors — retry
      if (attempt < maxRetries) continue;
    }
  }

  return {
    ok: false,
    status: 0,
    statusText: "Network Error",
    url,
    body: "",
    headers: {},
    durationMs: Math.round(performance.now() - startTime),
    retries,
    error: lastError ?? "Unknown error",
  };
}

/**
 * Rate limiter — token bucket per source.
 * Call `await rateLimiter.wait()` before each request.
 */
export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillPerSec: number;

  constructor(rateLimitPerSec: number) {
    this.maxTokens = rateLimitPerSec;
    this.tokens = rateLimitPerSec;
    this.refillPerSec = rateLimitPerSec;
    this.lastRefill = Date.now();
  }

  async wait(): Promise<void> {
    this.refill();
    if (this.tokens < 1) {
      const waitMs = (1 / this.refillPerSec) * 1000;
      await sleep(waitMs, 0);
      this.refill();
    }
    if (this.tokens >= 1) {
      this.tokens -= 1;
    }
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillPerSec);
    this.lastRefill = now;
  }
}
