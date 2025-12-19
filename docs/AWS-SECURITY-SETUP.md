# AWS EC2 Security Group Setup

## Step-by-Step Instructions

### 1. Find Your Current IP Address

```bash
# On your Mac, run:
curl ifconfig.me

# Example output: 123.45.67.89
# This is YOUR_IP_ADDRESS
```

### 2. Configure Security Group in AWS Console

1. **Go to EC2 Dashboard**
   - AWS Console → EC2 → Instances
   - Click on your instance
   - Click on the **Security** tab
   - Click on the security group link (e.g., "sg-1234567890abcdef0")

2. **Edit Inbound Rules**
   - Click **Edit inbound rules**
   - Click **Delete** on all existing rules (we'll add them back properly)

3. **Add SSH Rule (Your IP Only)**
   - Click **Add rule**
   - Type: **SSH**
   - Source: **My IP** (it will auto-populate your current IP)
   - Description: `SSH from my machine`
   - Click **Save rules**

4. **Add API Rule (Public Access)**
   - Click **Add rule**
   - Type: **Custom TCP**
   - Port range: **8000**
   - Source: **Anywhere-IPv4 (0.0.0.0/0)**
   - Description: `FastAPI for frontend`
   - Click **Save rules**

### 3. Test SSH Access

```bash
# SSH into your EC2 instance
ssh -i /path/to/your-key.pem ec2-user@YOUR_EC2_IP

# If this works, you're good!
```

### 4. Test API Access

```bash
# From your local machine
curl http://YOUR_EC2_IP:8000/

# Should return:
# {"message":"Welcome to the Focus Tracker API","status":"healthy","version":"1.0.0"}
```

## Security Group Summary

Your final security group should look like:

```
INBOUND RULES:
┌──────────┬──────────┬──────┬─────────────────┬─────────────────────┐
│ Type     │ Protocol │ Port │ Source          │ Description         │
├──────────┼──────────┼──────┼─────────────────┼─────────────────────┤
│ SSH      │ TCP      │ 22   │ YOUR_IP/32      │ SSH from my machine │
│ Custom   │ TCP      │ 8000 │ 0.0.0.0/0       │ FastAPI for frontend│
└──────────┴──────────┴──────┴─────────────────┴─────────────────────┘

OUTBOUND RULES:
┌──────────┬──────────┬──────┬─────────────────┬─────────────────────┐
│ Type     │ Protocol │ Port │ Destination     │ Description         │
├──────────┼──────────┼──────┼─────────────────┼─────────────────────┤
│ All      │ All      │ All  │ 0.0.0.0/0       │ Allow all outbound  │
└──────────┴──────────┴──────┴─────────────────┴─────────────────────┘
```

## Important Notes

### SSH Access
- ✅ **Only YOUR IP** can SSH into the server
- ⚠️ If your IP changes (you move, ISP changes it), you'll need to update the security group
- 💡 To update: EC2 Console → Security Groups → Edit inbound rules → Update SSH source IP

### API Access
- ⚠️ Port 8000 is open to the internet
- ✅ But your API requires authentication (bcrypt passwords)
- ✅ No user data is exposed without login
- 💡 This is safe for a personal app with 2 users

### What's Protected
- ✅ PostgreSQL (port 5432) - NOT exposed, only accessible within Docker network
- ✅ SSH access - Only from your IP
- ✅ User passwords - Hashed with bcrypt
- ✅ Database - Not directly accessible from internet

### What's Public
- ⚠️ API endpoints (port 8000) - Anyone can try to access
- ✅ But they need valid credentials to see any data
- ✅ Invalid login attempts are rejected

## Optional: Add HTTPS Later

For production, you should add HTTPS:

1. **Get a domain name** (optional, ~$12/year)
2. **Use Let's Encrypt** (free SSL certificate)
3. **Set up Nginx** as reverse proxy
4. **Change API port from 8000 to 443 (HTTPS)**

Then your security group becomes:
```
SSH: Your IP only (port 22)
HTTPS: Anywhere (port 443)
HTTP: Anywhere (port 80, redirects to 443)
```

## Troubleshooting

### "Connection timed out" when trying to SSH
- Your IP has changed
- Update security group with new IP
- Run `curl ifconfig.me` to get current IP

### Frontend can't connect to API
- Check security group has port 8000 open to 0.0.0.0/0
- Check CORS is configured in backend/app/main.py
- Check EC2 instance is running: `docker compose ps`

### Someone else can't SSH
- This is CORRECT behavior!
- Only your IP should be able to SSH
- Add their IP if you want to grant access
