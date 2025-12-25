#!/bin/bash
# EC2 Resource Diagnostic Script
# Run this on your EC2 instance to check memory usage

echo "========================================="
echo "EC2 Instance Resource Diagnostic"
echo "========================================="
echo ""

echo "1. Instance Type:"
curl -s http://169.254.169.254/latest/meta-data/instance-type
echo ""
echo ""

echo "2. Memory Usage:"
free -h
echo ""

echo "3. Disk Usage:"
df -h /
echo ""

echo "4. Docker Container Stats:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
echo ""

echo "5. Top Memory Consumers:"
ps aux --sort=-%mem | head -10
echo ""

echo "6. System Uptime:"
uptime
echo ""

echo "7. SSH Service Status:"
sudo systemctl status sshd --no-pager | head -10
echo ""

echo "========================================="
echo "Analysis:"
echo "========================================="

# Get available memory in MB
AVAILABLE_MEM=$(free -m | awk 'NR==2{print $7}')
TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
USED_PERCENT=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')

echo "Memory: ${USED_PERCENT}% used ($AVAILABLE_MEM MB available of $TOTAL_MEM MB total)"

if [ $AVAILABLE_MEM -lt 200 ]; then
    echo "⚠️  WARNING: Low memory! Less than 200MB available"
    echo "   Consider upgrading instance or optimizing containers"
elif [ $AVAILABLE_MEM -lt 400 ]; then
    echo "⚠️  CAUTION: Memory getting tight (less than 400MB free)"
else
    echo "✓ Memory looks OK"
fi
