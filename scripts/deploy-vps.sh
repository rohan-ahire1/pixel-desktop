#!/usr/bin/env bash
# Deploy the site to rohanahire.com on the VPS (ssh host "server", or DEPLOY_HOST).
# Backs up the live files first, then syncs only what visitors need. Run on the VPS, it works locally.
set -euo pipefail
cd "$(dirname "$0")/.."
host="${DEPLOY_HOST:-server}"
live=/var/www/rohanahire.com
backup="$HOME/backups/rohanahire.com-$(date +%Y%m%d%H%M%S)"
exclude=(--exclude .git --exclude .factory --exclude .claude --exclude .github --exclude .impeccable --exclude .DS_Store
  --exclude docs --exclude scripts --exclude tests --exclude node_modules --exclude _v1 --exclude README.md --exclude AGENTS.md --exclude CLAUDE.md --exclude factory.json)
if [ "$(hostname)" = "$host" ]; then
  mkdir -p "$HOME/backups" && cp -a "$live" "$backup"
  rsync -a --delete "${exclude[@]}" ./ "$live/"
else
  ssh "$host" "mkdir -p ~/backups && cp -a $live ~/backups/rohanahire.com-$(date +%Y%m%d%H%M%S)"
  rsync -a --delete "${exclude[@]}" ./ "$host:$live/"
fi
echo "Deployed. Backup is in ~/backups on $host."
