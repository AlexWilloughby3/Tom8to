# Admin CLI Guide

This guide explains how to use the admin.py CLI tool to manage user accounts on your EC2 instance.

## Prerequisites

- SSH access to the EC2 instance
- The application must be running via Docker Compose
- admin.py is located in the `backend/` directory

## Accessing the Admin CLI on EC2

### Method 1: Run Inside Docker Container (Recommended)

The admin.py script needs to access the same Python environment and database as your FastAPI backend. The easiest way is to run it inside the backend Docker container:

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Navigate to your project directory
cd ~/App-for-Dad  # or wherever your repo is located

# Run admin.py inside the backend container
docker-compose exec backend python admin.py
```

This method works because:
- All Python dependencies (SQLAlchemy, etc.) are already installed in the container
- The container has access to the database via Docker networking
- Environment variables (.env) are automatically loaded

### Method 2: Install Dependencies Locally on EC2 (Alternative)

If you prefer to run admin.py directly on the EC2 host (outside Docker), you'll need to install dependencies:

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ubuntu@your-ec2-ip

# Install Python 3 and pip (if not already installed)
sudo apt update
sudo apt install -y python3 python3-pip

# Navigate to your project backend directory
cd ~/App-for-Dad/backend

# Install Python dependencies
pip3 install -r requirements.txt

# Run admin.py
python3 admin.py
```

**Note:** When running outside Docker, you need to:
1. Ensure the DATABASE_URL in your .env file points to the correct host
   - Inside Docker: `postgresql://postgres:postgres@db:5432/app_db`
   - Outside Docker: `postgresql://postgres:postgres@localhost:5432/app_db` (if database port is exposed)

2. Make sure the PostgreSQL port is exposed in docker-compose.yml:
   ```yaml
   services:
     db:
       ports:
         - "5432:5432"  # Add this line
   ```

## Using the Admin CLI

Once you've accessed the admin CLI using either method above, you'll see a menu:

```
===============================================================
Tomato Focus Tracker - Admin CLI
===============================================================

1. List all accounts
2. View account details
3. Delete account
4. Check account limit status
5. Exit

Enter your choice (1-5):
```

### Available Commands

#### 1. List All Accounts
Shows all registered users with their statistics:
- Email address
- Number of focus sessions
- Number of categories created

#### 2. View Account Details
Enter an email address to see detailed information:
- All focus sessions with timestamps and durations
- All categories
- All goals and progress

#### 3. Delete Account
Permanently delete a user account:
- Enter the email address
- Confirm by typing `DELETE`
- This removes:
  - User account
  - All focus sessions
  - All goals
  - All categories

⚠️ **Warning:** This action cannot be undone!

#### 4. Check Account Limit Status
Shows the current account count (maximum 50 accounts).

#### 5. Exit
Closes the admin CLI.

## Common Use Cases

### Check All Registered Users
```bash
docker-compose exec backend python admin.py
# Choose option 1
```

### Delete an Inactive Account
```bash
docker-compose exec backend python admin.py
# Choose option 3
# Enter the email address
# Type DELETE to confirm
```

### Monitor Account Usage
```bash
docker-compose exec backend python admin.py
# Choose option 4 to see if approaching the 50-account limit
```

## Troubleshooting

### Error: "ModuleNotFoundError: No module named 'sqlalchemy'"
**Solution:** Use Method 1 (run inside Docker container) or install dependencies with `pip3 install -r requirements.txt`

### Error: "could not connect to server: Connection refused"
**Solutions:**
- Make sure Docker containers are running: `docker-compose ps`
- If running outside Docker, ensure database port 5432 is exposed
- Check DATABASE_URL in .env file

### Error: "Permission denied"
**Solution:** Make sure admin.py is executable:
```bash
chmod +x backend/admin.py
```

### Can't find admin.py
**Solution:** Make sure you're in the correct directory:
```bash
ls backend/admin.py  # Should show the file
```

## Security Notes

- Only users with SSH access to the EC2 instance can use admin.py
- There is no web interface or API endpoint for admin functions
- Always confirm before deleting accounts
- Consider taking database backups before bulk operations (see DATABASE_RESET.md)

## Quick Reference

```bash
# Most common command (run admin CLI)
docker-compose exec backend python admin.py

# Alternative: Run with sudo if permission issues
sudo docker-compose exec backend python admin.py

# Check if containers are running
docker-compose ps

# View backend container logs
docker-compose logs backend

# Restart backend if needed
docker-compose restart backend
```
