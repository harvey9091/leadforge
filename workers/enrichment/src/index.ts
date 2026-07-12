/**
 * Leadforge — Enrichment Worker (Phase 2)
 *
 * Consumes enrichment jobs and runs Firecrawl scrapes.
 * Queue: leadforge.jobs.enrichment
 */
export interface EnrichmentJob {
  companyId: string;
  domain: string;
}

export async function startEnrichmentWorker(): Promise<void> {
  throw new Error("Not implemented — Phase 2");
}
