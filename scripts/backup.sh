#!/usr/bin/env bash
# Daily Waifu Bot database backup.
# Usage: ./scripts/backup.sh
# Cron example: 0 3 * * * /opt/bot/scripts/backup.sh >> /var/log/waifu-backup.log 2>&1
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
PG_HOST="${PGHOST:-localhost}"
PG_PORT="${PGPORT:-5432}"
PG_USER="${PGUSER:-waifu_user}"
PG_DB="${PGDATABASE:-discord_waifu}"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump not found in PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

timestamp="$(date +%Y-%m-%d_%H-%M)"
filename="${PG_DB}_${timestamp}.sql.gz"
filepath="${BACKUP_DIR}/${filename}"

pg_dump \
  --host="$PG_HOST" \
  --port="$PG_PORT" \
  --username="$PG_USER" \
  --dbname="$PG_DB" \
  --format=custom \
  --compress=9 \
  --no-owner \
  --file="$filepath"

echo "Backup OK: $filepath"

find "$BACKUP_DIR" -type f -name "${PG_DB}_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete
echo "Retention cleanup applied: older than ${RETENTION_DAYS} days removed"
