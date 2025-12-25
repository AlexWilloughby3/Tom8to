#!/bin/bash

# Deploy Focus Tracker to EC2
# This script uploads the frontend build and restarts Docker containers

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

echo -e "${YELLOW}Step 1: Building frontend...${NC}"
cd frontend
npm run build
cd ..

echo ""
echo -e "${YELLOW}Step 2: Creating deployment directory on EC2...${NC}"
ssh -i "$EC2_KEY" "$EC2_USER@$EC2_HOST" "mkdir -p $DEPLOY_DIR/frontend"

echo ""
echo -e "${YELLOW}Step 3: Uploading files to EC2...${NC}"

# Upload docker-compose.yml
scp -i "$EC2_KEY" docker-compose.yml "$EC2_USER@$EC2_HOST:$DEPLOY_DIR/"

# Upload nginx config
scp -i "$EC2_KEY" nginx.conf "$EC2_USER@$EC2_HOST:$DEPLOY_DIR/"

# Upload .env if it exists
if [ -f .env ]; then
    scp -i "$EC2_KEY" .env "$EC2_USER@$EC2_HOST:$DEPLOY_DIR/"
fi

# Upload backend code
echo "Uploading backend..."
scp -i "$EC2_KEY" -r backend "$EC2_USER@$EC2_HOST:$DEPLOY_DIR/"

# Upload frontend build
echo "Uploading frontend build..."
scp -i "$EC2_KEY" -r frontend/dist "$EC2_USER@$EC2_HOST:$DEPLOY_DIR/frontend/"

echo ""
echo -e "${YELLOW}Step 4: Restarting Docker containers on EC2...${NC}"
ssh -i "$EC2_KEY" "$EC2_USER@$EC2_HOST" << 'ENDSSH'
cd /home/ec2-user/focus-tracker
docker-compose down
docker-compose up -d --build
docker-compose ps
ENDSSH

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Deployment complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Your app is now available at:"
echo "  Frontend: http://ec2-107-21-171-155.compute-1.amazonaws.com"
echo "  Backend:  http://ec2-107-21-171-155.compute-1.amazonaws.com:8000"
echo ""
echo "Check status:"
echo "  ssh -i $EC2_KEY $EC2_USER@$EC2_HOST 'cd focus-tracker && docker compose ps'"
