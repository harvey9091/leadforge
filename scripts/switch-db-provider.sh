#!/bin/sh
# =============================================================================
# Prisma provider switcher — used during Docker build
# =============================================================================
# Swaps the Prisma datasource provider from SQLite (dev) to PostgreSQL (prod)
# =============================================================================

SCHEMA_FILE="prisma/schema.prisma"

if [ "$1" = "postgresql" ]; then
  echo "→ Switching Prisma provider to PostgreSQL..."
  sed -i 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA_FILE"
  echo "  ✓ Provider set to postgresql"
elif [ "$1" = "sqlite" ]; then
  echo "→ Switching Prisma provider to SQLite..."
  sed -i 's/provider = "postgresql"/provider = "sqlite"/' "$SCHEMA_FILE"
  echo "  ✓ Provider set to sqlite"
else
  echo "Usage: $0 [postgresql|sqlite]"
  exit 1
fi
