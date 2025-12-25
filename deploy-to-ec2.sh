#!/bin/bash

# Deploy Focus Tracker to EC2 using Git
# This script pulls the latest code from GitHub and rebuilds containers

set -e

echo "========================================="
echo "Deploying Focus Tracker to EC2"
echo "========================================="
echo ""

# Configuration
EC2_USER="ec2-user"
EC2_HOST="107.21.171.155"
EC2_KEY="../AppForDadSecrets/Carl.pem"
DEPLOY_DIR="/home/ec2-user/focus-tracker"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Deploying to EC2 via Git pull...${NC}"
ssh -i "$EC2_KEY" "$EC2_USER@$EC2_HOST" << 'ENDSSH'
set -e

cd /home/ec2-user/focus-tracker

echo "Pulling latest code from GitHub..."
git pull

echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

echo "Restarting Docker containers (rebuilding only changed services)..."
docker-compose up -d --build

echo "Checking container status..."
docker-compose ps

echo ""
echo "Deployment complete!"
ENDSSH

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Your app is now available at:"
echo "  Frontend: https://tomato.alex-ware.com"
echo "  Backend:  https://tomato.alex-ware.com/api"
echo ""
echo "Check status:"
echo "  ssh -i $EC2_KEY $EC2_USER@$EC2_HOST 'cd focus-tracker && docker compose ps'"
echo ""
echo "View logs:"
echo "  ssh -i $EC2_KEY $EC2_USER@$EC2_HOST 'cd focus-tracker && docker compose logs -f [service_name]'"
echo "  (service names: db, api, frontend)"
