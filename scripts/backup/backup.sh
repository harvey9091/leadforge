#!/bin/bash
# =============================================================================
# Leadforge — Database Backup Script
# =============================================================================
#
# Creates a full backup of the PostgreSQL database.
# Usage: ./scripts/backup/backup.sh [output_dir]
#
# In production (Docker Compose), run via:
#   docker compose exec postgres pg_dump -U leadforge leadforge | gzip > backup.sql.gz
# =============================================================================

set -e

OUTPUT_DIR="${1:-./download/backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$OUTPUT_DIR/leadforge_$TIMESTAMP.sql.gz"

mkdir -p "$OUTPUT_DIR"

echo "→ Starting Leadforge database backup..."

# Check if we're using SQLite or PostgreSQL
if [[ "$DATABASE_URL" == *"postgresql://"* ]]; then
  echo "  Database: PostgreSQL"
  pg_dump "$DATABASE_URL" | gzip > "$BACKUP_FILE"
else
  echo "  Database: SQLite"
  if [[ "$DATABASE_URL" == *"file:"* ]]; then
    DB_PATH="${DATABASE_URL#file:}"
    if [ -f "$DB_PATH" ]; then
      cp "$DB_PATH" "$BACKUP_FILE"
    else
      echo "  ✗ Database file not found: $DB_PATH"
      exit 1
    fi
  else
    echo "  ✗ Unknown database URL format"
    exit 1
  fi
fi

FILESIZE=$(stat -c%s "$BACKUP_FILE" 2>/dev/null || stat -f%z "$BACKUP_FILE" 2>/dev/null || echo "0")
CHECKSUM=$(sha256sum "$BACKUP_FILE" | awk '{print $1}')

echo "  ✓ Backup created: $BACKUP_FILE"
echo "  ✓ Size: $(( FILESIZE / 1024 )) KB"
echo "  ✓ Checksum: ${CHECKSUM:0:16}..."

# Clean up old backups (keep last 30)
echo "→ Cleaning up old backups (keeping last 30)..."
ls -t "$OUTPUT_DIR"/leadforge_*.sql.gz 2>/dev/null | tail -n +31 | xargs rm -f 2>/dev/null || true

echo "→ Backup complete."
