# Leadforge — Production Operations Guide

> Phase 8 — Production Readiness, Scale & Enterprise Polish

This document covers everything needed to run Leadforge in production.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Deployment Guide](#deployment-guide)
3. [Scaling Guide](#scaling-guide)
4. [Backup & Recovery](#backup--recovery)
5. [Monitoring & Alerting](#monitoring--alerting)
6. [Troubleshooting](#troubleshooting)
7. [Operational Runbook](#operational-runbook)
8. [Maintenance Schedule](#maintenance-schedule)
9. [Security](#security)
10. [Environment Variables](#environment-variables)

## Architecture Overview

Leadforge is a self-hosted lead intelligence platform with these components:

- **Next.js Dashboard** — premium dark-first UI with hash-routed SPA
- **PostgreSQL** — canonical datastore (SQLite for dev)
- **Discovery Worker** — polls for discovery jobs, processes real public sources
- **Enrichment Worker** — crawls company websites via Firecrawl or direct HTTP
- **AI Worker** — analyzes companies via FreeLLM (z-ai-web-dev-sdk)
- **Signal Engine** — detects buying signals from enrichment + AI + crawl changes
- **Caddy** — reverse proxy with auto-HTTPS

### Data Flow

```
Public Sources → Discovery → Normalization → Validation → Dedup → PostgreSQL
                                                                    ↓
Firecrawl/Direct HTTP → Enrichment → Technology Detection → Content Extraction
                                                                    ↓
FreeLLM → AI Analysis → Schema Validation → Confidence → Evidence → Database
                                                                    ↓
Signal Engine → Timeline → Recommendations → Intelligence Feed → Dashboard
                                                                    ↓
Export Engine (CSV/JSON/XLSX) → LightReach / Clay / Apollo / HubSpot
```

## Deployment Guide

### Prerequisites

- Oracle Cloud VM (4+ OCPU, 24GB+ RAM recommended)
- Docker + Docker Compose installed
- Domain name pointing to VM's public IP
- Ports 80 + 443 open

### Steps

```bash
# 1. Clone and configure
git clone <repo> /opt/leadforge && cd /opt/leadforge
cp .env.example .env
# Edit .env — set JWT_SECRET, POSTGRES_PASSWORD, APP_URL

# 2. Edit Caddyfile with your domain
nano docker/Caddyfile

# 3. Start the stack
docker compose --env-file .env up -d

# 4. Verify health
curl https://your-domain.com/api/v1/health

# 5. Seed admin user (first deploy only)
docker compose exec dashboard bun run db:seed

# 6. Initialize default alert rules
curl -X POST https://your-domain.com/api/v1/alerts/rules?init=true
```

### Resource Limits

The docker-compose.yml includes resource limits:
- Dashboard: 2GB memory, 2 CPUs
- PostgreSQL: 1GB memory, 1 CPU
- Redis: 256MB memory
- RabbitMQ: 512MB memory

### Startup Ordering

Services start in dependency order:
1. PostgreSQL, Redis, RabbitMQ (data layer)
2. Dashboard (application layer, waits for PostgreSQL healthcheck)
3. Caddy (proxy layer, waits for dashboard)

## Scaling Guide

### Vertical Scaling (Single VM)

- Increase Docker resource limits
- Increase Node.js heap: `NODE_OPTIONS=--max-old-space-size=4096`
- Increase PostgreSQL `shared_buffers` and `max_connections`

### Horizontal Scaling (Multi-VM)

- Split workers into separate containers/processes
- Use PostgreSQL connection pooling (PgBouncer)
- Add Redis for distributed locking
- Use RabbitMQ for distributed job queues

### Performance Targets

| Scale | Companies | Expected Response Time |
|-------|-----------|----------------------|
| Small | 1,000 | < 100ms |
| Medium | 10,000 | < 200ms |
| Large | 50,000 | < 500ms |
| Enterprise | 100,000 | < 1s |

## Backup & Recovery

### Automated Backups

```bash
# Daily backup (add to crontab)
0 2 * * * /opt/leadforge/scripts/backup/backup.sh /opt/backups

# Or via API
curl -X POST https://your-domain.com/api/v1/optimization/backup
```

### Manual Backup

```bash
./scripts/backup/backup.sh [output_dir]
```

### Restore

```bash
./scripts/backup/restore.sh <backup_file>
```

### Backup Retention

- Default: keep last 30 backups
- Older backups are automatically cleaned up
- Each backup includes SHA-256 checksum for verification

### Backup Status Dashboard

View backup history via:
```
GET /api/v1/optimization/backup
```

## Monitoring & Alerting

### Observability Endpoint

```
GET /api/v1/observability
```

Returns: memory usage, worker status, queue depth, database stats, alerts, cache hit rate, circuit breaker status.

### Alert Rules

Default alert rules are created automatically:
- Worker offline (critical)
- Queue backlog > 100 (warning)
- Crawl failure rate > 30% (warning)
- AI failure rate > 20% (warning)
- API latency p95 > 5s (warning)
- Circuit breaker open (critical)

### Managing Alerts

```
GET  /api/v1/alerts/rules          — list rules
POST /api/v1/alerts/rules          — create rule
PUT  /api/v1/alerts/rules/:id      — update rule
GET  /api/v1/alerts/events         — list alert events
GET  /api/v1/alerts/events?stats=true — alert statistics
```

### Webhook Integration

Each alert rule can have a `webhookUrl` — when triggered, Leadforge sends a POST request with the alert details.

### Data Integrity

```
GET  /api/v1/integrity             — view check history
POST /api/v1/integrity             — run checks
POST /api/v1/integrity { repair: true } — run checks with auto-repair
```

Checks for:
- Orphaned sources, people, technology links
- Duplicate companies
- Invalid/corrupted snapshots
- Incomplete AI analyses
- Stuck discovery/enrichment/AI jobs

## Troubleshooting

### Worker Not Processing Jobs

1. Check health: `GET /api/v1/health`
2. Check worker status: `GET /api/v1/observability`
3. Check for stuck jobs: `POST /api/v1/integrity`
4. Restart the application container

### AI Analysis Failing

1. Test FreeLLM: `POST /api/v1/ai/test`
2. Check circuit breaker: `GET /api/v1/observability`
3. If circuit breaker is open, wait 60 seconds for it to reset
4. Check AI job logs: `GET /api/v1/ai/jobs`

### Enrichment Failing

1. Check Firecrawl health: `GET /api/v1/firecrawl/health`
2. If Firecrawl is down, the system falls back to direct HTTP
3. Check enrichment job logs: `GET /api/v1/enrich/jobs/:id/logs`

### Database Performance

1. Run integrity checks: `POST /api/v1/integrity`
2. Check for duplicate companies
3. Vacuum PostgreSQL: `docker compose exec postgres vacuumdb -U leadforge --all`
4. Check slow queries in logs

### Dead Letter Jobs

Jobs that fail permanently after all retries are moved to the dead letter queue:
```
GET    /api/v1/dead-letter
DELETE /api/v1/dead-letter?id=...   — remove specific job
DELETE /api/v1/dead-letter           — clear all
```

## Operational Runbook

### Daily

- Check the Intelligence Feed for new signals
- Review active alerts
- Monitor queue depth on System page

### Weekly

- Run data integrity checks with repair
- Review source metrics and priorities
- Check backup status
- Review export history

### Monthly

- Recalculate source priorities
- Run full backup verification
- Review AI prompt version performance
- Check disk space and clean old logs

### Quarterly

- Security audit (check for new dependencies with vulnerabilities)
- Performance benchmark
- Review and update alert thresholds
- Database maintenance (vacuum, reindex)

## Maintenance Schedule

| Task | Frequency | Command |
|------|-----------|---------|
| Database backup | Daily | `./scripts/backup/backup.sh` |
| Integrity check | Weekly | `POST /api/v1/integrity` |
| Priority recalculation | Monthly | `POST /api/v1/optimization/sources` |
| Vacuum database | Monthly | `docker compose exec postgres vacuumdb -U leadforge --all` |
| Clean old logs | Monthly | `find /opt/leadforge/logs -mtime +30 -delete` |
| Security audit | Quarterly | `bun audit` |
| Backup restore test | Quarterly | `./scripts/backup/restore.sh <test_backup>` |

## Security

### Authentication

- JWT-based with refresh token rotation
- httpOnly cookies for session management
- First registered user becomes ADMIN
- Role-based access control (ADMIN, USER)

### Secrets Management

- All secrets in `.env` file (never committed)
- JWT_SECRET must be at least 32 characters
- API keys are SHA-256 hashed at rest
- Configuration export redacts sensitive values

### Input Validation

- All API inputs validated with Zod schemas
- URL validation on all crawl targets
- HTML sanitization to prevent XSS
- SQL injection prevention via Prisma parameterized queries

### Audit Logging

- All auth events logged (login, logout, register)
- All data modifications logged with user ID and IP
- Audit logs retained per configurable policy

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) |

### AI Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_MODEL` | `default` | FreeLLM model name |
| `AI_TEMPERATURE` | `0.3` | LLM temperature |
| `AI_MAX_TOKENS` | `4000` | Max tokens per response |
| `AI_TIMEOUT` | `60000` | Request timeout in ms |
| `AI_RETRIES` | `3` | Max retry attempts |

### Enrichment

| Variable | Default | Description |
|----------|---------|-------------|
| `FIRECRAWL_API_URL` | — | Firecrawl instance URL |
| `FIRECRAWL_API_KEY` | — | Firecrawl API key |
| `FIRECRAWL_TIMEOUT` | `30000` | Firecrawl timeout in ms |

### Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_AUTH_WINDOW_MS` | `900000` | Auth rate limit window |
| `RATE_LIMIT_AUTH_MAX` | `10` | Max auth attempts per window |
| `RATE_LIMIT_API_WINDOW_MS` | `60000` | API rate limit window |
| `RATE_LIMIT_API_MAX` | `120` | Max API requests per window |

### Configuration Validation

Validate your configuration:
```
GET /api/v1/config
```

Export configuration (secrets redacted):
```
GET /api/v1/config?export=true
```
