#!/bin/bash

# Eclipse Shield Production Deployment Script
# This script sets up a secure production environment with WSGI server

set -e  # Exit on any error

echo "=== Eclipse Shield Production Setup ==="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_warning "Running as root. Consider using a dedicated user for security."
fi

# Update system packages
print_status "Updating system packages..."
if command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y python3 python3-pip python3-venv nginx supervisor ufw fail2ban
elif command -v yum >/dev/null 2>&1; then
    sudo yum update -y
    sudo yum install -y python3 python3-pip nginx supervisor fail2ban
else
    print_warning "Package manager not detected. Please install: python3, python3-pip, nginx, supervisor, fail2ban manually."
fi

# Create application directory
APP_DIR="/opt/eclipse-shield"
print_status "Creating application directory: $APP_DIR"
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Copy application files
print_status "Copying application files..."
cp -r . $APP_DIR/
cd $APP_DIR

# Create virtual environment
print_status "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install secure requirements
print_status "Installing Python dependencies..."
pip install --upgrade pip
pip install -r requirements-secure.txt

# Generate secure secret key
print_status "Generating secure configuration..."
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
API_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")

# Create environment file
cat > .env << EOF
FLASK_ENV=production
SECRET_KEY=$SECRET_KEY
ECLIPSE_SHIELD_API_KEY=$API_KEY
REDIS_URL=redis://localhost:6379/0
EOF

# Set secure permissions
chmod 600 .env
chmod 755 wsgi.py
chmod 755 secure_app.py

# Create log directory
sudo mkdir -p /var/log/eclipse-shield
sudo chown $USER:$USER /var/log/eclipse-shield

# Configure Nginx
print_status "Configuring Nginx..."
sudo tee /etc/nginx/sites-available/eclipse-shield << 'EOF'
server {
    listen 80;
    server_name _;  # Replace with your domain
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload";
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;
    limit_req_zone $binary_remote_addr zone=static:10m rate=50r/m;
    
    # Hide nginx version
    server_tokens off;
    
    # API endpoints with rate limiting
    location ~ ^/(analyze|get_question|contextualize) {
        limit_req zone=api burst=5 nodelay;
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
    }
    
    # Static files with caching
    location /extension/ {
        limit_req zone=static burst=20 nodelay;
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_valid 200 1h;
    }
    
    # Other requests
    location / {
        limit_req zone=api burst=10 nodelay;
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Block common attack patterns
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    location ~ \.(asp|aspx|cgi|jsp|php)$ {
        deny all;
        access_log off;
        log_not_found off;
    }
}
EOF

# Enable Nginx site
sudo ln -sf /etc/nginx/sites-available/eclipse-shield /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Configure Supervisor
print_status "Configuring Supervisor..."
sudo cp supervisord.conf /etc/supervisor/conf.d/eclipse-shield.conf

# Update supervisor configuration with correct paths and environment
sudo tee /etc/supervisor/conf.d/eclipse-shield.conf << EOF
[program:eclipse-shield]
command=$APP_DIR/venv/bin/gunicorn --bind 127.0.0.1:5000 --workers 4 --worker-class gevent --worker-connections 1000 --max-requests 1000 --max-requests-jitter 100 --timeout 30 --keep-alive 2 --preload wsgi:application
directory=$APP_DIR
user=$USER
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/eclipse-shield/application.log
stdout_logfile_maxbytes=50MB
stdout_logfile_backups=10
environment=PATH="$APP_DIR/venv/bin",FLASK_ENV=production,SECRET_KEY="$SECRET_KEY",ECLIPSE_SHIELD_API_KEY="$API_KEY"
EOF

# Configure UFW firewall
print_status "Configuring firewall..."
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Configure fail2ban
print_status "Configuring fail2ban..."
sudo tee /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
backend = auto

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10

[nginx-botsearch]
enabled = true
filter = nginx-botsearch
logpath = /var/log/nginx/access.log
maxretry = 2
EOF

# Create systemd service for additional security
print_status "Creating systemd service..."
sudo tee /etc/systemd/system/eclipse-shield.service << EOF
[Unit]
Description=Eclipse Shield AI Productivity Analyzer
After=network.target

[Service]
Type=forking
User=$USER
Group=$USER
WorkingDirectory=$APP_DIR
Environment=PATH=$APP_DIR/venv/bin
Environment=FLASK_ENV=production
Environment=SECRET_KEY=$SECRET_KEY
Environment=ECLIPSE_SHIELD_API_KEY=$API_KEY
ExecStart=/usr/bin/supervisord -c $APP_DIR/supervisord.conf
ExecReload=/bin/kill -HUP \$MAINPID
KillMode=mixed
Restart=always
RestartSec=5

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=$APP_DIR /var/log/eclipse-shield /tmp

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd and start services
print_status "Starting services..."
sudo systemctl daemon-reload
sudo systemctl enable eclipse-shield
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start eclipse-shield
sudo systemctl restart nginx
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# Create backup script
print_status "Creating backup script..."
sudo tee /usr/local/bin/eclipse-shield-backup << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/backups/eclipse-shield"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/eclipse-shield-$DATE.tar.gz -C /opt eclipse-shield
find $BACKUP_DIR -name "eclipse-shield-*.tar.gz" -mtime +7 -delete
EOF

sudo chmod +x /usr/local/bin/eclipse-shield-backup

# Add to crontab for daily backups
(crontab -l 2>/dev/null; echo "0 2 * * * /usr/local/bin/eclipse-shield-backup") | crontab -

# Create security monitoring script
print_status "Creating security monitoring script..."
tee $APP_DIR/security_monitor.py << 'EOF'
#!/usr/bin/env python3
"""Security monitoring script for Eclipse Shield."""

import time
import logging
import subprocess
import smtplib
from email.mime.text import MimeText
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('/var/log/eclipse-shield/security.log'),
        logging.StreamHandler()
    ]
)

def check_failed_logins():
    """Check for failed login attempts."""
    try:
        result = subprocess.run(['grep', 'Failed', '/var/log/auth.log'], 
                              capture_output=True, text=True)
        if result.returncode == 0:
            lines = result.stdout.strip().split('\n')
            recent_failures = [line for line in lines if 'eclipse-shield' in line]
            if recent_failures:
                logging.warning(f"Found {len(recent_failures)} failed login attempts")
                return recent_failures
    except Exception as e:
        logging.error(f"Error checking failed logins: {e}")
    return []

def check_disk_space():
    """Check disk space usage."""
    try:
        result = subprocess.run(['df', '-h', '/'], capture_output=True, text=True)
        lines = result.stdout.strip().split('\n')
        if len(lines) > 1:
            usage = lines[1].split()[4].rstrip('%')
            if int(usage) > 85:
                logging.warning(f"Disk usage high: {usage}%")
                return True
    except Exception as e:
        logging.error(f"Error checking disk space: {e}")
    return False

def main():
    """Main monitoring loop."""
    logging.info("Security monitoring started")
    
    while True:
        try:
            check_failed_logins()
            check_disk_space()
            time.sleep(300)  # Check every 5 minutes
        except KeyboardInterrupt:
            logging.info("Security monitoring stopped")
            break
        except Exception as e:
            logging.error(f"Monitoring error: {e}")
            time.sleep(60)

if __name__ == "__main__":
    main()
EOF

chmod +x $APP_DIR/security_monitor.py

# Final status check
print_status "Checking service status..."
sudo supervisorctl status eclipse-shield
sudo systemctl status nginx --no-pager -l
sudo ufw status

print_status "Setup complete!"
echo ""
echo "=== Eclipse Shield Production Setup Summary ==="
echo "Application Directory: $APP_DIR"
echo "Log Directory: /var/log/eclipse-shield"
echo "Nginx Configuration: /etc/nginx/sites-available/eclipse-shield"
echo "Supervisor Configuration: /etc/supervisor/conf.d/eclipse-shield.conf"
echo ""
echo "Security Features Enabled:"
echo "- WSGI server (Gunicorn) with multiple workers"
echo "- Nginx reverse proxy with rate limiting"
echo "- UFW firewall configured"
echo "- Fail2ban intrusion prevention"
echo "- Security headers and CSRF protection"
echo "- Input validation and sanitization"
echo "- Encrypted session storage"
echo "- Automated backups"
echo ""
echo "API Key: $API_KEY"
echo "Secret Key: $SECRET_KEY"
echo ""
print_warning "Please:"
print_warning "1. Change the server_name in Nginx config to your domain"
print_warning "2. Set up SSL/TLS certificates (Let's Encrypt recommended)"
print_warning "3. Update DNS records to point to this server"
print_warning "4. Store the API key securely"
print_warning "5. Monitor logs regularly: /var/log/eclipse-shield/"

echo ""
print_status "Access your application at: http://your-domain-or-ip"
