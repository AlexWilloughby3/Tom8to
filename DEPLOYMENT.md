# Deployment Guide

This document explains how to deploy the Focus Tracker application to EC2 using the new git-based deployment strategy.

## Architecture

### Secrets Management

Secrets are stored **outside the repository** to keep them secure:

- **Local (Mac)**: `../AppForDadSecrets/`
  - Contains: `.env`, `Carl.pem`, `carl2.pem`, `carl3private.pem`
  - Symlinked to `./secrets/` for local development

- **EC2**: `~/secrets/`
  - Contains: `.env`, `carl2.pem`, `carl3private.pem`
  - Symlinked from `~/focus-tracker/secrets/` to `~/secrets/`

### Deployment Strategy

Instead of copying files to EC2, we now use **git pull** for deployments. This allows for:
- Faster deployments (only changed files are transferred)
- Selective container rebuilds (docker-compose only rebuilds changed services)
- Better version control and rollback capabilities
- Easier debugging (you can SSH to EC2 and see exact code state)

## Initial Setup

### 1. Set up Local Secrets Directory

Your secrets should already be in `../AppForDadSecrets/`. Verify:

```bash
ls -la ../AppForDadSecrets/
# Should contain: .env, Carl.pem, carl2.pem, carl3private.pem
```

The repository has a symlink `secrets/` → `../AppForDadSecrets/` for local development.

### 2. Update Git Repository URL

Edit [setup-ec2.sh](setup-ec2.sh) and update the `GIT_REPO` variable:

```bash
GIT_REPO="https://github.com/YOUR_USERNAME/YOUR_REPO.git"
```

Replace with your actual GitHub repository URL.

### 3. Run Initial Setup

**IMPORTANT**: Only run this once for initial setup:

```bash
./setup-ec2.sh
```

This script will:
1. Create `~/secrets/` directory on EC2
2. Copy secrets from `../AppForDadSecrets/` to EC2
3. Install required software (git, Node.js, Docker)
4. Clone your repository to `~/focus-tracker/`
5. Create symlink from `~/focus-tracker/secrets/` to `~/secrets/`
6. Build frontend and start Docker containers

## Regular Deployment

After initial setup, deploy updates with:

```bash
./deploy-to-ec2.sh
```

This script:
1. SSHs to EC2
2. Runs `git pull` to get latest code
3. Builds frontend (`npm install && npm run build`)
4. Runs `docker-compose up -d --build`
   - Only rebuilds containers with changed code
   - Database container won't rebuild if only API/frontend changed

## Manual Deployment (from EC2)

You can also SSH to EC2 and deploy manually:

```bash
# SSH to EC2
ssh -i ../AppForDadSecrets/Carl.pem ec2-user@107.21.171.155

# Navigate to project
cd ~/focus-tracker

# Pull latest code
git pull

# Build frontend
cd frontend
npm install
npm run build
cd ..

# Restart containers (only rebuilds changed services)
docker-compose up -d --build

# Check status
docker-compose ps
```

## Selective Service Rebuilds

Docker Compose is smart about rebuilds:

```bash
# Rebuild only API (if backend code changed)
docker-compose up -d --build api

# Rebuild only frontend (if nginx config changed)
docker-compose up -d --build frontend

# Restart database (without rebuild)
docker-compose restart db

# View logs for specific service
docker-compose logs -f api
```

## Directory Structure

```
App for Dad/                 # Repository root
├── secrets/                 # Symlink to ../AppForDadSecrets/
├── .env.example            # Example environment variables (checked in)
├── docker-compose.yml      # References ./secrets/.env and ./secrets/*.pem
├── setup-ec2.sh            # One-time setup script
├── deploy-to-ec2.sh        # Regular deployment script
├── backend/
│   └── app/
└── frontend/
    └── dist/               # Built frontend (created by npm run build)

../AppForDadSecrets/        # Outside repository (NOT checked in)
├── .env                    # Database credentials
├── Carl.pem                # SSH key for EC2
├── carl2.pem               # SSL certificate
└── carl3private.pem        # SSL private key

EC2: ~/focus-tracker/       # Git repository clone
├── secrets/                # Symlink to ~/secrets/
├── backend/
└── frontend/

EC2: ~/secrets/             # Secrets directory
├── .env
├── carl2.pem
└── carl3private.pem
```

## Troubleshooting

### Containers won't start

```bash
# Check logs
ssh -i ../AppForDadSecrets/Carl.pem ec2-user@107.21.171.155
cd ~/focus-tracker
docker-compose logs

# Specific service
docker-compose logs api
```

### Secrets not found

```bash
# Verify secrets exist on EC2
ssh -i ../AppForDadSecrets/Carl.pem ec2-user@107.21.171.155
ls -la ~/secrets/

# Verify symlink
ls -la ~/focus-tracker/secrets
```

### Frontend not building

```bash
# SSH to EC2 and build manually
ssh -i ../AppForDadSecrets/Carl.pem ec2-user@107.21.171.155
cd ~/focus-tracker/frontend
npm install
npm run build
```

### Permission denied errors

```bash
# Make sure you're in the docker group
ssh -i ../AppForDadSecrets/Carl.pem ec2-user@107.21.171.155
groups
# Should include "docker"

# If not, log out and back in, or run:
newgrp docker
```

## Updating Secrets

If you need to update secrets on EC2:

```bash
# Copy new .env
scp -i ../AppForDadSecrets/Carl.pem ../AppForDadSecrets/.env ec2-user@107.21.171.155:~/secrets/

# Copy new SSL certificates
scp -i ../AppForDadSecrets/Carl.pem ../AppForDadSecrets/carl2.pem ec2-user@107.21.171.155:~/secrets/
scp -i ../AppForDadSecrets/Carl.pem ../AppForDadSecrets/carl3private.pem ec2-user@107.21.171.155:~/secrets/

# Restart containers to pick up changes
ssh -i ../AppForDadSecrets/Carl.pem ec2-user@107.21.171.155 'cd ~/focus-tracker && docker-compose restart'
```

## Security Notes

- ✅ Secrets are stored outside the repository
- ✅ `.gitignore` excludes `*.pem` and `secrets/` directory
- ✅ `.env` files are not checked into git
- ✅ SSH key has restrictive permissions (600)
- ✅ SSL certificates are only readable by owner in Docker

## URLs

- **Frontend**: https://tomato.alex-ware.com
- **Backend API**: https://tomato.alex-ware.com/api
- **EC2 Instance**: ec2-107-21-171-155.compute-1.amazonaws.com
