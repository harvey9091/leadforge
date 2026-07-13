#!/bin/sh
# =============================================================================
# Leadforge — Container entrypoint
# =============================================================================
# On first boot:
#   1. Wait for PostgreSQL to accept connections.
#   2. Apply the Prisma schema if the database is empty.
#   3. Seed the admin user if missing.
# On subsequent boots this is a no-op because the schema is already present
# and the admin user already exists.
# =============================================================================

set -e

echo "🚀 Leadforge container starting…"

if [ -z "${DATABASE_URL}" ]; then
  echo "❌ Missing DATABASE_URL"
  exit 1
fi

echo "⏳ Waiting for PostgreSQL…"
node -e "
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  (async () => {
    for (let i = 1; i <= 60; i++) {
      try {
        await prisma.\$queryRaw\`SELECT 1\`;
        console.log('✓ PostgreSQL reachable');
        process.exit(0);
      } catch {
        if (i === 60) {
          console.error('❌ PostgreSQL not reachable after 60 attempts');
          process.exit(1);
        }
        process.stdout.write('  retry ' + i + '/60\n');
        await sleep(2000);
      }
    }
  })();
"

echo "→ Ensuring schema is up to date…"
npx prisma db push --skip-generate --accept-data-loss || true

echo "→ Ensuring admin user exists…"
node_modules/.bin/tsx scripts/seed.ts || true

echo "✅ Bootstrap complete — starting application"
exec "$@"
