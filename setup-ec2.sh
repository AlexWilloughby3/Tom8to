#!/bin/bash

# One-time setup script for EC2 deployment
# This script:
# 1. Clones the git repository on EC2
# 2. Sets up the secrets directory on EC2
# 3. Copies secrets from local machine to EC2
# 4. Creates symlink to secrets directory

set -e

echo "========================================="
echo "Setting up EC2 for Git-based Deployment"
echo "========================================="
echo ""

# Configuration
EC2_USER="ec2-user"
EC2_HOST="107.21.171.155"
EC2_KEY="../AppForDadSecrets/Carl.pem"
SECRETS_DIR="../AppForDadSecrets"
DEPLOY_DIR="/home/ec2-user/focus-tracker"
GIT_REPO="https://github.com/YOUR_USERNAME/YOUR_REPO.git"  # UPDATE THIS!

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Check if secrets directory exists locally
if [ ! -d "$SECRETS_DIR" ]; then
    echo -e "${RED}Error: Secrets directory not found at $SECRETS_DIR${NC}"
    echo "Please create it and add your secrets files:"
    echo "  - Carl.pem (SSH key)"
    echo "  - carl2.pem (SSL certificate)"
    echo "  - carl3private.pem (SSL private key)"
    echo "  - .env (environment variables)"
    exit 1
fi

echo -e "${YELLOW}Step 1: Creating secrets directory on EC2...${NC}"
ssh -i "$EC2_KEY" "$EC2_USER@$EC2_HOST" << 'ENDSSH'
mkdir -p ~/secrets
echo "Secrets directory created at ~/secrets"
ENDSSH

echo ""
echo -e "${YELLOW}Step 2: Copying secrets to EC2...${NC}"

# Copy .env file
if [ -f "$SECRETS_DIR/.env" ]; then
    scp -i "$EC2_KEY" "$SECRETS_DIR/.env" "$EC2_USER@$EC2_HOST:~/secrets/"
    echo "Copied .env"
else
    echo -e "${YELLOW}Warning: .env not found in $SECRETS_DIR${NC}"
fi

# Copy SSL certificates
if [ -f "$SECRETS_DIR/carl2.pem" ]; then
    scp -i "$EC2_KEY" "$SECRETS_DIR/carl2.pem" "$EC2_USER@$EC2_HOST:~/secrets/"
    echo "Copied carl2.pem"
else
    echo -e "${YELLOW}Warning: carl2.pem not found in $SECRETS_DIR${NC}"
fi

if [ -f "$SECRETS_DIR/carl3private.pem" ]; then
    scp -i "$EC2_KEY" "$SECRETS_DIR/carl3private.pem" "$EC2_USER@$EC2_HOST:~/secrets/"
    echo "Copied carl3private.pem"
else
    echo -e "${YELLOW}Warning: carl3private.pem not found in $SECRETS_DIR${NC}"
fi

echo ""
echo -e "${YELLOW}Step 3: Setting up Git repository on EC2...${NC}"

# Check if user has updated the GIT_REPO variable
if [[ "$GIT_REPO" == *"YOUR_USERNAME"* ]]; then
    echo -e "${RED}Error: Please update the GIT_REPO variable in this script with your actual repository URL${NC}"
    echo "Edit this file and replace:"
    echo "  GIT_REPO=\"https://github.com/AlexWilloughby3/Tom8to.git\""
    echo "with your actual GitHub repository URL"
    exit 1
fi

ssh -i "$EC2_KEY" "$EC2_USER@$EC2_HOST" << ENDSSH
set -e

# Install git if not present
if ! command -v git &> /dev/null; then
    echo "Installing git..."
    sudo yum install -y git
fi

# Install Node.js if not present (needed for frontend builds)
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
    sudo yum install -y nodejs
fi

# Install Docker and Docker Compose if not present
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    sudo yum update -y
    sudo yum install -y docker
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker ec2-user
    echo "Docker installed. You may need to log out and back in for group changes to take effect."
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Clone or update repository
if [ -d "$DEPLOY_DIR" ]; then
    echo "Repository directory already exists at $DEPLOY_DIR"
    cd $DEPLOY_DIR
    echo "Pulling latest changes..."
    git pull
else
    echo "Cloning repository..."
    git clone $GIT_REPO $DEPLOY_DIR
    cd $DEPLOY_DIR
fi

# Create symlink to secrets directory
echo "Creating symlink to secrets directory..."
ln -sf ~/secrets ./secrets

echo "Git repository setup complete!"
ENDSSH

echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}Setup complete!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Verify secrets are in place on EC2:"
echo "   ssh -i $EC2_KEY $EC2_USER@$EC2_HOST 'ls -la ~/secrets'"
echo ""
echo "2. Build and start the application:"
echo "   ssh -i $EC2_KEY $EC2_USER@$EC2_HOST 'cd $DEPLOY_DIR && cd frontend && npm install && npm run build && cd .. && docker-compose up -d --build'"
echo ""
echo "3. For future deployments, simply run:"
echo "   ./deploy-to-ec2.sh"
echo ""
