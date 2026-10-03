#!/usr/bin/env bash
# One-time, idempotent VM bootstrap. Run on tom8tovm as root:
#   sudo bash setup-vm.sh us-central1
set -euo pipefail

REGION="${1:?usage: setup-vm.sh <region>}"
APP_DIR=/opt/tom8to

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y unattended-upgrades ca-certificates curl
dpkg-reconfigure -f noninteractive unattended-upgrades

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{"log-driver": "local"}
EOF
systemctl restart docker

if [[ ! -f /swapfile ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
  echo "vm.swappiness=10" > /etc/sysctl.d/99-swappiness.conf
  sysctl -p /etc/sysctl.d/99-swappiness.conf
fi

if ! command -v gcloud >/dev/null 2>&1; then
  snap install google-cloud-cli --classic
fi
# snap binaries land in /snap/bin, which cron and some shells don't have on
# PATH by default — the docker credential helper needs `gcloud` findable.
ln -sf /snap/bin/gcloud /usr/local/bin/gcloud
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

mkdir -p "$APP_DIR"
chmod 700 "$APP_DIR"

echo "Done. Next: create $APP_DIR/.env (mode 600) from deploy/env.example before the first deploy."
