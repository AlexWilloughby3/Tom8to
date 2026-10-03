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

PREVIOUS_TAG="$(grep -E '^TAG=' "$ENV_FILE" | cut -d= -f2-)"
sed -i "s/^TAG=.*/TAG=${TAG}/" "$ENV_FILE"

cd "$APP_DIR"
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
  docker image prune -af --filter "until=168h"
  exit 0
fi

echo "Deploy of ${TAG} FAILED health check. Rolling back to ${PREVIOUS_TAG}." >&2
docker compose logs --tail=100 api >&2 || true
sed -i "s/^TAG=.*/TAG=${PREVIOUS_TAG}/" "$ENV_FILE"
docker compose up -d --remove-orphans
exit 1
