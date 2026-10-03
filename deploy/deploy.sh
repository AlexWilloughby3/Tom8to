#!/usr/bin/env bash
# Runs on the VM as root. Usage: deploy.sh <image-tag>
# Called by the GitHub Actions deploy job after it scp's this script and
# docker-compose.yml into /tmp.
set -euo pipefail

TAG="${1:?usage: deploy.sh <image-tag>}"
APP_DIR=/opt/tom8to
ENV_FILE="$APP_DIR/.env"

mkdir -p "$APP_DIR"
cp /tmp/docker-compose.prod.yml "$APP_DIR/docker-compose.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE does not exist. Create it from deploy/env.example first." >&2
  exit 1
fi

# `|| true` because grep exits 1 on no match, which under `set -e` would kill
# the script here with no explanation if .env were missing its TAG line.
PREVIOUS_TAG="$(grep -E '^TAG=' "$ENV_FILE" | cut -d= -f2- || true)"
if [[ -z "$PREVIOUS_TAG" ]]; then
  echo "WARNING: no TAG= line in $ENV_FILE; adding one. Rollback is unavailable for this deploy." >&2
  echo "TAG=${TAG}" >> "$ENV_FILE"
else
  sed -i "s/^TAG=.*/TAG=${TAG}/" "$ENV_FILE"
fi

cd "$APP_DIR"

# Reclaim space *before* pulling, not after a successful deploy. The boot disk
# is 10GB with ~3GB free, and each deploy lands ~420MB of new images, so the
# old "only prune images older than 168h" window let roughly seven deploys
# fill the disk with nothing eligible for removal. And once the disk is full
# `docker compose pull` is the step that fails — so a prune placed after a
# successful pull could never run at the moment it was actually needed.
# Images backing running containers are never pruned, and if a rollback target
# does get reaped, `docker compose up` re-pulls it from Artifact Registry.
docker image prune -af --filter "until=24h" || true
echo "Disk after prune: $(df -h --output=avail / | tail -1 | tr -d ' ') available"

docker compose pull
docker compose up -d --remove-orphans

echo "Waiting for the api container to report healthy..."
ok=false
for _ in $(seq 1 30); do
  if docker compose exec -T api python -c "
import urllib.request
urllib.request.urlopen('http://localhost:8000/api/health', timeout=2)
" >/dev/null 2>&1; then
    ok=true
    break
  fi
  sleep 2
done

if [[ "$ok" == true ]]; then
  echo "Deploy of ${TAG} succeeded."
  exit 0
fi

echo "Deploy of ${TAG} FAILED health check." >&2
docker compose logs --tail=100 api >&2 || true

# `latest` is the placeholder from env.example and was never pushed, so on a
# first deploy there is nothing to roll back to — leave the broken-but-known
# tag in place rather than swapping in an image that cannot be pulled.
if [[ -z "$PREVIOUS_TAG" || "$PREVIOUS_TAG" == "latest" || "$PREVIOUS_TAG" == "$TAG" ]]; then
  echo "No previous image tag to roll back to (was '${PREVIOUS_TAG}'). Leaving ${TAG} deployed; fix forward." >&2
  exit 1
fi

echo "Rolling back to ${PREVIOUS_TAG}." >&2
sed -i "s/^TAG=.*/TAG=${PREVIOUS_TAG}/" "$ENV_FILE"
docker compose up -d --remove-orphans
exit 1
