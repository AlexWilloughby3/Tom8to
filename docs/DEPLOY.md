# Deploying Tom8to

## Architecture

One GCP VM (`tom8tovm`, e2-medium, `us-central1-a`) runs three containers via
Docker Compose:

- **web** — Caddy, serving the built frontend as static files and reverse-
  proxying `/api/*` to the api container. Plain HTTP, no published ports.
- **cloudflared** — Cloudflare Tunnel. Dials out to Cloudflare and carries
  all public traffic to `web`. TLS terminates at Cloudflare's edge, so there
  are no certificates on the VM and no inbound 80/443 in the firewall — the
  VM's IP never appears in DNS and nothing answers on it.
- **api** — FastAPI, built from `backend/Dockerfile`.
- **db** — Postgres 16, data on the `pgdata` named volume. Not exposed
  outside the VM.

GitHub Actions builds both images, pushes them to Artifact Registry, then
SSHes into the VM (via IAP, no public SSH, no long-lived keys) to pull and
restart. Auth from GitHub to GCP uses Workload Identity Federation — no
service-account JSON key ever leaves Google.

Project: `project-b34fa6f3-390d-413d-8fb` ("My First Project" — shared with
other personal projects; Tom8to's CI/CD service account and WIF provider are
scoped only to this repo, so a compromised workflow elsewhere can't deploy
Tom8to and vice versa).

## One-time setup

1. From your laptop, with `gcloud` authenticated and `gcloud config set
   project project-b34fa6f3-390d-413d-8fb`:
   ```bash
   PROJECT_ID=project-b34fa6f3-390d-413d-8fb bash deploy/gcp-setup.sh
   ```
   This creates the Artifact Registry repo, a dedicated
   `tom8to-deploy` service account, a WIF provider scoped to
   `AlexWilloughby3/Tom8to`, an IAP-only SSH firewall rule, a static IP
   (promoted from the VM's existing ephemeral address), and a weekly
   snapshot schedule. It's idempotent — safe to re-run.
2. Add the five printed values as **repo variables** (not secrets) under
   GitHub Settings → Secrets and variables → Actions → Variables:
   `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_ZONE`, `GCP_WIF_PROVIDER`,
   `GCP_DEPLOY_SA`.
3. SSH into the VM once via IAP to confirm it works before locking anything
   down: `gcloud compute ssh tom8tovm --zone=us-central1-a --tunnel-through-iap`.
   Then, only once that works:
   ```bash
   gcloud compute firewall-rules delete default-allow-ssh default-allow-rdp
   ```
   (`gcp-setup.sh` deliberately does not do this automatically — don't close
   the default rules until you've verified the IAP path works, or you can
   lock yourself out.)
4. On the VM: `sudo bash deploy/setup-vm.sh us-central1`
   (installs Docker and a 2 GB swapfile). The weekly disk snapshot schedule
   from `gcp-setup.sh` is the only backup mechanism right now — there's no
   separate `pg_dump`-to-bucket backup (deliberately dropped for now; add
   one later if you want point-in-time restores narrower than a week).
5. Create `/opt/tom8to/.env` on the VM (mode 600) from `deploy/env.example`,
   filling in real `POSTGRES_PASSWORD`, `SMTP_*` and `TUNNEL_TOKEN` values
   (see "Cloudflare Tunnel" below for the token).
6. Push to `main` (or run the workflow manually) for the first deploy.

## Migrating data from the old AWS EC2 box

On the EC2 instance:
```bash
docker exec postgres_db pg_dump -U postgres --no-owner --no-privileges app_db | gzip > tom8to.sql.gz
scp tom8to.sql.gz <laptop>:
```
On the new VM, after the first deploy has created the schema:
```bash
cd /opt/tom8to
docker compose stop api
docker compose exec -T db psql -U postgres -d app_db -c \
  "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
gunzip -c tom8to.sql.gz | docker compose exec -T db psql -U postgres -d app_db
docker compose start api
```

## Cloudflare Tunnel

1. Cloudflare Zero Trust → Networks → Tunnels → create a `cloudflared`
   tunnel named `tom8to`. Copy the token (the long string after `--token`
   in the install command it shows) into `TUNNEL_TOKEN` in
   `/opt/tom8to/.env`. Don't run the install command itself — the
   `cloudflared` container in the compose file is the connector.
2. Deploy, so the `cloudflared` container is running (the tunnel shows
   **Healthy** in the dashboard).
3. In Cloudflare DNS, delete any existing `tomato` A record — the next step
   fails with "record already exists" otherwise.
4. On the tunnel, add a public hostname:
   - Subdomain `tomato`, domain `alex-ware.com`, path empty
   - Service type `HTTP`, URL `tom8to_web:80`

   Cloudflare creates the proxied CNAME itself.
5. Make sure no firewall rule allows 80/443 to the VM:
   ```bash
   gcloud compute firewall-rules delete tom8to-allow-web
   ```

To host another app on this VM: put its container on the `edge` Docker
network (declared `external: true` in that app's compose file) and add
another public hostname on the same tunnel pointing at
`http://<container-name>:<port>`.

## Decommissioning AWS (after a few days of stable GCP traffic)

- Terminate the EC2 instance, release the Elastic IP, delete the security
  group and key pair.
- Revoke the GitHub deploy key that was used for `git pull` on the old box.
- Revoke the Cloudflare origin certificate (`carl2.pem`/`carl3private.pem`).
- Rotate/delete the old Gmail app password used by `email_service.py`, and
  set a fresh one in the new VM's `.env`.

## Everyday operations

```bash
# Tail logs
gcloud compute ssh tom8tovm --zone=us-central1-a --tunnel-through-iap \
  --command="cd /opt/tom8to && sudo docker compose logs -f api"

# Manual deploy of a specific image tag (rollback)
gcloud compute ssh tom8tovm --zone=us-central1-a --tunnel-through-iap \
  --command="sudo bash /opt/tom8to/deploy.sh <git-sha>"
```

## Restoring from a snapshot

The weekly snapshot schedule (`tom8to-weekly`, from `gcp-setup.sh`) snapshots
the VM's boot disk, keeping 28 days. To restore: create a new disk from a
snapshot (`gcloud compute disks create ... --source-snapshot=...`), attach
it to the VM (or a new one) in place of the current boot disk, and restart.
This rolls back everything on the disk, not just the database — there's no
narrower point-in-time restore until a dedicated `pg_dump` backup is added.
