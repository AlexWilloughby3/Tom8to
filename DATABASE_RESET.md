# Database Reset Guide

This guide covers how to reset your database both locally and in production.

## ⚠️ WARNING
**Resetting the database will DELETE ALL DATA including:**
- All user accounts
- All focus sessions
- All goals and categories
- All verification codes and reset tokens

**This action is IRREVERSIBLE!**

## Option 1: Complete Database Reset (Docker)

### Local Development

```bash
# Stop all services
docker-compose down

# Delete the database volume (THIS DELETES ALL DATA)
docker volume rm "app-for-dad_postgres_data"

# Start services (database will be recreated with init.sql)
docker-compose up -d

# Verify
docker-compose logs db
```

### Production (EC2)

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Navigate to your project
cd ~/YOUR-REPO

# Stop services
docker-compose down

# Delete the database volume
docker volume rm "your-repo_postgres_data"

# Start services
docker-compose up -d

# Check logs
docker-compose logs -f db
```

## Option 2: Selective Table Reset

If you only want to clear user data but keep the schema:

### 2.1 Connect to Database
```bash
# Local
docker-compose exec db psql -U postgres -d app_db

# Production (SSH into EC2 first)
docker-compose exec db psql -U postgres -d app_db
```

### 2.2 Clear All User Data
```sql
-- Delete all data (CASCADE removes related records)
DELETE FROM user_information CASCADE;
DELETE FROM verification_codes;
DELETE FROM password_reset_tokens;
DELETE FROM pending_registrations;

-- Verify tables are empty
SELECT COUNT(*) FROM user_information;
SELECT COUNT(*) FROM focus_information;

-- Exit psql
\q
```

### 2.3 Clear Specific Tables
```sql
-- Clear only verification codes (expired codes)
DELETE FROM verification_codes WHERE expires_at < NOW();

-- Clear only password reset tokens
DELETE FROM password_reset_tokens WHERE expires_at < NOW();

-- Clear only pending registrations (expired)
DELETE FROM pending_registrations WHERE expires_at < NOW();

-- Exit psql
\q
```

## Option 3: Rebuild Database Schema

If you've made changes to `init.sql` and need to apply them:

### 3.1 Method 1: Volume Reset (Recommended)
```bash
# Stop services
docker-compose down

# Remove volume
docker volume rm "app-for-dad_postgres_data"

# Rebuild and start (will run init.sql)
docker-compose up -d --build
```

### 3.2 Method 2: Manual Schema Update
```bash
# Connect to database
docker-compose exec db psql -U postgres -d app_db

# Run your SQL commands manually
# Or run the init.sql file:
docker-compose exec db psql -U postgres -d app_db -f /docker-entrypoint-initdb.d/init.sql
```

## Option 4: Export Before Reset (Backup)

### 4.1 Create Backup
```bash
# Backup entire database
docker-compose exec db pg_dump -U postgres app_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup specific tables
docker-compose exec db pg_dump -U postgres -d app_db -t user_information -t focus_information > users_backup.sql
```

### 4.2 Reset Database
```bash
docker-compose down
docker volume rm "app-for-dad_postgres_data"
docker-compose up -d
```

### 4.3 Restore Backup (if needed)
```bash
# Restore full backup
docker-compose exec -T db psql -U postgres app_db < backup_20241225_120000.sql

# Restore specific backup
docker-compose exec -T db psql -U postgres app_db < users_backup.sql
```

## After Database Reset

### Verify Database is Working
```bash
# Check database is running
docker-compose ps db

# Check logs for errors
docker-compose logs db

# Test connection
docker-compose exec db psql -U postgres -d app_db -c "SELECT COUNT(*) FROM user_information;"
```

### Check Tables Were Created
```bash
docker-compose exec db psql -U postgres -d app_db
```

```sql
-- List all tables
\dt

-- Check each table schema
\d user_information
\d focus_information
\d focus_goal_information
\d category_information
\d verification_codes
\d password_reset_tokens
\d pending_registrations

-- Exit
\q
```

### Test Registration
1. Go to your frontend (http://localhost or your domain)
2. Try to register a new account
3. Check email for verification code
4. Verify account creation works

## Common Issues

### Issue: Volume doesn't exist
```bash
# List all volumes
docker volume ls

# Use the correct volume name
docker volume rm <actual-volume-name>
```

### Issue: Volume is in use
```bash
# Make sure containers are stopped
docker-compose down

# Force remove containers
docker-compose rm -f

# Then remove volume
docker volume rm "app-for-dad_postgres_data"
```

### Issue: Permission denied
```bash
# Add sudo if needed
sudo docker volume rm "app-for-dad_postgres_data"
```

### Issue: Database not recreating
```bash
# Rebuild the database container
docker-compose up -d --build db

# Check logs
docker-compose logs db
```

## Automated Cleanup Script

Create a script to clean expired codes regularly:

### cleanup.sh
```bash
#!/bin/bash
docker-compose exec db psql -U postgres -d app_db <<EOF
DELETE FROM verification_codes WHERE expires_at < NOW();
DELETE FROM password_reset_tokens WHERE expires_at < NOW();
DELETE FROM pending_registrations WHERE expires_at < NOW();
EOF
```

### Set up Cron Job (Optional)
```bash
# Edit crontab
crontab -e

# Add this line to run daily at 2 AM
0 2 * * * /path/to/your/cleanup.sh
```

## Quick Reference

```bash
# Full reset (DELETE ALL DATA)
docker-compose down && docker volume rm "app-for-dad_postgres_data" && docker-compose up -d

# Clear user data only
docker-compose exec db psql -U postgres -d app_db -c "DELETE FROM user_information CASCADE;"

# Backup
docker-compose exec db pg_dump -U postgres app_db > backup.sql

# Restore
docker-compose exec -T db psql -U postgres app_db < backup.sql

# Clean expired codes
docker-compose exec db psql -U postgres -d app_db -c "DELETE FROM verification_codes WHERE expires_at < NOW();"
```
