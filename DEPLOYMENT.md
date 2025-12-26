# Deployment Guide - Tomato Focus Tracker

## Prerequisites

- EC2 instance running Ubuntu (t2.micro or larger)
- Domain pointed to your EC2 IP address
- SSH access to EC2 instance
- Git installed on EC2

## Part 1: Initial EC2 Setup

### 1.1 Connect to EC2
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### 1.2 Install Docker and Docker Compose
```bash
# Update packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo apt install docker-compose -y

# Verify installation
docker --version
docker-compose --version

# Log out and log back in for group changes to take effect
exit
ssh -i your-key.pem ubuntu@your-ec2-ip
```

### 1.3 Install Node.js (for building frontend)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

## Part 2: Deploy Application

### 2.1 Clone Repository
```bash
cd ~
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO
```

### 2.2 Set Up Environment Variables

**IMPORTANT SECURITY NOTE:** Your `.env` file contains sensitive credentials and should NEVER be committed to git!

Create a secure `.env` file on the server:
```bash
# Create .env file
nano .env
```

Add the following (replace with your actual values):
```env
# Database Configuration
POSTGRES_USER=your_secure_username
POSTGRES_PASSWORD=your_secure_password_here
POSTGRES_DB=app_db

# Application Configuration
DATABASE_URL=postgresql://your_secure_username:your_secure_password_here@db:5432/app_db

# API Configuration
API_HOST=0.0.0.0
API_PORT=8000

# Email Configuration (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-16-char-app-password
SMTP_FROM_EMAIL=your-email@gmail.com
SMTP_FROM_NAME=Tomato Focus Tracker

# Frontend Configuration
FRONTEND_URL=https://your-domain.com
```

**Generate a strong password:**
```bash
# Generate a random 32-character password
openssl rand -base64 32
```

### 2.3 Build Frontend
```bash
cd frontend
npm install
npm run build
cd ..
```

### 2.4 Set Up SSL Certificates (if using Cloudflare)

If you have Cloudflare certificates:
```bash
# Create secrets directory
mkdir -p secrets

# Copy your certificates (from your local machine)
# On your local machine:
scp -i your-key.pem carl2.pem ubuntu@your-ec2-ip:~/YOUR-REPO/secrets/
scp -i your-key.pem carl3private.pem ubuntu@your-ec2-ip:~/YOUR-REPO/secrets/
```

### 2.5 Start Services
```bash
# Start in production mode
docker-compose -f docker-compose.yml up -d

# Or if using production config without nginx:
docker-compose -f docker-compose.prod.yml up -d

# View logs
docker-compose logs -f

# Check running containers
docker-compose ps
```

## Part 3: Verify Deployment

### 3.1 Test Backend API
```bash
curl http://localhost:8000/
curl http://localhost:8000/api/health
```

### 3.2 Test Frontend
Open browser to `http://your-ec2-ip` or `https://your-domain.com`

### 3.3 Test Email
Try registering a new account to verify email verification codes are being sent.

## Part 4: Updates and Redeployment

### 4.1 Pull Latest Changes
```bash
cd ~/YOUR-REPO
git pull origin main
```

### 4.2 Rebuild Frontend (if frontend changed)
```bash
cd frontend
npm install  # If package.json changed
npm run build
cd ..
```

### 4.3 Rebuild Backend (if backend changed)
```bash
# Rebuild and restart
docker-compose down
docker-compose build api
docker-compose up -d
```

### 4.4 Restart Services
```bash
# Quick restart (no rebuild)
docker-compose restart

# Or full restart with rebuild
docker-compose down
docker-compose up -d --build
```

## Part 5: Database Management

See [DATABASE_RESET.md](DATABASE_RESET.md) for database reset instructions.

## Part 6: Admin CLI

### 6.1 Run Admin Tool
```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@your-ec2-ip

# Navigate to backend
cd ~/YOUR-REPO/backend

# Run admin CLI
python3 admin.py
```

### 6.2 Admin Functions
- List all accounts
- View account details
- Delete inactive accounts
- Check account limit (50 max)

## Part 7: Monitoring

### 7.1 View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f db
docker-compose logs -f frontend

# Last 100 lines
docker-compose logs --tail=100 api
```

### 7.2 Check Container Status
```bash
docker-compose ps
docker stats
```

### 7.3 Check Disk Usage
```bash
df -h
docker system df
```

## Part 8: Security Best Practices

### 8.1 Firewall Setup
```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

### 8.2 Keep System Updated
```bash
sudo apt update && sudo apt upgrade -y
```

### 8.3 Backup Database
```bash
# Create backup
docker-compose exec db pg_dump -U postgres app_db > backup.sql

# Or with timestamp
docker-compose exec db pg_dump -U postgres app_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Part 9: Troubleshooting

### 9.1 Container Won't Start
```bash
# Check logs
docker-compose logs api

# Restart specific service
docker-compose restart api
```

### 9.2 Database Connection Issues
```bash
# Check database is running
docker-compose ps db

# Check database logs
docker-compose logs db

# Connect to database directly
docker-compose exec db psql -U postgres -d app_db
```

### 9.3 Permission Issues
```bash
# Fix ownership
sudo chown -R ubuntu:ubuntu ~/YOUR-REPO

# Fix permissions
chmod 600 secrets/*.pem
```

### 9.4 Out of Memory
```bash
# Check memory usage
free -h
docker stats

# Restart services
docker-compose restart
```

## Quick Command Reference

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart services
docker-compose restart

# View logs
docker-compose logs -f

# Rebuild and restart
docker-compose up -d --build

# Check status
docker-compose ps

# Clean up
docker system prune -a
```

## Environment-Specific Notes

### Development
- Uses `docker-compose.yml`
- Includes hot reload for backend
- Exposes database on port 5432

### Production
- Uses `docker-compose.prod.yml`
- Optimized for 1GB RAM
- No hot reload
- Database not exposed externally
