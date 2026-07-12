/**
 * =============================================================================
 * Event Bus — internal pub/sub system
 * =============================================================================
 *
 * The single communication channel between all services. No service calls
 * another service directly — everything flows through events.
 *
 * Events:
 *  - CompanyDiscovered   (new company stored)
 *  - CompanyUpdated      (existing company fields updated)
 *  - CompanyMerged       (duplicate merged into existing)
 *  - DiscoveryStarted    (job started processing)
 *  - DiscoveryCompleted  (job finished successfully)
 *  - DiscoveryFailed     (job failed)
 *  - EnrichmentStarted   (enrichment job started)
 *  - EnrichmentCompleted (enrichment job finished)
 *  - EnrichmentFailed    (enrichment job failed)
 * =============================================================================
 */

import { logger } from "@/server/utils/logger";

export type AppEventType =
  | "CompanyDiscovered"
  | "CompanyUpdated"
  | "CompanyMerged"
  | "DiscoveryStarted"
  | "DiscoveryCompleted"
  | "DiscoveryFailed"
  | "EnrichmentStarted"
  | "EnrichmentCompleted"
  | "EnrichmentFailed";

export interface CompanyDiscoveredPayload {
  companyId: string;
  jobId?: string;
  source: string;
  name: string;
  domain?: string;
  confidence: number;
  timestamp: Date;
}

export interface CompanyUpdatedPayload {
  companyId: string;
  fields: string[];
  source: string;
  confidence: number;
  timestamp: Date;
}

export interface CompanyMergedPayload {
  companyId: string;
  duplicateName: string;
  duplicateDomain?: string;
  matchStrategy: string;
  similarity: number;
  jobId?: string;
  timestamp: Date;
}

export interface DiscoveryStartedPayload {
  jobId: string;
  jobName: string;
  sources: string[];
  maxCompanies: number;
  timestamp: Date;
}

export interface DiscoveryCompletedPayload {
  jobId: string;
  found: number;
  stored: number;
  duplicates: number;
  errors: number;
  durationMs: number;
  timestamp: Date;
}

export interface DiscoveryFailedPayload {
  jobId: string;
  error: string;
  timestamp: Date;
}

export interface EnrichmentStartedPayload {
  jobId: string;
  companyId: string;
  domain: string;
  timestamp: Date;
}

export interface EnrichmentCompletedPayload {
  jobId: string;
  companyId: string;
  pagesCrawled: number;
  technologiesDetected: number;
  durationMs: number;
  timestamp: Date;
}

export interface EnrichmentFailedPayload {
  jobId: string;
  companyId: string;
  error: string;
  timestamp: Date;
}

export interface AppEventMap {
  CompanyDiscovered: CompanyDiscoveredPayload;
  CompanyUpdated: CompanyUpdatedPayload;
  CompanyMerged: CompanyMergedPayload;
  DiscoveryStarted: DiscoveryStartedPayload;
  DiscoveryCompleted: DiscoveryCompletedPayload;
  DiscoveryFailed: DiscoveryFailedPayload;
  EnrichmentStarted: EnrichmentStartedPayload;
  EnrichmentCompleted: EnrichmentCompletedPayload;
  EnrichmentFailed: EnrichmentFailedPayload;
}

type EventHandler<T> = (payload: T) => void | Promise<void>;

class EventBus {
  private handlers: Map<string, Set<EventHandler<never>>> = new Map();

  on<K extends keyof AppEventMap>(
    eventType: K,
    handler: EventHandler<AppEventMap[K]>
  ): () => void {
    const key = eventType as string;
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set());
    }
    this.handlers.get(key)!.add(handler as EventHandler<never>);
    return () => {
      this.handlers.get(key)?.delete(handler as EventHandler<never>);
    };
  }

  async emit<K extends keyof AppEventMap>(
    eventType: K,
    payload: AppEventMap[K]
  ): Promise<void> {
    const handlers = this.handlers.get(eventType as string);
    if (!handlers || handlers.size === 0) return;

    const promises: Promise<void>[] = [];
    for (const handler of handlers) {
      try {
        const result = handler(payload as never);
        if (result instanceof Promise) {
          promises.push(result);
        }
      } catch (err) {
        logger.error("eventBus.handlerError", {
          eventType,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (promises.length > 0) {
      await Promise.allSettled(promises);
    }
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.handlers.keys());
  }

  handlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const eventBus = new EventBus();
