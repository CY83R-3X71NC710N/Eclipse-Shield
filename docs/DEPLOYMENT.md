# Production Deployment Guide

## Overview

This guide covers deploying Eclipse Shield in production environments with full security hardening, monitoring, and high availability features.

## Quick Production Deployment

### Automated Setup (Recommended)

```bash
# Clone repository
git clone https://github.com/CY83R-3X71NC710N/Eclipse-Shield.git
cd Eclipse-Shield

# Run production deployment script
sudo ./deploy.sh
```

This script automatically configures:
- Nginx reverse proxy with SSL/TLS
- Gunicorn WSGI server with multiple workers
- UFW firewall with security rules
- Fail2ban intrusion prevention
- Process monitoring with Supervisor
- Log rotation and security monitoring

## Manual Production Setup

### 1. System Preparation

#### Update System
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y

# CentOS/RHEL
sudo yum update -y
```

#### Install Dependencies
```bash
# Ubuntu/Debian
sudo apt install -y python3 python3-pip python3-venv nginx redis-server \
  supervisor fail2ban ufw certbot python3-certbot-nginx

# CentOS/RHEL  
sudo yum install -y python3 python3-pip nginx redis supervisor fail2ban
```

### 2. Application Setup

#### Create Application User
```bash
sudo useradd --system --home /opt/eclipse-shield --shell /bin/bash eclipse-shield
sudo mkdir -p /opt/eclipse-shield
sudo chown eclipse-shield:eclipse-shield /opt/eclipse-shield
```

#### Deploy Application
```bash
# Switch to application user
sudo -u eclipse-shield -i

# Clone repository
cd /opt/eclipse-shield
git clone https://github.com/CY83R-3X71NC710N/Eclipse-Shield.git app
cd app

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements-secure.txt
```

#### Configure Environment
```bash
# Copy environment template
cp .env.example .env

# Edit production configuration
nano .env
```

**Production `.env` configuration:**
```bash
FLASK_ENV=production
DEBUG=false
SECRET_KEY=your-super-secret-key-here
ECLIPSE_SHIELD_API_KEY=your-google-gemini-api-key

# Security settings
CSRF_SECRET_KEY=another-secret-key
API_RATE_LIMIT=100
SECURITY_HEADERS_ENABLED=true

# Database & Caching
REDIS_URL=redis://localhost:6379/0

# Logging
LOG_LEVEL=INFO
LOG_FILE=/var/log/eclipse-shield/app.log

# SSL/HTTPS
SSL_ENABLED=true
FORCE_HTTPS=true
```

#### Set Permissions
```bash
# Secure configuration files
chmod 600 .env api_key.txt
chmod 755 *.sh

# Create log directory
sudo mkdir -p /var/log/eclipse-shield
sudo chown eclipse-shield:eclipse-shield /var/log/eclipse-shield
```

### 3. Database & Caching Setup

#### Configure Redis
```bash
# Edit Redis configuration
sudo nano /etc/redis/redis.conf

# Key settings for production:
# bind 127.0.0.1 ::1
# protected-mode yes
# requirepass your-redis-password

# Start and enable Redis
sudo systemctl start redis-server
sudo systemctl enable redis-server
```

### 4. Web Server Configuration

#### Nginx Configuration
Create `/etc/nginx/sites-available/eclipse-shield`:

```nginx
upstream eclipse_shield {
    server 127.0.0.1:8000;
    server 127.0.0.1:8001;
    server 127.0.0.1:8002;
    server 127.0.0.1:8003;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;
limit_req_zone $binary_remote_addr zone=general:10m rate=100r/h;

server {
    listen 80;
    server_name example.com www.example.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name example.com www.example.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate limiting
    limit_req zone=general burst=20 nodelay;

    # Static files
    location /static/ {
        alias /opt/eclipse-shield/app/extension/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API endpoints (stricter rate limiting)
    location /api/ {
        limit_req zone=api burst=5 nodelay;
        proxy_pass http://eclipse_shield;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Main application
    location / {
        proxy_pass http://eclipse_shield;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 30s;
        proxy_read_timeout 30s;
    }

    # Health check
    location /health {
        proxy_pass http://eclipse_shield;
        access_log off;
    }
}
```

#### Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/eclipse-shield /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. SSL/TLS Setup

#### Let's Encrypt Certificate
```bash
sudo certbot --nginx -d example.com -d www.example.com

# Test renewal
sudo certbot renew --dry-run

# Auto-renewal cron job
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

### 6. Process Management

#### Supervisor Configuration
Create `/etc/supervisor/conf.d/eclipse-shield.conf`:

```ini
[group:eclipse-shield]
programs=eclipse-shield-worker-1,eclipse-shield-worker-2,eclipse-shield-worker-3,eclipse-shield-worker-4

[program:eclipse-shield-worker-1]
command=/opt/eclipse-shield/app/venv/bin/gunicorn --config gunicorn.conf.py --bind 127.0.0.1:8000 wsgi:application
directory=/opt/eclipse-shield/app
user=eclipse-shield
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/eclipse-shield/worker-1.log
stdout_logfile_maxbytes=50MB
stdout_logfile_backups=5

[program:eclipse-shield-worker-2]
command=/opt/eclipse-shield/app/venv/bin/gunicorn --config gunicorn.conf.py --bind 127.0.0.1:8001 wsgi:application
directory=/opt/eclipse-shield/app
user=eclipse-shield
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/eclipse-shield/worker-2.log
stdout_logfile_maxbytes=50MB
stdout_logfile_backups=5

[program:eclipse-shield-worker-3]
command=/opt/eclipse-shield/app/venv/bin/gunicorn --config gunicorn.conf.py --bind 127.0.0.1:8002 wsgi:application
directory=/opt/eclipse-shield/app
user=eclipse-shield
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/eclipse-shield/worker-3.log
stdout_logfile_maxbytes=50MB
stdout_logfile_backups=5

[program:eclipse-shield-worker-4]
command=/opt/eclipse-shield/app/venv/bin/gunicorn --config gunicorn.conf.py --bind 127.0.0.1:8003 wsgi:application
directory=/opt/eclipse-shield/app
user=eclipse-shield
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/eclipse-shield/worker-4.log
stdout_logfile_maxbytes=50MB
stdout_logfile_backups=5
```

#### Start Services
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start eclipse-shield:*
```

### 7. Security Hardening

#### Firewall Configuration
```bash
# Enable UFW
sudo ufw enable

# Allow SSH (adjust port as needed)
sudo ufw allow ssh

# Allow HTTP/HTTPS
sudo ufw allow 'Nginx Full'

# Deny everything else by default
sudo ufw default deny incoming
sudo ufw default allow outgoing
```

#### Fail2ban Configuration
Create `/etc/fail2ban/jail.d/eclipse-shield.conf`:

```ini
[eclipse-shield-auth]
enabled = true
port = http,https
filter = eclipse-shield-auth
logpath = /var/log/eclipse-shield/*.log
maxretry = 5
bantime = 3600
findtime = 600

[nginx-req-limit]
enabled = true
filter = nginx-req-limit
action = iptables-multiport[name=ReqLimit, port="http,https", protocol=tcp]
logpath = /var/log/nginx/*error.log
findtime = 600
bantime = 3600
maxretry = 10
```

Create filter `/etc/fail2ban/filter.d/eclipse-shield-auth.conf`:

```ini
[Definition]
failregex = ^.*\[.*\] ERROR.*Authentication failed for IP <HOST>.*$
            ^.*\[.*\] WARNING.*Invalid API key.*from <HOST>.*$
            ^.*\[.*\] WARNING.*Rate limit exceeded.*<HOST>.*$
ignoreregex =
```

### 8. Monitoring & Logging

#### Log Rotation
Create `/etc/logrotate.d/eclipse-shield`:

```
/var/log/eclipse-shield/*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 644 eclipse-shield eclipse-shield
    postrotate
        /usr/bin/supervisorctl restart eclipse-shield:*
    endscript
}
```

#### Health Monitoring Script
Create `/opt/eclipse-shield/health-check.sh`:

```bash
#!/bin/bash

URL="https://example.com/health"
WEBHOOK_URL="https://your-webhook-endpoint.com"

if ! curl -f -s $URL > /dev/null; then
    echo "Eclipse Shield health check failed at $(date)" | \
    curl -X POST "$WEBHOOK_URL" -d "Eclipse Shield is down"
    
    # Restart services
    /usr/bin/supervisorctl restart eclipse-shield:*
fi
```

Add to cron:
```bash
# Check every 5 minutes
*/5 * * * * /opt/eclipse-shield/health-check.sh
```

## Docker Production Deployment

### Docker Compose for Production

Create `docker-compose.production.yml`:

```yaml
version: '3.8'

services:
  eclipse-shield:
    build: .
    restart: unless-stopped
    environment:
      - FLASK_ENV=production
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - redis
    networks:
      - eclipse-shield-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.eclipse-shield.rule=Host(`example.com`)"
      - "traefik.http.routers.eclipse-shield.tls.certresolver=lets-encrypt"

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass your-redis-password
    volumes:
      - redis-data:/data
    networks:
      - eclipse-shield-network

  traefik:
    image: traefik:v2.9
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./traefik.yml:/traefik.yml
      - traefik-certs:/certs
    networks:
      - eclipse-shield-network

volumes:
  redis-data:
  traefik-certs:

networks:
  eclipse-shield-network:
    driver: bridge
```

### Deploy with Docker
```bash
# Production deployment
docker-compose -f docker-compose.production.yml up -d

# View logs
docker-compose -f docker-compose.production.yml logs -f

# Scale application
docker-compose -f docker-compose.production.yml up -d --scale eclipse-shield=4
```

## Backup & Recovery

### Automated Backup Script
Create `/opt/eclipse-shield/backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/opt/backups/eclipse-shield"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup application code
tar -czf $BACKUP_DIR/app_$DATE.tar.gz -C /opt/eclipse-shield app/

# Backup Redis data
redis-cli --rdb $BACKUP_DIR/redis_$DATE.rdb

# Backup logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /var/log/eclipse-shield/

# Clean old backups (keep 30 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
find $BACKUP_DIR -name "*.rdb" -mtime +30 -delete
```

Add to cron:
```bash
# Daily backup at 2 AM
0 2 * * * /opt/eclipse-shield/backup.sh
```

## Performance Tuning

### Gunicorn Configuration
Optimize `gunicorn.conf.py`:

```python
# Worker processes (CPU cores * 2 + 1)
workers = 5

# Worker class for async handling
worker_class = "gevent"
worker_connections = 1000

# Memory management
max_requests = 1000
max_requests_jitter = 50

# Timeouts
timeout = 30
keepalive = 5

# Logging
accesslog = "/var/log/eclipse-shield/access.log"
errorlog = "/var/log/eclipse-shield/error.log"
loglevel = "info"
```

### Redis Optimization
Edit `/etc/redis/redis.conf`:

```
# Memory usage
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence
save 900 1
save 300 10
save 60 10000

# Performance
tcp-keepalive 300
tcp-backlog 511
```

## Troubleshooting Production Issues

### Common Issues

#### 502 Bad Gateway
```bash
# Check if application is running
sudo supervisorctl status

# Check logs
tail -f /var/log/eclipse-shield/*.log
tail -f /var/log/nginx/error.log
```

#### High Memory Usage
```bash
# Monitor memory
top -p $(pgrep -f gunicorn)

# Restart workers if needed
sudo supervisorctl restart eclipse-shield:*
```

#### SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew if needed
sudo certbot renew
```

For more troubleshooting help, see [TROUBLESHOOTING.md](../TROUBLESHOOTING.md).
