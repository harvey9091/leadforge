#!/bin/bash
# =============================================================================
# Leadforge — Database Restore Script
# =============================================================================
#
# Restores the database from a backup file.
# Usage: ./scripts/backup/restore.sh <backup_file>
# =============================================================================

set -e

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file>"
  echo "Available backups:"
  ls -lt ./download/backups/leadforge_*.sql.gz 2>/dev/null | head -10
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "✗ Backup file not found: $BACKUP_FILE"
  exit 1
fi

echo "→ Restoring from: $BACKUP_FILE"

# Verify checksum if .sha256 exists
if [ -f "$BACKUP_FILE.sha256" ]; then
  echo "→ Verifying checksum..."
  if sha256sum -c "$BACKUP_FILE.sha256" 2>/dev/null; then
    echo "  ✓ Checksum verified"
  else
    echo "  ✗ Checksum verification failed!"
    exit 1
  fi
fi

if [[ "$DATABASE_URL" == *"postgresql://"* ]]; then
  echo "  Database: PostgreSQL"
  gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"
else
  echo "  Database: SQLite"
  if [[ "$DATABASE_URL" == *"file:"* ]]; then
    DB_PATH="${DATABASE_URL#file:}"
    cp "$BACKUP_FILE" "$DB_PATH"
  fi
fi

echo "→ Restore complete."
