# Leadforge — Oracle Cloud Production Deployment Guide

## Infrastructure Overview

### Server 1: automation-server (Leadforge Production)
- **OS**: Oracle Linux Server 9.8
- **Resources**: 4 vCPU, ~11 GB RAM, 100 GB SSD
- **Hosts**: Leadforge App + Worker, PostgreSQL, Redis, RabbitMQ

### Server 2: automation-server-2 (External AI)
- **OS**: Oracle Linux Server 10.1
- **Resources**: 4 vCPU, ~11 GB RAM, 100 GB SSD
- **Hosts**: FreeLLM API, Firecrawl, Coolify, Traefik
- **Leadforge connects to this server over HTTP — nothing is installed locally**

## Quick Deploy

```bash
# 1. SSH into automation-server
ssh oracle@automation-server

# 2. Clone the repository
git clone <your-repo> /opt/leadforge
cd /opt/leadforge

# 3. Create production .env
cp .env.example .env
nano .env  # Fill in all values

# 4. Deploy
docker compose --env-file .env up -d

# 5. Wait for health checks to pass
docker compose ps

# 6. Verify
curl http://localhost:3001/api/v1/health

# 7. Seed admin user (first deploy only)
docker compose exec frontend npx prisma db push
docker compose exec frontend node scripts/seed.js

# 8. Access the app
open http://your-server-ip:3001
```

## Environment Configuration

### Required Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |
| `APP_URL` | Public URL of the application |
| `FREELLM_BASE_URL` | FreeLLM API URL on Server 2 |
| `FREELLM_API_KEY` | FreeLLM API key |
| `FIRECRAWL_URL` | Firecrawl URL on Server 2 |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `RABBITMQ_PASSWORD` | RabbitMQ password |
| `DISCOVERY_CONCURRENCY` | Concurrent discovery jobs (default: 3) |
| `ENRICHMENT_CONCURRENCY` | Concurrent enrichment jobs (default: 2) |
| `AI_CONCURRENCY` | Concurrent AI analysis jobs (default: 2) |

### FreeLLM Configuration

```
FREELLM_BASE_URL=http://68.233.114.213:3002/v1
FREELLM_API_KEY=your-api-key
```

Leadforge uses the OpenAI-compatible `/chat/completions` endpoint.

### Firecrawl Configuration

```
FIRECRAWL_URL=http://68.233.114.213:3003
```

### Worker Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `DISCOVERY_WORKER_COUNT` | 2 | Number of discovery workers |
| `DISCOVERY_CONCURRENCY` | 3 | Concurrent discovery jobs |
| `ENRICHMENT_CONCURRENCY` | 2 | Concurrent enrichment jobs |
| `AI_CONCURRENCY` | 2 | Concurrent AI analysis jobs |
| `EXPORT_CONCURRENCY` | 1 | Concurrent export jobs |

## Resource Allocation

| Container | Memory | CPU |
|-----------|--------|-----|
| PostgreSQL | 2 GB | 2.0 |
| Redis | 512 MB | 0.5 |
| RabbitMQ | 512 MB | 0.5 |
| Frontend (App + API) | 1 GB | 1.5 |
| Worker | 1 GB | 1.0 |
| **Total** | ~5 GB | ~5.5 |

Remaining ~4-5 GB for OS and overhead on 11 GB RAM server.

## Networking

### Exposed Ports

| Port | Service | Access |
|------|---------|--------|
| 3001 | Leadforge Frontend + API | Public |
| 5432 | PostgreSQL | Internal only |
| 6379 | Redis | Internal only |
| 5672 | RabbitMQ | Internal only |

### External Connections (to Server 2)

- FreeLLM: `http://68.233.114.213:3002/v1`
- Firecrawl: `http://68.233.114.213:3003`

## Upgrade Guide

```bash
# 1. Pull latest code
cd /opt/leadforge
git pull origin main

# 2. Rebuild images
docker compose build

# 3. Run database migrations
docker compose exec frontend npx prisma db push

# 4. Restart services (zero downtime if using rolling restart)
docker compose up -d

# 5. Verify
curl http://localhost:3001/api/v1/health
```

### Rolling Restart (zero downtime)

```bash
docker compose up -d --no-deps --build frontend
# Wait for health check to pass, then:
docker compose up -d --no-deps --build worker
```

## Backup Guide

### Manual Backup

```bash
# PostgreSQL backup
docker compose exec postgres pg_dump -U leadforge leadforge | gzip > /opt/backups/leadforge_$(date +%Y%m%d_%H%M%S).sql.gz

# Or use the built-in API
curl -X POST http://localhost:3001/api/v1/optimization/backup
```

### Automated Backup (crontab)

```bash
# Add to crontab — daily at 2 AM
0 2 * * * cd /opt/leadforge && docker compose exec -T postgres pg_dump -U leadforge leadforge | gzip > /opt/backups/leadforge_$(date +\%Y\%m\%d).sql.gz
# Keep only last 30 days
0 3 * * * find /opt/backups -name "leadforge_*.sql.gz" -mtime +30 -delete
```

### Restore

```bash
# Stop the app
docker compose stop frontend worker

# Restore database
gunzip -c /opt/backups/leadforge_20260101.sql.gz | docker compose exec -T postgres psql -U leadforge leadforge

# Restart
docker compose start frontend worker
```

## Rollback Guide

```bash
# 1. Stop services
docker compose down

# 2. Revert code to previous version
git checkout <previous-commit-hash>

# 3. Restore database from backup (if needed)
gunzip -c /opt/backups/leadforge_YYYYMMDD.sql.gz | docker compose exec -T postgres psql -U leadforge leadforge

# 4. Rebuild and start
docker compose build && docker compose up -d

# 5. Run migrations to match code version
docker compose exec frontend npx prisma db push
```

## Troubleshooting

### Check Service Health

```bash
# All containers
docker compose ps

# Health endpoint
curl http://localhost:3001/api/v1/health

# Observability
curl http://localhost:3001/api/v1/observability

# Active alerts
curl http://localhost:3001/api/v1/alerts/events
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f frontend
docker compose logs -f worker
docker compose logs -f postgres

# Last 100 lines
docker compose logs --tail 100 frontend
```

### Common Issues

#### Worker Not Processing Jobs

```bash
# Check worker health
docker compose logs worker | tail -20

# Check for stuck jobs
curl -X POST http://localhost:3001/api/v1/integrity -H "Content-Type: application/json" -d '{"repair":true}'

# Restart worker
docker compose restart worker
```

#### FreeLLM Connection Failed

```bash
# Test connectivity from Server 1
curl http://68.233.114.213:3002/v1/models

# Check Leadforge can reach it
docker compose exec frontend wget -qO- http://68.233.114.213:3002/v1/models

# Verify env vars
docker compose exec frontend env | grep FREELLM
```

#### Database Issues

```bash
# Check PostgreSQL
docker compose exec postgres psql -U leadforge -c "SELECT 1"

# Run integrity checks
curl -X POST http://localhost:3001/api/v1/integrity

# Vacuum
docker compose exec postgres vacuumdb -U leadforge --all
```

#### Out of Memory

```bash
# Check memory usage
docker stats

# Reduce worker concurrency in .env
ENRICHMENT_CONCURRENCY=1
AI_CONCURRENCY=1

# Restart
docker compose up -d
```

## Maintenance

### Daily
- Check health endpoint
- Review active alerts

### Weekly
- Run data integrity checks
- Review backup status
- Check disk space: `df -h`

### Monthly
- Vacuum PostgreSQL
- Review log sizes
- Update Docker images: `docker compose pull && docker compose up -d`

### Quarterly
- Security audit
- Performance benchmark
- Backup restore test
