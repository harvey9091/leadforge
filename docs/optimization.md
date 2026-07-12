# Lead Quality Optimization Engine (Phase 6)

> Phase 6 transforms Leadforge from a feature collection into a mature,
> production-grade lead intelligence platform. Every optimization improves
> discovery accuracy, lead quality, enrichment depth, AI precision,
> scalability, or reliability.

## Multi-Stage Discovery

### Source Priority Engine

Each source is ranked by a composite score that weights:
- **Retention rate** (25%) — how many discovered companies are kept
- **Avg qualification score** (20%) — AI qualification of discovered companies
- **Avg confidence** (15%) — AI confidence in analyses
- **Avg ICP match** (15%) — how well companies match the ICP
- **Enrichment success rate** (10%) — how often enrichment succeeds
- **Reliability score** (10%) — based on failure history
- **Low duplicate rate** (5%) — fewer duplicates = higher quality

Sources are automatically re-ranked via `recalculatePriorities()`.

### API

```
GET  /api/v1/optimization/sources     — view source metrics + rankings
POST /api/v1/optimization/sources     — recalculate priorities
```

## Incremental Crawling

Avoids repeatedly crawling unchanged pages. Each URL has a `CrawlState` record tracking:
- ETag / Last-Modified headers
- Content hash (SHA-256)
- Last crawled timestamp
- Change count and frequency estimate

The engine only recrawls when:
1. The estimated change frequency has been exceeded
2. Content hash has changed
3. The user explicitly requests a full recrawl

### API

Crawl state is managed automatically by the enrichment worker. Stats available via:
```
GET /api/v1/optimization/metrics
GET /api/v1/optimization/health
```

## Adaptive Rate Limiting

The `AdaptiveRateLimiter` class dynamically adjusts concurrency based on:
- Response latency (target: < 2000ms)
- Error rate (max: 10%)
- Rate-limit headers (Retry-After)
- Server health

When healthy, concurrency increases. When errors or latency spike, it decreases automatically.

## Smarter Deduplication

Improved duplicate detection with 6 strategies (tried in order):
1. **Apex domain match** (98% confidence)
2. **Full domain match** (95%)
3. **Fuzzy domain match** — same core, different TLD, hyphenated variants (85%+)
4. **Company alias match** — known alternate names/rebrands (90%)
5. **Name exact match** (85%)
6. **Fuzzy name match** — Levenshtein similarity > 88% (88%+)

Company aliases are stored in the `CompanyAlias` table for future matching.

## AI Optimization

### Prompt Versioning

Multiple prompt versions can be active simultaneously. Each version tracks:
- Total analyses run
- Total tokens used
- Average confidence, ICP match, qualification score
- Average duration
- Success rate
- Estimated cost ($0.002 per 1000 tokens)

### A/B Testing

Compare two prompt versions on a sample of companies:
```
POST /api/v1/optimization/prompts
{
  "name": "v1 vs v2 test",
  "versionAId": "...",
  "versionBId": "...",
  "sampleSize": 50
}
```

### API

```
GET  /api/v1/optimization/prompts  — view prompt version stats + cost
POST /api/v1/optimization/prompts  — create version or start A/B test
```

## Quality Feedback Loop

Users can mark companies as:
- **excellent** — high-quality lead (quality score: 100)
- **good** — decent lead (quality score: 70)
- **poor** — low-quality lead (quality score: 30)
- **false_positive** — not a real lead (quality score: 0)

Feedback adjusts:
- Source reliability scores (positive feedback increases, negative decreases)
- Future discovery prioritization
- Export recommendations

### API

```
POST /api/v1/optimization/feedback              — record feedback
GET  /api/v1/optimization/feedback              — get aggregate stats
GET  /api/v1/optimization/feedback/:companyId   — get company feedback
```

## System Metrics & Observability

Structured metrics are recorded for:
- API response times (p50, p95, p99)
- AI latency (p50, p95, p99)
- Crawl duration
- Export duration
- Request count / error count
- Cache hit rate

### API

```
GET /api/v1/optimization/metrics  — metrics dashboard
GET /api/v1/optimization/health   — comprehensive system health
```

## Backup & Recovery

### Backup Script

```bash
./scripts/backup/backup.sh [output_dir]
```

Creates a full database backup with:
- Timestamped filename
- SHA-256 checksum
- Automatic cleanup of old backups (keeps last 30)

### Restore Script

```bash
./scripts/backup/restore.sh <backup_file>
```

Verifies checksum and restores the database.

### API

```
POST /api/v1/optimization/backup  — trigger backup
GET  /api/v1/optimization/backup  — list backup records
```

## Database Schema

Phase 6 adds these models:

- **SourceMetric** — per-source quality metrics + priority ranking
- **CrawlState** — incremental crawling state (ETag, content hash, change frequency)
- **PromptVersion** — AI prompt versions with performance tracking
- **PromptABTest** — A/B test configurations
- **CompanyFeedback** — user quality feedback
- **CompanyAlias** — company name aliases for smarter dedup
- **SystemMetric** — operational metrics (latency, throughput, errors)
- **WorkerHealth** — worker status and throughput
- **BackupRecord** — backup operation records

## Performance Optimization

- Chunked export processing (500 rows per chunk)
- In-memory aggregation for analytics (avoids expensive SQL GROUP BY)
- Adaptive concurrency for HTTP requests
- Content hash comparison for incremental crawling
- Selective field loading in Prisma queries
- HTML capped at 500KB per page

## Worker Orchestration

All three workers (discovery, enrichment, AI) follow the same pattern:
- Queue-based polling with configurable intervals
- Heartbeat monitoring with stale job recovery
- Circuit breaker for AI calls (5 failures = 60s cooldown)
- Graceful shutdown via process signals
- Max concurrency per worker type

## Acceptance Criteria

- ✅ Discovery prioritizes the most valuable sources automatically
- ✅ Incremental crawling reduces unnecessary work
- ✅ AI analyses are versioned, cached, and measurable
- ✅ User feedback improves lead quality over time
- ✅ Exports remain fast even with large datasets
- ✅ Workers recover gracefully from failures
- ✅ System page provides meaningful operational insight
- ✅ Backup and recovery procedures are implemented
- ✅ Performance remains responsive under production-scale workloads
