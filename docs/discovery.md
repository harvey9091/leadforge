# Discovery Engine

> Phase 2 — discovers companies from public sources, normalizes them into a
> canonical schema, deduplicates, and stores them in PostgreSQL.

## How discovery works

```
User creates a discovery job (UI or API)
  → Job inserted into DiscoveryJob table with status=QUEUED
  → Worker polls for QUEUED jobs (every 5 seconds)
  → Worker sets status=RUNNING, records startedAt
  → For each source adapter:
      → Adapter fetches raw data from the source (HTTP/RSS)
      → For each raw company:
          → Normalize → canonical schema (name, domain, apex domain, etc.)
          → Validate → reject missing domains, spam, blocked TLDs
          → Deduplicate → match by apex domain, then fuzzy name
          → Store → insert new company OR merge into existing
          → Log every action to DiscoveryLog
      → Update heartbeat + progress
  → Worker sets status=COMPLETED (or FAILED)
```

### Key properties

- **Real data only**: every company originates from a real public source. No mock data.
- **Restart-safe**: job state is persisted to PostgreSQL. If the server crashes mid-job, the job is detected as stale (no heartbeat for 60s) and marked as RETRYING.
- **Cancellable**: the worker checks `shouldContinue()` between every company. Pause/cancel takes effect immediately.
- **Resilient**: network errors, parse errors, and source failures don't crash the worker — they're logged and the worker continues with the next company or source.
- **Rate-limited**: each source adapter has its own rate limiter (token bucket). The worker respects source-specific limits.
- **Observable**: every action is logged to DiscoveryLog with level, source, message, and metadata. Logs are viewable from the UI.

## Sources (Version 1)

| Source | Type | Auth | Status |
|--------|------|------|--------|
| Hacker News (Show HN) | REST API (Algolia) | None | ✅ Active — real data |
| Product Hunt | RSS/Atom feed | None | ✅ Active — real data |
| Y Combinator | HTML scrape | None | ⚠️ Adapter implemented; YC's page is JS-rendered, may yield limited data |
| BetaList | HTML scrape | None | ⚠️ Adapter implemented; page structure may vary |
| DevHunt | HTML scrape | None | ⚠️ Adapter implemented; SPA, may yield limited data |
| Uneed | HTML scrape | None | ⚠️ Adapter implemented; SPA, may yield limited data |

Each adapter is fully implemented with HTTP fetching, parsing, rate limiting, and error handling. Sources that are temporarily unreachable return empty results and log a warning — the worker continues with other sources.

## How to add a new source

1. **Create the adapter** at `src/server/discovery/sources/<source-name>.ts`:

```typescript
import type { DiscoverySource, DiscoveryParams, DiscoveryContext, RawCompany } from "../types";
import { fetchWithRetry, RateLimiter } from "../http-client";

const SOURCE_TYPE = "YOUR_SOURCE" as const; // add to SourceType enum in schema.prisma
const rateLimiter = new RateLimiter(0.5); // 1 req per 2 sec

export const yourSourceSource: DiscoverySource = {
  id: SOURCE_TYPE,
  label: "Your Source",
  rateLimitPerSec: 0.5,
  defaultPageSize: 50,

  async *discover(params, ctx): AsyncGenerator<RawCompany, void, void> {
    ctx.log("info", "Starting Your Source discovery");
    // Fetch data from the source
    // Yield RawCompany objects one at a time
    // The worker handles normalize → validate → dedup → store
  },
};
```

2. **Add the source type** to the `SourceType` enum in `prisma/schema.prisma`:

```prisma
enum SourceType {
  ...
  YOUR_SOURCE
}
```

3. **Register the adapter** in `src/server/discovery/registry.ts`:

```typescript
import { yourSourceSource } from "./sources/your-source";

export const DISCOVERY_SOURCES: DiscoverySource[] = [
  ...
  yourSourceSource,
];
```

4. **Run `bun run db:push`** to sync the schema.

That's it — no other code changes needed. The worker will automatically discover from the new source, and it will appear in the UI's source picker.

### Source adapter contract

Every adapter must implement the `DiscoverySource` interface:

```typescript
interface DiscoverySource {
  readonly id: SourceType;
  readonly label: string;
  readonly rateLimitPerSec: number;
  readonly defaultPageSize: number;

  discover(
    params: DiscoveryParams,
    ctx: DiscoveryContext
  ): AsyncGenerator<RawCompany, void, void>;
}
```

- **`discover()`** is an async generator — yield `RawCompany` objects one at a time. The worker processes each one before requesting the next.
- **`ctx.shouldContinue()`** — check this between yields. Return early if false (job was paused/cancelled).
- **`ctx.log(level, message, metadata)`** — log to the job's log. Levels: debug, info, warn, error.
- **`ctx.updateProgress(progress)`** — update currentSource, currentPage, etc.
- **`ctx.sleep(ms)`** — sleep that respects cancellation. Use instead of `setTimeout`.

The adapter yields `RawCompany` objects with source-specific fields. The normalizer converts them to the canonical `NormalizedCompany` shape — the rest of the system never sees source-specific structures.

## Worker lifecycle

### Starting

The worker starts lazily on the first API request after server boot. The `ensureWorkerStarted()` function in `src/server/discovery/worker/bootstrap.ts` is called from the health and discover API routes. It's idempotent — calling it multiple times is a no-op.

### Polling

The worker polls for QUEUED or RETRYING jobs every 5 seconds. When it finds a job:

1. Sets status to RUNNING, records startedAt
2. Builds DiscoveryParams from the job configuration
3. Iterates each source adapter
4. For each raw company: normalize → validate → dedup → store → log
5. Updates heartbeat + progress every 5 companies
6. Sets status to COMPLETED (or FAILED on error)

### Stale job recovery

If a job is RUNNING but the heartbeat is >60s old (server crashed), the worker:
1. Detects the stale job on next poll
2. Sets status to RETRYING
3. Logs a warning
4. The job will be picked up again on the next poll

### Concurrency

The worker processes up to 3 jobs concurrently. Each job runs in its own async context. Source adapters within a job run sequentially (to respect per-source rate limits).

### Graceful shutdown

The worker clears its interval on `beforeExit`. In-progress jobs will be detected as stale on the next server boot and retried.

## Job states

| State | Description |
|-------|-------------|
| QUEUED | Job created, waiting for worker |
| RUNNING | Worker is actively processing |
| PAUSED | User paused the job — worker stops at next check |
| COMPLETED | Job finished successfully |
| FAILED | Job encountered an unrecoverable error |
| CANCELLED | User cancelled the job |
| RETRYING | Job was stale (worker died) — will be retried |

### State transitions

```
QUEUED → RUNNING → COMPLETED
                 → FAILED
                 → PAUSED → QUEUED (resume)
                 → CANCELLED
FAILED → QUEUED (retry)
COMPLETED → QUEUED (retry)
CANCELLED → QUEUED (retry)
RUNNING (stale) → RETRYING → QUEUED
```

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/discover/jobs` | Create a discovery job |
| GET | `/api/v1/discover/jobs` | List jobs |
| GET | `/api/v1/discover/jobs/:id` | Get job details |
| POST | `/api/v1/discover/jobs/:id/pause` | Pause a running job |
| POST | `/api/v1/discover/jobs/:id/resume` | Resume a paused job |
| POST | `/api/v1/discover/jobs/:id/retry` | Retry a failed/completed job |
| DELETE | `/api/v1/discover/jobs/:id` | Cancel (or delete with ?delete=true) |
| GET | `/api/v1/discover/jobs/:id/logs` | Get job logs |
| GET | `/api/v1/discover/stats` | Discovery dashboard metrics |
| GET | `/api/v1/sources` | List all available sources |
| GET | `/api/v1/companies` | Search companies (full-text) |
| GET | `/api/v1/companies/:id` | Get company details |
| GET | `/api/v1/companies/filters` | Get distinct values for filters |

## Database schema

See [database.md](database.md) for the full schema. Key Phase 2 tables:

- **Company** — canonical company record (name, domain, apex domain, description, country, industry, etc.)
- **Source** — provenance tracking (which source discovered a company, when, raw payload)
- **DiscoveryJob** — user-created discovery job (config, status, progress)
- **DiscoveryLog** — per-job structured log entries
- **Tag** / **CompanyTag** — first-class tag entity for searchability

## Configuration

All configuration is via environment variables. See `.env.example` for the full list.

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | — | PostgreSQL connection string (or SQLite for dev) |
| `JWT_SECRET` | — | Secret for JWT signing |
| `LOG_LEVEL` | `info` | Minimum log level (debug, info, warn, error) |

Source-specific configuration (API keys, base URLs) can be added per adapter. No credentials are hardcoded.

## Testing

```bash
# Unit tests (normalizer, validator, dedup, registry)
bunx vitest run

# Specific discovery tests
bunx vitest run tests/unit/normalizer.test.ts
bunx vitest run tests/unit/validator.test.ts
bunx vitest run tests/unit/dedup.test.ts
bunx vitest run tests/unit/registry.test.ts
```

## Running locally

```bash
# 1. Install dependencies
bun install

# 2. Set up the database
bun run db:push
bun run db:seed    # creates admin user only — no mock companies

# 3. Start the dev server
bun run dev

# 4. Log in
# Email: admin@leadforge.local
# Password: Leadforge123

# 5. Navigate to Discover → Create job
# Select sources (HN + Product Hunt recommended for best results)
# Set max companies (e.g. 50)
# Click Create

# 6. Watch the job progress live in the UI
# The worker starts within 5 seconds and processes companies
```

## Deploying with Docker Compose

The production `docker-compose.yml` includes:
- PostgreSQL 16 (canonical datastore)
- Redis 7 (for future rate limiting)
- RabbitMQ 3 (for future worker queue)
- Caddy 2 (reverse proxy + auto HTTPS)
- Dashboard (Next.js, includes the discovery worker)

The worker runs inside the dashboard container. In Phase 3+, the worker can be split into a separate container for horizontal scaling.

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET, POSTGRES_PASSWORD, APP_URL

# 2. Start the stack
docker compose --env-file .env up -d

# 3. Run migrations
docker compose exec dashboard bun run db:push

# 4. Create admin user
docker compose exec dashboard bun run db:seed

# 5. Visit your app
open https://your-domain.com
```
