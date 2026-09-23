#!/usr/bin/env bash
# Trigger Cloudflare Pages rebuild when the Git App webhook did not fire
# (typical after Contents-API commits).
set -euo pipefail

if [[ -z "${CF_PAGES_DEPLOY_HOOK:-}" ]]; then
  echo "CF_PAGES_DEPLOY_HOOK is empty." >&2
  echo "Dashboard → Pages → realsyncdynamics-ai → Settings → Deploy hooks" >&2
  exit 1
fi

code=$(curl -sS -o /tmp/cf-hook-body -w "%{http_code}" -X POST "$CF_PAGES_DEPLOY_HOOK")
body=$(cat /tmp/cf-hook-body 2>/dev/null || true)
echo "HTTP $code"
echo "$body"
if [[ "$code" != "200" && "$code" != "201" && "$code" != "202" ]]; then
  exit 1
fi
