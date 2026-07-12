# Setup Guide

## Local Development

### Prerequisites

- [Bun](https://bun.sh/) 1.1+ (recommended) or Node.js 20+
- 4GB RAM available

### Steps

```bash
# 1. Clone the repository
git clone <repo-url> leadforge
cd leadforge

# 2. Install dependencies
bun install

# 3. Set up the database
# The dev environment uses SQLite — no Docker required for the database.
bun run db:push      # creates tables from prisma/schema.prisma
bun run db:seed      # creates admin user + 60 demo companies + 6 campaigns + 40 jobs

# 4. Start the dev server
bun run dev
# → http://localhost:3000

# 5. Log in with demo credentials
# Email: admin@leadforge.local
# Password: Leadforge123
```

### With real PostgreSQL (optional)

If you want to develop against real PostgreSQL instead of SQLite:

```bash
# 1. Start the dev data services
docker compose -f docker-compose.dev.yml up -d

# 2. Update .env
echo 'DATABASE_URL=postgresql://leadforge:leadforge_dev@localhost:5432/leadforge_dev' > .env

# 3. Push schema + seed
bun run db:push
bun run db:seed

# 4. Start the app
bun run dev
```

RabbitMQ management UI is at http://localhost:15672 (leadforge / leadforge_dev).

---

## Production Deployment (Oracle Cloud)

### Prerequisites

- Oracle Cloud VM (Ampere A1 or similar, 4 OCPU / 24GB RAM recommended)
- Docker + Docker Compose installed
- A domain name pointing to the VM's public IP
- Ports 80 + 443 open in the Oracle Cloud security list

### Steps

```bash
# 1. SSH into the VM
ssh ubuntu@your-vm-ip

# 2. Clone the repo
git clone <repo-url> /opt/leadforge
cd /opt/leadforge

# 3. Configure environment
cp .env.example .env
nano .env
# Set:
#   APP_URL=https://your-domain.com
#   JWT_SECRET=$(openssl rand -base64 48)
#   POSTGRES_PASSWORD=$(openssl rand -base64 24)
#   RABBITMQ_PASSWORD=$(openssl rand -base64 24)
#   SEED_ON_BOOT=true  (first deploy only)

# 4. Edit the Caddyfile to use your domain
nano docker/Caddyfile
# Replace leadforge.example.com with your domain

# 5. Boot the stack
docker compose --env-file .env up -d

# 6. Verify health
curl https://your-domain.com/api/v1/health
# → {"data":{"status":"healthy",...}}

# 7. (First deploy) seed the database
docker compose exec dashboard bun run db:seed
# → creates admin user (admin@leadforge.local / Leadforge123)
# → CHANGE THIS PASSWORD IMMEDIATELY after first login

# 8. Visit your app
open https://your-domain.com
```

### Post-deploy checklist

- [ ] Change the admin password
- [ ] Configure SMTP relay (Phase 2)
- [ ] Set up backup cron for PostgreSQL:
  ```bash
  docker compose exec postgres pg_dump -U leadforge leadforge | gzip > /backups/leadforge-$(date +%F).sql.gz
  ```
- [ ] Monitor disk space (Postgres + Redis + RabbitMQ volumes grow over time)
- [ ] Set up log rotation (Caddy access logs)

---

## Upgrading

```bash
# Pull latest
cd /opt/leadforge
git pull

# Rebuild + restart
docker compose build
docker compose up -d

# Run any new migrations
docker compose exec dashboard bun run db:push
```

## Backups

### PostgreSQL

```bash
# Backup
docker compose exec postgres pg_dump -U leadforge leadforge | gzip > backup-$(date +%F).sql.gz

# Restore
gunzip -c backup-2026-01-01.sql.gz | docker compose exec -T postgres psql -U leadforge leadforge
```

### Volumes

```bash
# All persistent data
docker compose down  # stop services first
tar czf volumes-$(date +%F).tar.gz postgres-data redis-data rabbitmq-data
```
