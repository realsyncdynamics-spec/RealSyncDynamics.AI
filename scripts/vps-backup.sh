#!/usr/bin/env bash
# VPS-side backup. Runs daily via .github/workflows/vps-backup.yml; can be
# invoked manually with `bash /tmp/vps-backup.sh`.
#
# Backs up:
#   - /var/www/realsyncdynamicsai.de  (current frontend dist + assets)
#   - /etc/nginx                      (vhost + tls config)
#   - /opt/realsync/deploy            (compose files for the kodee/ollama stack)
#
# Skips:
#   - node_modules, dist build artifacts that can be rebuilt deterministically
#   - secrets directories (/etc/letsencrypt, /opt/realsync/secrets) — those
#     are restored from the GitHub-secrets pipeline on rebuild, not from
#     server snapshots
#
# Output: /var/backups/realsyncdynamicsai/rsd-YYYYMMDD-HHMM.tar.gz
# Retention: 7 daily snapshots; older files pruned at the end of each run.

set -euo pipefail

BACKUP_ROOT="/var/backups/realsyncdynamicsai"
TIMESTAMP="$(date -u +%Y%m%d-%H%M)"
ARCHIVE="${BACKUP_ROOT}/rsd-${TIMESTAMP}.tar.gz"
RETENTION_DAYS=7

mkdir -p "$BACKUP_ROOT"

# Sources to include — each is optional; missing paths are silently skipped so
# the script doesn't fail on a fresh VPS that hasn't been fully provisioned.
INCLUDES=()
for path in \
    /var/www/realsyncdynamicsai.de \
    /etc/nginx \
    /opt/realsync/deploy \
; do
    if [ -e "$path" ]; then
        INCLUDES+=("$path")
    fi
done

if [ ${#INCLUDES[@]} -eq 0 ]; then
    echo "WARN: no expected backup sources found on this VPS — bailing"
    exit 0
fi

echo "Backing up ${#INCLUDES[@]} source(s) → $ARCHIVE"
tar \
    --exclude='*/node_modules' \
    --exclude='*/.cache' \
    --exclude='*/letsencrypt/archive/*/privkey*.pem' \
    -czf "$ARCHIVE" "${INCLUDES[@]}"

# Sanity-check archive isn't truncated
if ! tar -tzf "$ARCHIVE" > /dev/null; then
    echo "ERROR: archive failed integrity check"
    rm -f "$ARCHIVE"
    exit 1
fi

SIZE_HUMAN="$(du -h "$ARCHIVE" | cut -f1)"
echo "OK: $ARCHIVE ($SIZE_HUMAN)"

# Rotate — keep last RETENTION_DAYS files
find "$BACKUP_ROOT" -maxdepth 1 -name 'rsd-*.tar.gz' -mtime "+${RETENTION_DAYS}" -print -delete \
    | sed 's/^/Pruned: /'

echo "Backup complete · ${TIMESTAMP} UTC"
