# Backup & Recovery Guide

## Overview

This guide covers comprehensive backup and recovery procedures for Eclipse Shield, ensuring data protection and business continuity in production environments.

## Backup Strategy

### Backup Types

#### 1. Application Code Backup
- **Frequency**: Before each deployment
- **Retention**: 30 days
- **Storage**: Local and remote repositories

#### 2. Configuration Backup
- **Frequency**: Daily
- **Retention**: 90 days
- **Includes**: Environment files, settings, certificates

#### 3. Data Backup
- **Frequency**: Continuous (Redis) + Daily snapshots
- **Retention**: 30 days for continuous, 1 year for snapshots
- **Includes**: User sessions, cache data, rate limiting data

#### 4. Log Backup
- **Frequency**: Daily
- **Retention**: 1 year
- **Includes**: Application logs, security logs, access logs

## Automated Backup Implementation

### Master Backup Script

```bash
#!/bin/bash
# /opt/eclipse-shield/scripts/backup.sh

set -euo pipefail

# Configuration
BACKUP_DIR="/opt/backups/eclipse-shield"
APP_DIR="/opt/eclipse-shield/app"
LOG_DIR="/var/log/eclipse-shield"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
S3_BUCKET="your-backup-bucket"  # Optional remote storage

# Logging
BACKUP_LOG="/var/log/eclipse-shield/backup.log"
exec 1> >(tee -a "$BACKUP_LOG")
exec 2>&1

echo "=== Eclipse Shield Backup Started: $(date) ==="

# Create backup directory structure
mkdir -p "$BACKUP_DIR"/{application,config,data,logs}

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to handle errors
handle_error() {
    log "ERROR: Backup failed at step: $1"
    exit 1
}

# 1. Application Code Backup
log "Backing up application code..."
tar -czf "$BACKUP_DIR/application/app_$DATE.tar.gz" \
    -C "$(dirname "$APP_DIR")" \
    "$(basename "$APP_DIR")" \
    --exclude='*.pyc' \
    --exclude='__pycache__' \
    --exclude='.git' \
    --exclude='venv' \
    --exclude='logs' || handle_error "application backup"

# 2. Configuration Backup
log "Backing up configuration files..."
CONFIG_BACKUP="$BACKUP_DIR/config/config_$DATE.tar.gz"
tar -czf "$CONFIG_BACKUP" \
    "$APP_DIR/.env" \
    "$APP_DIR/settings.json" \
    "$APP_DIR/api_key.txt" \
    "/etc/nginx/sites-available/eclipse-shield" \
    "/etc/supervisor/conf.d/eclipse-shield.conf" \
    "/etc/ssl/certs/eclipse-shield*" 2>/dev/null || true

# 3. Redis Data Backup
log "Backing up Redis data..."
redis-cli --rdb "$BACKUP_DIR/data/redis_$DATE.rdb" || handle_error "redis backup"

# Create Redis configuration backup
redis-cli CONFIG GET '*' > "$BACKUP_DIR/data/redis_config_$DATE.txt"

# 4. Log Backup
log "Backing up logs..."
tar -czf "$BACKUP_DIR/logs/logs_$DATE.tar.gz" \
    "$LOG_DIR" \
    --exclude='*.gz' || handle_error "log backup"

# 5. Redis Cache Backup (if available)
if command -v redis-cli &> /dev/null; then
    log "Backing up Redis cache..."
    redis-cli --rdb "$BACKUP_DIR/data/redis_$DATE.rdb" || handle_error "redis backup"
fi

# 6. Create backup manifest
log "Creating backup manifest..."
MANIFEST="$BACKUP_DIR/manifest_$DATE.json"
cat > "$MANIFEST" << EOF
{
    "backup_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "backup_version": "1.0",
    "application_version": "$(cd "$APP_DIR" && git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "files": {
        "application": "application/app_$DATE.tar.gz",
        "config": "config/config_$DATE.tar.gz", 
        "redis_data": "data/redis_$DATE.rdb",
        "redis_config": "data/redis_config_$DATE.txt",
        "logs": "logs/logs_$DATE.tar.gz"
    },
    "checksums": {
EOF

# Calculate checksums
for file in application/app_$DATE.tar.gz config/config_$DATE.tar.gz data/redis_$DATE.rdb logs/logs_$DATE.tar.gz; do
    if [[ -f "$BACKUP_DIR/$file" ]]; then
        checksum=$(sha256sum "$BACKUP_DIR/$file" | cut -d' ' -f1)
        echo "        \"$file\": \"$checksum\"," >> "$MANIFEST"
    fi
done

# Close JSON
sed -i '$ s/,$//' "$MANIFEST"
cat >> "$MANIFEST" << EOF
    }
}
EOF

# 7. Upload to remote storage (if configured)
if [[ -n "${S3_BUCKET:-}" ]] && command -v aws &> /dev/null; then
    log "Uploading backup to S3..."
    aws s3 sync "$BACKUP_DIR" "s3://$S3_BUCKET/eclipse-shield/$(date +%Y/%m/%d)/" \
        --exclude "*.tmp" || log "WARNING: S3 upload failed"
fi

# 8. Clean old backups
log "Cleaning old backups..."
find "$BACKUP_DIR" -type f -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -type f -name "*.rdb" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -type f -name "*.sql" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -type f -name "*.json" -mtime +$RETENTION_DAYS -delete

# 9. Verify backup integrity
log "Verifying backup integrity..."
if [[ -f "$MANIFEST" ]]; then
    while IFS= read -r line; do
        if [[ $line =~ \"([^\"]+)\":\ \"([^\"]+)\" ]]; then
            file="${BASH_REMATCH[1]}"
            expected_checksum="${BASH_REMATCH[2]}"
            
            if [[ -f "$BACKUP_DIR/$file" ]]; then
                actual_checksum=$(sha256sum "$BACKUP_DIR/$file" | cut -d' ' -f1)
                if [[ "$actual_checksum" != "$expected_checksum" ]]; then
                    log "ERROR: Checksum mismatch for $file"
                    exit 1
                fi
            fi
        fi
    done < <(grep -o '"[^"]*": "[^"]*"' "$MANIFEST")
    log "Backup integrity verified successfully"
fi

log "=== Eclipse Shield Backup Completed Successfully: $(date) ==="
```

### Cron Job Configuration

```bash
# /etc/cron.d/eclipse-shield-backup

# Daily backup at 2:30 AM
30 2 * * * eclipse-shield /opt/eclipse-shield/scripts/backup.sh

# Weekly full system backup on Sundays at 1:00 AM
0 1 * * 0 eclipse-shield /opt/eclipse-shield/scripts/full-backup.sh

# Monthly configuration verification
0 3 1 * * eclipse-shield /opt/eclipse-shield/scripts/verify-backups.sh
```

## Continuous Backup (Redis)

### Redis Persistence Configuration

```bash
# /etc/redis/redis.conf

# RDB Snapshots
save 900 1      # Save if at least 1 key changed in 900 seconds
save 300 10     # Save if at least 10 keys changed in 300 seconds  
save 60 10000   # Save if at least 10000 keys changed in 60 seconds

# RDB file location
dir /var/lib/redis
dbfilename eclipse-shield.rdb

# Enable RDB checksum
rdbchecksum yes

# Compress RDB files
rdbcompression yes

# AOF (Append Only File) for durability
appendonly yes
appendfilename "eclipse-shield.aof"
appendfsync everysec

# AOF rewrite configuration
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb
```

### Redis Backup Script

```bash
#!/bin/bash
# /opt/eclipse-shield/scripts/redis-backup.sh

BACKUP_DIR="/opt/backups/eclipse-shield/redis"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_HOURS=72

mkdir -p "$BACKUP_DIR"

# Create consistent backup
redis-cli BGSAVE
while [[ $(redis-cli LASTSAVE) == $(redis-cli LASTSAVE) ]]; do
    sleep 1
done

# Copy RDB file
cp /var/lib/redis/eclipse-shield.rdb "$BACKUP_DIR/redis_$DATE.rdb"

# Copy AOF file if it exists
if [[ -f /var/lib/redis/eclipse-shield.aof ]]; then
    cp /var/lib/redis/eclipse-shield.aof "$BACKUP_DIR/redis_$DATE.aof"
fi

# Compress backups
gzip "$BACKUP_DIR/redis_$DATE.rdb"
[[ -f "$BACKUP_DIR/redis_$DATE.aof" ]] && gzip "$BACKUP_DIR/redis_$DATE.aof"

# Clean old backups
find "$BACKUP_DIR" -name "*.gz" -mmin +$((RETENTION_HOURS * 60)) -delete

echo "Redis backup completed: $DATE"
```

## Recovery Procedures

### Complete System Recovery

```bash
#!/bin/bash
# /opt/eclipse-shield/scripts/restore.sh

set -euo pipefail

BACKUP_DATE="$1"
BACKUP_DIR="/opt/backups/eclipse-shield"
APP_DIR="/opt/eclipse-shield/app"

if [[ -z "$BACKUP_DATE" ]]; then
    echo "Usage: $0 <backup_date>"
    echo "Available backups:"
    ls -la "$BACKUP_DIR"/manifest_*.json | sed 's/.*manifest_\(.*\)\.json/\1/'
    exit 1
fi

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting system recovery for backup: $BACKUP_DATE"

# 1. Stop services
log "Stopping Eclipse Shield services..."
systemctl stop nginx
supervisorctl stop eclipse-shield:*
systemctl stop redis-server

# 2. Backup current state (just in case)
log "Creating safety backup of current state..."
tar -czf "/tmp/pre-restore-backup-$(date +%s).tar.gz" "$APP_DIR" || true

# 3. Restore application code
log "Restoring application code..."
if [[ -f "$BACKUP_DIR/application/app_$BACKUP_DATE.tar.gz" ]]; then
    rm -rf "$APP_DIR.old" || true
    mv "$APP_DIR" "$APP_DIR.old" || true
    mkdir -p "$(dirname "$APP_DIR")"
    tar -xzf "$BACKUP_DIR/application/app_$BACKUP_DATE.tar.gz" -C "$(dirname "$APP_DIR")"
    chown -R eclipse-shield:eclipse-shield "$APP_DIR"
else
    log "ERROR: Application backup not found for $BACKUP_DATE"
    exit 1
fi

# 4. Restore configuration
log "Restoring configuration..."
if [[ -f "$BACKUP_DIR/config/config_$BACKUP_DATE.tar.gz" ]]; then
    tar -xzf "$BACKUP_DIR/config/config_$BACKUP_DATE.tar.gz" -C /
else
    log "WARNING: Configuration backup not found, using existing config"
fi

# 5. Restore Redis data
log "Restoring Redis data..."
if [[ -f "$BACKUP_DIR/data/redis_$BACKUP_DATE.rdb" ]]; then
    systemctl stop redis-server || true
    cp "$BACKUP_DIR/data/redis_$BACKUP_DATE.rdb" /var/lib/redis/eclipse-shield.rdb
    chown redis:redis /var/lib/redis/eclipse-shield.rdb
    chmod 640 /var/lib/redis/eclipse-shield.rdb
fi

# 6. Restore virtual environment if needed
log "Checking Python virtual environment..."
if [[ ! -d "$APP_DIR/venv" ]]; then
    log "Recreating virtual environment..."
    cd "$APP_DIR"
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements-secure.txt
    chown -R eclipse-shield:eclipse-shield venv
fi

# 7. Verify configuration
log "Verifying configuration..."
if [[ ! -f "$APP_DIR/.env" ]]; then
    log "ERROR: .env file missing after restore"
    exit 1
fi

if [[ ! -f "$APP_DIR/api_key.txt" ]]; then
    log "ERROR: api_key.txt missing after restore"
    exit 1
fi

# 8. Start services
log "Starting services..."
systemctl start redis-server
sleep 5

# Test Redis connectivity
if ! redis-cli ping > /dev/null; then
    log "ERROR: Redis not responding after restore"
    exit 1
fi

# Start application
supervisorctl start eclipse-shield:*
sleep 10

# Test application
if ! curl -f http://localhost:8000/health > /dev/null 2>&1; then
    log "ERROR: Application not responding after restore"
    exit 1
fi

# Start nginx
systemctl start nginx

# 9. Final verification
log "Performing final verification..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    log "SUCCESS: System restore completed successfully"
    rm -rf "$APP_DIR.old" || true
else
    log "ERROR: Final verification failed"
    exit 1
fi

log "Recovery completed for backup: $BACKUP_DATE"
```

### Partial Recovery Procedures

#### Application Code Only
```bash
#!/bin/bash
# restore-app-only.sh

BACKUP_DATE="$1"
BACKUP_FILE="/opt/backups/eclipse-shield/application/app_$BACKUP_DATE.tar.gz"

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# Stop application but keep data services running
supervisorctl stop eclipse-shield:*

# Restore application code
cd /opt/eclipse-shield
mv app app.backup.$(date +%s)
tar -xzf "$BACKUP_FILE"
chown -R eclipse-shield:eclipse-shield app

# Restart application
supervisorctl start eclipse-shield:*

echo "Application restored from backup: $BACKUP_DATE"
```

#### Redis Data Only
```bash
#!/bin/bash
# restore-redis-only.sh

BACKUP_DATE="$1"
BACKUP_FILE="/opt/backups/eclipse-shield/data/redis_$BACKUP_DATE.rdb"

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "Redis backup file not found: $BACKUP_FILE"
    exit 1
fi

# Stop Redis
systemctl stop redis-server

# Backup current data
cp /var/lib/redis/eclipse-shield.rdb /var/lib/redis/eclipse-shield.rdb.backup.$(date +%s)

# Restore from backup
cp "$BACKUP_FILE" /var/lib/redis/eclipse-shield.rdb
chown redis:redis /var/lib/redis/eclipse-shield.rdb
chmod 640 /var/lib/redis/eclipse-shield.rdb

# Start Redis
systemctl start redis-server

# Wait and verify
sleep 5
if redis-cli ping > /dev/null; then
    echo "Redis data restored successfully from backup: $BACKUP_DATE"
else
    echo "ERROR: Redis failed to start after restore"
    exit 1
fi
```

## Disaster Recovery Planning

### Recovery Time Objectives (RTO)

| Component | Target RTO | Procedure |
|-----------|------------|-----------|
| Application | 15 minutes | Rolling deployment |
| Configuration | 5 minutes | Config file restore |
| Redis Data | 10 minutes | RDB/AOF restore |
| Full System | 30 minutes | Complete rebuild |

### Recovery Point Objectives (RPO)

| Data Type | Target RPO | Backup Frequency |
|-----------|------------|------------------|
| Application Code | 0 minutes | Git repository |
| Configuration | 24 hours | Daily backup |
| User Sessions | 1 hour | Redis persistence |
| Security Logs | 0 minutes | Real-time shipping |
| Analytics Data | 15 minutes | Continuous backup |

### Disaster Scenarios

#### Scenario 1: Server Hardware Failure
```bash
# Emergency recovery on new server
#!/bin/bash

# 1. Provision new server with same OS
# 2. Install base dependencies
apt update && apt install -y python3 python3-pip redis-server nginx supervisor

# 3. Restore from latest backup
scp backup-server:/opt/backups/eclipse-shield/latest/* /tmp/
/opt/eclipse-shield/scripts/restore.sh $(ls /tmp/manifest_*.json | sed 's/.*manifest_\(.*\)\.json/\1/')

# 4. Update DNS to point to new server
# 5. Verify system functionality
```

#### Scenario 2: Data Corruption
```bash
# Point-in-time recovery
#!/bin/bash

# 1. Identify last known good backup
# 2. Stop current system
systemctl stop nginx
supervisorctl stop eclipse-shield:*

# 3. Restore from point-in-time backup
/opt/eclipse-shield/scripts/restore.sh 20250725_020000

# 4. Analyze what caused corruption
# 5. Implement fixes and restart
```

#### Scenario 3: Security Breach
```bash
# Security incident recovery
#!/bin/bash

# 1. Immediate isolation
iptables -A INPUT -j DROP
iptables -A OUTPUT -j DROP
iptables -I INPUT 1 -i lo -j ACCEPT
iptables -I OUTPUT 1 -o lo -j ACCEPT

# 2. Collect forensic evidence
tar -czf /tmp/forensics-$(date +%s).tar.gz /var/log/eclipse-shield/

# 3. Clean restore from known good backup
# 4. Security hardening review
# 5. Gradual service restoration
```

## Backup Verification

### Automated Verification Script
```bash
#!/bin/bash
# /opt/eclipse-shield/scripts/verify-backups.sh

BACKUP_DIR="/opt/backups/eclipse-shield"
TEMP_DIR="/tmp/backup-verification"
DATE=$(date +%Y%m%d_%H%M%S)

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Test latest backup
LATEST_MANIFEST=$(ls -t "$BACKUP_DIR"/manifest_*.json | head -1)
if [[ -z "$LATEST_MANIFEST" ]]; then
    log "ERROR: No backup manifests found"
    exit 1
fi

BACKUP_DATE=$(basename "$LATEST_MANIFEST" .json | sed 's/manifest_//')
log "Verifying backup: $BACKUP_DATE"

# Create temp directory
rm -rf "$TEMP_DIR"
mkdir -p "$TEMP_DIR"

# Verify checksums
log "Verifying file integrity..."
cd "$BACKUP_DIR"
while IFS= read -r line; do
    if [[ $line =~ \"([^\"]+)\":\ \"([^\"]+)\" ]]; then
        file="${BASH_REMATCH[1]}"
        expected_checksum="${BASH_REMATCH[2]}"
        
        if [[ -f "$file" ]]; then
            actual_checksum=$(sha256sum "$file" | cut -d' ' -f1)
            if [[ "$actual_checksum" != "$expected_checksum" ]]; then
                log "ERROR: Checksum mismatch for $file"
                exit 1
            else
                log "✓ $file integrity verified"
            fi
        else
            log "ERROR: Missing backup file: $file"
            exit 1
        fi
    fi
done < <(grep -o '"[^"]*": "[^"]*"' "$LATEST_MANIFEST")

# Test extractability
log "Testing backup extractability..."
tar -tzf "application/app_$BACKUP_DATE.tar.gz" > /dev/null || {
    log "ERROR: Cannot extract application backup"
    exit 1
}

tar -tzf "config/config_$BACKUP_DATE.tar.gz" > /dev/null || {
    log "ERROR: Cannot extract config backup"
    exit 1
}

# Test Redis RDB file
if command -v redis-check-rdb &> /dev/null; then
    redis-check-rdb "data/redis_$BACKUP_DATE.rdb" || {
        log "ERROR: Redis RDB file is corrupted"
        exit 1
    }
    log "✓ Redis RDB file verified"
fi

# Cleanup
rm -rf "$TEMP_DIR"

log "Backup verification completed successfully for: $BACKUP_DATE"
```

## Monitoring Backup Health

### Backup Status Dashboard
```python
# backup_monitor.py
import json
import os
import time
from datetime import datetime, timedelta

class BackupMonitor:
    def __init__(self, backup_dir):
        self.backup_dir = backup_dir
    
    def get_backup_status(self):
        """Generate backup status report"""
        status = {
            'last_backup': None,
            'backup_count': 0,
            'total_size': 0,
            'health': 'unknown',
            'issues': []
        }
        
        try:
            # Find all manifests
            manifests = []
            for file in os.listdir(self.backup_dir):
                if file.startswith('manifest_') and file.endswith('.json'):
                    manifest_path = os.path.join(self.backup_dir, file)
                    with open(manifest_path) as f:
                        manifest = json.load(f)
                        manifest['filename'] = file
                        manifests.append(manifest)
            
            if not manifests:
                status['health'] = 'critical'
                status['issues'].append('No backups found')
                return status
            
            # Sort by date
            manifests.sort(key=lambda x: x['backup_date'], reverse=True)
            
            # Latest backup info
            latest = manifests[0]
            status['last_backup'] = latest['backup_date']
            status['backup_count'] = len(manifests)
            
            # Check if backup is recent (within 25 hours)
            backup_time = datetime.fromisoformat(latest['backup_date'].replace('Z', '+00:00'))
            if datetime.now().astimezone() - backup_time > timedelta(hours=25):
                status['issues'].append('Latest backup is older than 25 hours')
            
            # Calculate total size
            for manifest in manifests:
                for file_path in manifest.get('files', {}).values():
                    full_path = os.path.join(self.backup_dir, file_path)
                    if os.path.exists(full_path):
                        status['total_size'] += os.path.getsize(full_path)
            
            # Determine health
            if len(status['issues']) == 0:
                status['health'] = 'healthy'
            elif len(status['issues']) <= 2:
                status['health'] = 'warning'
            else:
                status['health'] = 'critical'
                
        except Exception as e:
            status['health'] = 'error'
            status['issues'].append(f'Monitor error: {str(e)}')
        
        return status

# Integration with monitoring system
def backup_health_check():
    """Health check endpoint for backup status"""
    monitor = BackupMonitor('/opt/backups/eclipse-shield')
    status = monitor.get_backup_status()
    
    return {
        'status': 'healthy' if status['health'] in ['healthy', 'warning'] else 'unhealthy',
        'details': status
    }
```

This comprehensive backup and recovery system ensures that Eclipse Shield can recover quickly from various failure scenarios while maintaining data integrity and minimizing downtime.
