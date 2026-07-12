/**
 * =============================================================================
 * Adaptive Rate Limiter — Phase 6
 * =============================================================================
 *
 * Dynamically adjusts concurrency based on:
 *  - Response latency
 *  - Error rates
 *  - Rate-limit headers (Retry-After)
 *  - Server health
 *
 * Prevents unnecessary throttling while maximizing throughput.
 * =============================================================================
 */

import { logger } from "@/server/utils/logger";

export interface AdaptiveRateLimitConfig {
  minConcurrency: number;
  maxConcurrency: number;
  targetLatencyMs: number;
  maxErrorRate: number;
  adjustmentInterval: number;
}

export class AdaptiveRateLimiter {
  private concurrency: number;
  private config: AdaptiveRateLimitConfig;
  private latencies: number[] = [];
  private errors: number = 0;
  private successes: number = 0;
  private lastAdjustment: number = Date.now();
  private rateLimitUntil: number = 0;

  constructor(config: Partial<AdaptiveRateLimitConfig> = {}) {
    this.config = {
      minConcurrency: 1,
      maxConcurrency: 5,
      targetLatencyMs: 2000,
      maxErrorRate: 0.1,
      adjustmentInterval: 10_000,
      ...config,
    };
    this.concurrency = this.config.minConcurrency;
  }

  /**
   * Get the current concurrency level.
   */
  getConcurrency(): number {
    if (Date.now() < this.rateLimitUntil) return this.config.minConcurrency;
    this.maybeAdjust();
    return this.concurrency;
  }

  /**
   * Record a request result.
   */
  recordResult(latencyMs: number, success: boolean, retryAfterMs?: number): void {
    this.latencies.push(latencyMs);
    if (this.latencies.length > 50) this.latencies.shift();

    if (success) {
      this.successes++;
    } else {
      this.errors++;
    }

    if (retryAfterMs) {
      this.rateLimitUntil = Date.now() + retryAfterMs;
      logger.warn("adaptiveRateLimit.rateLimited", { retryAfterMs, concurrency: this.concurrency });
      this.concurrency = this.config.minConcurrency;
    }
  }

  /**
   * Get current performance metrics.
   */
  getMetrics() {
    const avgLatency = this.latencies.length > 0
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
      : 0;
    const totalRequests = this.errors + this.successes;
    const errorRate = totalRequests > 0 ? this.errors / totalRequests : 0;

    return {
      concurrency: this.concurrency,
      avgLatencyMs: Math.round(avgLatency),
      errorRate: Math.round(errorRate * 100) / 100,
      totalRequests,
      isRateLimited: Date.now() < this.rateLimitUntil,
      rateLimitResetIn: this.rateLimitUntil > 0 ? Math.max(0, this.rateLimitUntil - Date.now()) : 0,
    };
  }

  /**
   * Adjust concurrency based on current performance.
   */
  private maybeAdjust(): void {
    if (Date.now() - this.lastAdjustment < this.config.adjustmentInterval) return;
    if (this.latencies.length < 5) return;

    this.lastAdjustment = Date.now();

    const avgLatency = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
    const totalRequests = this.errors + this.successes;
    const errorRate = totalRequests > 0 ? this.errors / totalRequests : 0;

    // If error rate is too high, reduce concurrency
    if (errorRate > this.config.maxErrorRate) {
      this.concurrency = Math.max(this.config.minConcurrency, Math.floor(this.concurrency * 0.5));
      logger.info("adaptiveRateLimit.reduce", { reason: "high_error_rate", errorRate, newConcurrency: this.concurrency });
      return;
    }

    // If latency is too high, reduce concurrency
    if (avgLatency > this.config.targetLatencyMs * 2) {
      this.concurrency = Math.max(this.config.minConcurrency, this.concurrency - 1);
      logger.info("adaptiveRateLimit.reduce", { reason: "high_latency", avgLatency, newConcurrency: this.concurrency });
      return;
    }

    // If latency is good and error rate is low, increase concurrency
    if (avgLatency < this.config.targetLatencyMs && errorRate < this.config.maxErrorRate * 0.5) {
      this.concurrency = Math.min(this.config.maxConcurrency, this.concurrency + 1);
      logger.info("adaptiveRateLimit.increase", { reason: "healthy", avgLatency, newConcurrency: this.concurrency });
    }

    // Reset counters after adjustment
    this.errors = 0;
    this.successes = 0;
  }
}
