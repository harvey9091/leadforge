<div align="center">

# Leadforge

### Self-Hosted Lead Intelligence Platform

Discover, enrich, qualify, and export high-quality SaaS and AI startup leads —
using only self-hosted infrastructure and publicly available data.

[Features](#features) · [Architecture](#architecture) · [Deployment](#deployment) · [Docs](#documentation)

</div>

---

## Overview

Leadforge is a production-grade, self-hosted lead intelligence platform that
discovers companies from public sources (Hacker News, Product Hunt, Y Combinator,
BetaList, DevHunt, Uneed), enriches them with website data via Firecrawl,
qualifies them with AI via FreeLLM, and exports them cleanly for outreach.

It is **not** a CRM. It is **not** an email platform. Its sole responsibility is:

**Discover → Enrich → Understand → Filter → Export**

## Features

### Discovery Engine
- 6 source adapters (Hacker News, Product Hunt, YC, BetaList, DevHunt, Uneed)
- Real public data — no mock data, no fake APIs
- Source priority engine with auto-ranking by quality metrics
- Adaptive rate limiting with dynamic concurrency
- Incremental crawling (ETags, content hashes, change frequency tracking)
- Smart deduplication (apex domain, fuzzy domain, aliases, Levenshtein name matching)

### Enrichment Engine
- Firecrawl integration with direct HTTP fallback
- 80+ technology detection (React, Next.js, Stripe, Vercel, Sentry, Intercom, etc.)
- Content extraction (title, description, CTA, emails, social links, pricing signals)
- Website health monitoring (HTTPS, status, speed, redirects, robots.txt)
- Historical snapshots with change detection

### AI Intelligence Engine
- FreeLLM integration (OpenAI-compatible API)
- Structured JSON output with Zod schema validation
- Business summaries, product categorization, ICP matching
- Qualification scoring with explainable evidence
- Video opportunity scoring (8 sub-scores)
- Website quality assessment (8 sub-scores)
- Prompt versioning with A/B testing and cost tracking
- Circuit breaker with automatic cooldown

### Signal Engine
- 20+ signal types (product launches, pricing changes, hiring spikes, funding, etc.)
- Timeline engine — nothing is overwritten, everything is historical
- Change detection / diff engine comparing crawl versions
- Smart priority engine (dynamic score from 10 weighted factors)
- Recommendation engine with action suggestions and explanations
- Similar company engine (industry, technology, pricing, ICP similarity)
- Semantic search (natural language with structured filter fallback)
- Trend analysis (fastest-growing industries, emerging technologies)

### Workspace
- Advanced search (boolean operators, quoted phrases, field-specific filters)
- Export engine (CSV, JSON, XLSX with presets for LightReach, Clay, Apollo, HubSpot)
- Collections (smart folders), watchlists, notes, tags
- Company detail workspace with 8 tabs (Overview, AI, Technologies, Pricing, People, Timeline, Evidence, Notes)
- Bulk operations (tag, re-analyze, re-enrich, pin, archive, delete)
- Intelligence feed (live signals and recommendations)

### Production Readiness
- Alert system with configurable rules and webhook support
- Data integrity checker with auto-repair
- Observability layer (API latency, worker throughput, queue depth, cache hit rate)
- Backup and restore scripts
- Configuration validation and diagnostics
- Dead letter queue for permanently failed jobs

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Server 1 (Leadforge)                   │
│                                                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │
│  │ Frontend  │  │  Worker  │  │PostgreSQL│  │  Redis  │ │
│  │  (Next.js)│  │(Background)│  │          │  │         │ │
│  └─────┬─────┘  └─────┬────┘  └──────────┘  └─────────┘ │
│        │               │                                   │
│        │          ┌─────┴────┐                             │
│        │          │ RabbitMQ │                             │
│        │          └─────┬────┘                             │
│        │                │                                   │
│  ┌─────┴────────────────┴─────────────────────────────┐   │
│  │              Leadforge API (REST)                   │   │
│  │  Auth · Discovery · Enrichment · AI · Signals ·     │   │
│  │  Search · Export · Workspace · Analytics            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                           │
└───────────────────────────┬───────────────────────────────┘
                            │ HTTP
┌───────────────────────────┴───────────────────────────────┐
│                   Server 2 (AI Infrastructure)              │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│  │   FreeLLM    │  │  Firecrawl   │  │  Traefik / Coolify│ │
│  │  (LLM API)   │  │  (Scraper)   │  │                  │ │
│  └──────────────┘  └──────────────┘  └──────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, TypeScript, Tailwind CSS 4, shadcn/ui, Framer Motion |
| State | TanStack Query, Zustand, React Hook Form |
| Backend | Next.js API Routes (Node.js runtime) |
| Database | PostgreSQL 16 (SQLite for dev) |
| ORM | Prisma 6 |
| Auth | Custom JWT (PBKDF2 hashing, refresh token rotation) |
| Validation | Zod 4 |
| AI | FreeLLM (OpenAI-compatible HTTP API) |
| Scraping | Firecrawl (external) + direct HTTP fallback |
| Queue | RabbitMQ |
| Cache | Redis |
| Deployment | Docker Compose |
| Proxy | Caddy 2 (auto-HTTPS) |

## Deployment

### Oracle Cloud Architecture

Leadforge is designed for a two-server Oracle Cloud deployment:

- **Server 1** (`automation-server`): Leadforge app + PostgreSQL + Redis + RabbitMQ
- **Server 2** (`automation-server-2`): FreeLLM + Firecrawl (external AI infrastructure)

Leadforge never installs AI services locally — it communicates with Server 2 over HTTP.

### Docker Deployment

```bash
# 1. Clone
git clone https://github.com/harvey9091/leadforge.git
cd leadforge

# 2. Configure
cp .env.example .env
# Edit .env — set passwords, JWT secret, FreeLLM URL/key, Firecrawl URL

# 3. Deploy
docker compose --env-file .env up -d

# 4. Verify
curl http://localhost:3000/api/v1/health

# 5. Seed admin user (first deploy only)
docker compose exec frontend npx prisma db push
docker compose exec frontend node scripts/seed.js

# 6. Login
# Email: admin@leadforge.local
# Password: Leadforge123
```

### Resource Allocation

| Container | Memory | CPU |
|-----------|--------|-----|
| PostgreSQL | 2 GB | 2.0 |
| Redis | 512 MB | 0.5 |
| RabbitMQ | 512 MB | 0.5 |
| Frontend | 1 GB | 1.5 |
| Worker | 1 GB | 1.0 |
| **Total** | ~5 GB | ~5.5 |

## Environment Variables

See [`.env.example`](.env.example) for the complete list. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |
| `FREELLM_BASE_URL` | FreeLLM API URL (OpenAI-compatible) |
| `FREELLM_API_KEY` | FreeLLM API key |
| `FIRECRAWL_URL` | Firecrawl instance URL |
| `DISCOVERY_CONCURRENCY` | Concurrent discovery jobs (default: 3) |
| `ENRICHMENT_CONCURRENCY` | Concurrent enrichment jobs (default: 2) |
| `AI_CONCURRENCY` | Concurrent AI analysis jobs (default: 2) |

## FreeLLM Integration

Leadforge connects to an external FreeLLM API (OpenAI-compatible) running on Server 2:

```
FREELLM_BASE_URL=http://your-server-2:3002/v1
FREELLM_API_KEY=your-api-key
```

Features:
- OpenAI-compatible `/chat/completions` endpoint
- Retry with exponential backoff
- Circuit breaker (5 failures = 60s cooldown)
- Structured JSON output with Zod validation
- Token usage tracking and cost estimation
- Prompt versioning with A/B testing
- Streaming support

## Firecrawl Integration

Leadforge connects to an external Firecrawl instance on Server 2:

```
FIRECRAWL_URL=http://your-server-2:3003
```

When Firecrawl is unavailable, the system automatically falls back to direct
HTTP fetching (still real data, no mock).

## Quick Start (Development)

```bash
# Install dependencies
bun install

# Set up dev database (SQLite)
echo "DATABASE_URL=file:./db/custom.db" > .env
bun run db:push
bun run db:seed

# Start dev server
bun run dev

# Open http://localhost:3000
# Login: admin@leadforge.local / Leadforge123
```

## Documentation

| Document | Description |
|----------|-------------|
| [Deployment Guide](docs/deployment-guide.md) | Oracle Cloud production deployment |
| [Production Operations](docs/production-operations.md) | Operational runbook, backup, monitoring |
| [Architecture](docs/architecture.md) | System design and principles |
| [Discovery Engine](docs/discovery.md) | How discovery works, adding new sources |
| [Enrichment Engine](docs/enrichment.md) | Firecrawl integration, technology detection |
| [AI Intelligence](docs/ai-intelligence.md) | FreeLLM pipeline, prompt versioning |
| [Signal Engine](docs/phase7-signal-engine.md) | Signal detection, timelines, recommendations |
| [Optimization](docs/optimization.md) | Source metrics, incremental crawling, adaptive rate limiting |
| [Workspace](docs/workspace.md) | Search, filters, collections, exports |
| [Database Schema](docs/database.md) | Entity relationships |

## Repository Structure

```
leadforge/
├── apps/                  # Future: separate API and dashboard apps
├── docker/                # Dockerfiles and Caddyfile
├── docs/                  # All documentation
├── prisma/                # Prisma schema (66 models)
├── public/                # Static assets
├── scripts/               # Seed, backup, deployment scripts
├── services/              # Discovery, enrichment, scoring service interfaces
├── src/
│   ├── app/               # Next.js App Router (83 API routes)
│   ├── components/        # UI components (shadcn/ui + custom)
│   ├── features/          # Page-level feature modules
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Shared utilities
│   └── server/            # Backend layer (services, repositories, workers)
├── tests/                 # Unit tests (25 files, 191 tests)
├── workers/               # Worker stubs for future Phase 2+
├── packages/              # Shared packages (future extraction)
├── docker-compose.yml     # Production Docker Compose
├── .env.example           # Environment variable template
└── package.json
```

## License

[MIT](LICENSE) © 2026 Harvey

## Credits

Built as a self-hosted alternative to Apollo for discovering, enriching, and
qualifying SaaS and AI startup leads. Designed for Oracle Cloud infrastructure
with FreeLLM and Firecrawl as external AI services.
