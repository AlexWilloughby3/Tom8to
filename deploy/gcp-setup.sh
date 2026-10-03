#!/usr/bin/env bash
# One-time, idempotent setup from your laptop. Assumes the VM (tom8tovm)
# already exists — this script wires up Artifact Registry, a dedicated
# CI/CD service account, Workload Identity Federation for GitHub Actions,
# an IAP-only SSH firewall rule, and a weekly disk snapshot schedule.
# Safe to re-run.
#
# Usage: PROJECT_ID=project-b34fa6f3-390d-413d-8fb bash deploy/gcp-setup.sh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?set PROJECT_ID}"
REGION="${REGION:-us-central1}"
ZONE="${ZONE:-us-central1-a}"
VM_NAME="${VM_NAME:-tom8tovm}"
GITHUB_REPO="${GITHUB_REPO:-AlexWilloughby3/Tom8to}"
REPO_NAME="tom8to"
POOL_ID="github-pool"
PROVIDER_ID="tom8to-provider"
SA_ID="tom8to-deploy"
SA_EMAIL="${SA_ID}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project "$PROJECT_ID" >/dev/null

echo "== Enabling APIs =="
gcloud services enable \
  compute.googleapis.com \
  artifactregistry.googleapis.com \
  iap.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com

echo "== Artifact Registry repo =="
if ! gcloud artifacts repositories describe "$REPO_NAME" --location="$REGION" >/dev/null 2>&1; then
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$REGION"
else
  echo "repo $REPO_NAME already exists, skipping"
fi

POLICY_FILE="$(mktemp)"
cat > "$POLICY_FILE" <<'EOF'
[
  {
    "name": "keep-recent",
    "action": {"type": "Keep"},
    "mostRecentVersions": {"keepCount": 10}
  }
]
EOF
gcloud artifacts repositories set-cleanup-policies "$REPO_NAME" \
  --location="$REGION" \
  --policy="$POLICY_FILE"
rm -f "$POLICY_FILE"

echo "== Deploy service account =="
if ! gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_ID" --display-name="Tom8to CI/CD deploy"
  # Freshly created service accounts take a few seconds to propagate to other
  # APIs (Artifact Registry, Resource Manager) — binding a role immediately
  # after creation reliably 400s with "does not exist" otherwise.
  echo "waiting for service account to propagate..."
  for _ in $(seq 1 15); do
    gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1 && break
    sleep 2
  done
  sleep 5
else
  echo "service account $SA_EMAIL already exists, skipping"
fi

gcloud artifacts repositories add-iam-policy-binding "$REPO_NAME" \
  --location="$REGION" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/artifactregistry.writer" >/dev/null

# The VM pulls images as its *own* attached service account, which is a
# different identity from the CI deployer above — it needs read access or
# `docker compose pull` fails on the VM even though the push succeeded.
VM_SA="$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" \
  --format='value(serviceAccounts[0].email)')"
gcloud artifacts repositories add-iam-policy-binding "$REPO_NAME" \
  --location="$REGION" \
  --member="serviceAccount:${VM_SA}" \
  --role="roles/artifactregistry.reader" >/dev/null

for ROLE in roles/iap.tunnelResourceAccessor roles/compute.viewer roles/compute.osAdminLogin; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --condition=None >/dev/null
done

# roles/compute.osAdminLogin only grants sudo through OS Login's own SSH-key
# flow — without OS Login switched on, gcloud instead falls back to writing
# SSH keys straight into instance/project metadata, which this SA has no
# permission to do (and shouldn't need).
CURRENT_OSLOGIN="$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" \
  --format='value(metadata.items.filter("key:enable-oslogin").extract("value").flatten())' 2>/dev/null)"
if [[ "$CURRENT_OSLOGIN" != "TRUE" ]]; then
  gcloud compute instances add-metadata "$VM_NAME" --zone="$ZONE" --metadata=enable-oslogin=TRUE
else
  echo "OS Login already enabled on $VM_NAME, skipping"
fi

gcloud iam service-accounts add-iam-policy-binding "$VM_SA" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/iam.serviceAccountUser" >/dev/null

echo "== Static IP (promoting the VM's existing ephemeral address) =="
if ! gcloud compute addresses describe tom8to-ip --region="$REGION" >/dev/null 2>&1; then
  CURRENT_IP="$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" \
    --format='value(networkInterfaces[0].accessConfigs[0].natIP)')"
  gcloud compute addresses create tom8to-ip --region="$REGION" --addresses="$CURRENT_IP"
  echo "Reserved $CURRENT_IP as static — point DNS at this."
else
  echo "tom8to-ip already reserved, skipping"
fi

echo "== Network tag + firewall =="
CURRENT_TAGS="$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --format='value(tags.items)')"
if [[ "$CURRENT_TAGS" != *web* ]]; then
  gcloud compute instances add-tags "$VM_NAME" --zone="$ZONE" --tags=web
else
  echo "VM already tagged 'web', skipping"
fi

# No 80/443 rule on purpose: web traffic arrives over the Cloudflare Tunnel,
# which is an outbound connection from the VM. The only inbound rule is IAP SSH.

if ! gcloud compute firewall-rules describe tom8to-allow-iap-ssh >/dev/null 2>&1; then
  gcloud compute firewall-rules create tom8to-allow-iap-ssh \
    --direction=INGRESS --action=ALLOW --rules=tcp:22 \
    --source-ranges=35.235.240.0/20 --target-tags=web
else
  echo "firewall rule tom8to-allow-iap-ssh already exists, skipping"
fi

echo "== Workload Identity Federation (dedicated to this repo) =="
if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" \
  --workload-identity-pool="$POOL_ID" --location=global >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --workload-identity-pool="$POOL_ID" \
    --location=global \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository == '${GITHUB_REPO}'"
else
  echo "provider $PROVIDER_ID already exists, skipping"
fi

PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository/${GITHUB_REPO}" >/dev/null

echo "== Weekly snapshot schedule =="
if ! gcloud compute resource-policies describe tom8to-weekly --region="$REGION" >/dev/null 2>&1; then
  gcloud compute resource-policies create snapshot-schedule tom8to-weekly \
    --region="$REGION" \
    --max-retention-days=28 \
    --weekly-schedule=sunday --start-time=07:00
  BOOT_DISK="$(gcloud compute instances describe "$VM_NAME" --zone="$ZONE" --format='value(disks[0].source.basename())')"
  gcloud compute disks add-resource-policies "$BOOT_DISK" --zone="$ZONE" --resource-policies=tom8to-weekly
else
  echo "snapshot schedule tom8to-weekly already exists, skipping"
fi

cat <<EOF

== Done. GitHub repo variables (Settings > Secrets and variables > Actions > Variables) ==
GCP_PROJECT_ID = ${PROJECT_ID}
GCP_REGION     = ${REGION}
GCP_ZONE       = ${ZONE}
GCP_WIF_PROVIDER = projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}
GCP_DEPLOY_SA  = ${SA_EMAIL}
EOF

# Deleting these is left manual on purpose: closing them before confirming the
# IAP path works can lock you out of the VM entirely.
if gcloud compute firewall-rules describe default-allow-ssh >/dev/null 2>&1 ||
   gcloud compute firewall-rules describe default-allow-rdp >/dev/null 2>&1; then
  cat <<EOF

NOT done automatically — SSH/RDP are still open to the whole internet.
Once 'gcloud compute ssh ${VM_NAME} --zone=${ZONE} --tunnel-through-iap' works:
  gcloud compute firewall-rules delete default-allow-ssh default-allow-rdp
EOF
fi
