# Architecture Hardening (Phase 2.5)

> Internal improvements to the discovery pipeline: event bus, source confidence,
> merge history, job timeline, and cleanup worker.

## Event Bus

All services communicate through an internal event bus — no service calls
another service directly.

### Events

| Event | Emitted when | Payload |
|-------|-------------|---------|
| `CompanyDiscovered` | New company stored | companyId, source, name, domain, confidence |
| `CompanyUpdated` | Existing company fields updated | companyId, fields, source, confidence |
| `CompanyMerged` | Duplicate merged into existing | companyId, duplicateName, matchStrategy, similarity |
| `DiscoveryStarted` | Discovery job started | jobId, jobName, sources, maxCompanies |
| `DiscoveryCompleted` | Discovery job finished | jobId, found, stored, duplicates, errors, durationMs |
| `DiscoveryFailed` | Discovery job failed | jobId, error |
| `EnrichmentStarted` | Enrichment job started | jobId, companyId, domain |
| `EnrichmentCompleted` | Enrichment job finished | jobId, companyId, pagesCrawled, technologiesDetected |
| `EnrichmentFailed` | Enrichment job failed | jobId, companyId, error |

### Usage

```typescript
import { eventBus } from "@/server/events/event-bus";

// Subscribe
const unsubscribe = eventBus.on("CompanyDiscovered", (payload) => {
  console.log(`New company: ${payload.name} from ${payload.source}`);
});

// Emit
await eventBus.emit("CompanyDiscovered", {
  companyId: "abc",
  source: "YC",
  name: "Acme",
  confidence: 98,
  timestamp: new Date(),
});

// Unsubscribe
unsubscribe();
```

## Source Confidence

Every source has a confidence value (0-100). Higher = more trustworthy.

| Source | Confidence |
|--------|-----------|
| YC | 98 |
| Product Hunt | 90 |
| Hacker News | 84 |
| BetaList | 72 |
| DevHunt | 70 |
| Uneed | 68 |

Multiple discoveries from different sources increase a company's effective
confidence: base = highest source confidence, +5 per additional source (max +20).

## Merge History

Every duplicate merge is recorded in the `MergeHistory` table:

- `targetCompanyId` — the company that absorbed the duplicate
- `duplicateName` — the name of the duplicate
- `duplicateDomain` — the domain of the duplicate
- `matchStrategy` — how the match was found (apex_domain, domain, name_exact, name_fuzzy)
- `similarity` — confidence score (0-1)
- `operator` — "system" or user ID
- `mergedAt` — timestamp

Nothing is silently merged — every merge is auditable.

## Job Timeline

Every discovery job records its steps in the `DiscoveryTimeline` table:

- `started` — job began processing
- `fetching` — fetching from a source
- `found` — companies found
- `normalizing` — normalizing raw data
- `deduplicating` — checking for duplicates
- `stored` — company stored
- `completed` — job finished

Each entry has a timestamp, message, and optional metadata. The timeline
provides a complete audit trail of every job's execution.

## Cleanup Worker (planned)

A daily cleanup worker will handle:

- Expired discovery logs (older than 30 days)
- Old retry attempts
- Broken jobs (stuck in RUNNING with no heartbeat for >1 hour)
- Zombie jobs (orphaned by crashed workers)

The cleanup worker runs on the same poll loop as the discovery worker but
with a 24-hour interval.

## Metrics

The `/api/v1/discover/stats` endpoint provides real-time metrics:

- Companies/hour (computed from recent jobs)
- Source success rate (completed / total per source)
- Duplicate percentage (duplicates / found)
- Average runtime (from completed jobs)
- Average source latency (from HTTP client metrics)
- Worker idle time (time between job completions)
- Retry percentage (retries / total jobs)
