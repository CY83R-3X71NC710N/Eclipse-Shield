# Monitoring Guide

## Overview

Eclipse Shield provides comprehensive monitoring capabilities for security events, performance metrics, and business intelligence. This guide covers setting up monitoring, alerting, and observability for both development and production environments.

## Monitoring Stack

### Core Components

- **Application Logs**: Structured logging for application events
- **Security Logs**: Dedicated security event tracking
- **Performance Metrics**: Response times, throughput, and resource usage
- **Health Checks**: Automated service health monitoring
- **Error Tracking**: Exception monitoring and debugging

## Application Logging

### Log Configuration

Eclipse Shield uses structured logging with JSON format for easy parsing:

```python
# logging_config.py
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    def format(self, record):
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno
        }
        
        # Add extra fields if present
        if hasattr(record, 'user_ip'):
            log_entry['user_ip'] = record.user_ip
        if hasattr(record, 'endpoint'):
            log_entry['endpoint'] = record.endpoint
        if hasattr(record, 'response_time'):
            log_entry['response_time'] = record.response_time
            
        return json.dumps(log_entry)
```

### Log Levels and Categories

#### Application Logs (`/var/log/eclipse-shield/app.log`)
```python
# Example log entries
logger.info("URL analysis completed", extra={
    'url': sanitized_url,
    'context': context,
    'decision': decision,
    'confidence': confidence,
    'response_time': elapsed_time
})

logger.warning("Rate limit approaching", extra={
    'user_ip': user_ip,
    'current_rate': current_requests,
    'limit': rate_limit
})

logger.error("AI API failure", extra={
    'error_type': 'api_timeout',
    'api_endpoint': 'gemini',
    'retry_count': retry_count
})
```

#### Security Logs (`/var/log/eclipse-shield/security.log`)
```python
# Security event logging
security_logger.warning("Authentication failed", extra={
    'user_ip': request.remote_addr,
    'api_key_prefix': api_key[:8] + '***',
    'endpoint': request.endpoint,
    'user_agent': request.user_agent.string
})

security_logger.critical("Multiple auth failures detected", extra={
    'user_ip': user_ip,
    'failure_count': failure_count,
    'time_window': '5min',
    'action': 'ip_blocked'
})
```

#### Access Logs (`/var/log/eclipse-shield/access.log`)
```
# Nginx-style access logs with additional fields
127.0.0.1 - - [25/Jul/2025:10:30:00 +0000] "POST /analyze HTTP/1.1" 200 156 "-" "Eclipse-Shield-Extension/1.0" rt=0.245 uct="0.123" uht="0.089" urt="0.033"
```

## Performance Monitoring

### Response Time Tracking

```python
# Custom middleware for response time monitoring
class ResponseTimeMiddleware:
    def __init__(self, app):
        self.app = app
        
    def __call__(self, environ, start_response):
        start_time = time.time()
        
        def new_start_response(status, response_headers, exc_info=None):
            duration = time.time() - start_time
            
            # Log response time
            logger.info("Request completed", extra={
                'endpoint': environ.get('PATH_INFO'),
                'method': environ.get('REQUEST_METHOD'),
                'status_code': status.split()[0],
                'response_time': round(duration * 1000, 2)  # milliseconds
            })
            
            return start_response(status, response_headers, exc_info)
            
        return self.app(environ, new_start_response)
```

### Key Performance Indicators (KPIs)

#### Response Time Metrics
- **P50 Response Time**: Median response time
- **P95 Response Time**: 95th percentile response time
- **P99 Response Time**: 99th percentile response time
- **Average Response Time**: Mean response time across all requests

#### Throughput Metrics
- **Requests per Minute**: Total request rate
- **Successful Requests**: HTTP 2xx responses
- **Error Rate**: Percentage of HTTP 4xx/5xx responses
- **API Calls per Minute**: External API call frequency

#### Resource Utilization
- **CPU Usage**: Application process CPU consumption
- **Memory Usage**: RAM consumption and garbage collection
- **Disk I/O**: Log writing and temporary file operations
- **Network I/O**: Bandwidth usage for API calls

### Custom Metrics Collection

```python
# metrics.py
import time
from collections import defaultdict
from threading import Lock

class MetricsCollector:
    def __init__(self):
        self.metrics = defaultdict(list)
        self.counters = defaultdict(int)
        self.lock = Lock()
    
    def record_response_time(self, endpoint, duration):
        with self.lock:
            self.metrics[f'response_time_{endpoint}'].append(duration)
    
    def increment_counter(self, metric_name):
        with self.lock:
            self.counters[metric_name] += 1
    
    def get_stats(self):
        with self.lock:
            stats = {}
            
            # Calculate response time percentiles
            for metric, values in self.metrics.items():
                if values:
                    sorted_values = sorted(values)
                    stats[metric] = {
                        'count': len(values),
                        'min': min(values),
                        'max': max(values),
                        'avg': sum(values) / len(values),
                        'p50': sorted_values[len(values) // 2],
                        'p95': sorted_values[int(len(values) * 0.95)],
                        'p99': sorted_values[int(len(values) * 0.99)]
                    }
            
            # Add counters
            stats['counters'] = dict(self.counters)
            
            return stats

# Global metrics instance
metrics = MetricsCollector()
```

## Health Checks

### Application Health Endpoint

```python
@app.route('/health')
def health_check():
    """Comprehensive health check endpoint"""
    health_status = {
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': app.config.get('VERSION', '1.0.0'),
        'checks': {}
    }
    
    # Check AI API connectivity
    try:
        # Quick test API call
        response = test_gemini_api()
        health_status['checks']['ai_api'] = 'ok'
    except Exception as e:
        health_status['checks']['ai_api'] = f'error: {str(e)[:100]}'
        health_status['status'] = 'degraded'
    
    # Check Redis connectivity
    try:
        redis_client.ping()
        health_status['checks']['redis'] = 'ok'
    except Exception as e:
        health_status['checks']['redis'] = f'error: {str(e)[:100]}'
        health_status['status'] = 'degraded'
    
    # Check disk space
    try:
        disk_usage = get_disk_usage()
        if disk_usage > 90:
            health_status['checks']['disk_space'] = f'warning: {disk_usage}% used'
            health_status['status'] = 'degraded'
        else:
            health_status['checks']['disk_space'] = f'ok: {disk_usage}% used'
    except Exception:
        health_status['checks']['disk_space'] = 'error: cannot check'
    
    # Return appropriate HTTP status
    status_code = 200 if health_status['status'] == 'healthy' else 503
    return jsonify(health_status), status_code
```

### External Health Monitoring

#### Simple HTTP Monitoring Script
```bash
#!/bin/bash
# health-monitor.sh

URL="https://example.com/health"
WEBHOOK_URL="https://your-webhook-endpoint.com"
LOG_FILE="/var/log/eclipse-shield/health-monitor.log"

check_health() {
    response=$(curl -s -w "%{http_code}" "$URL")
    http_code="${response: -3}"
    body="${response%???}"
    
    if [ "$http_code" != "200" ]; then
        echo "[$(date)] Health check failed: HTTP $http_code" >> "$LOG_FILE"
        echo "Eclipse Shield health check failed at $(date)" | \
            curl -X POST "$WEBHOOK_URL" -d "Eclipse Shield Health Alert"
        return 1
    else
        echo "[$(date)] Health check passed" >> "$LOG_FILE"
        return 0
    fi
}

check_health
```

#### Advanced Monitoring with Nagios/Icinga
```bash
#!/bin/bash
# nagios-check-eclipse-shield.sh

STATE_OK=0
STATE_WARNING=1
STATE_CRITICAL=2
STATE_UNKNOWN=3

URL="$1"
if [ -z "$URL" ]; then
    echo "UNKNOWN - URL parameter required"
    exit $STATE_UNKNOWN
fi

response=$(curl -s -w "%{http_code}:%{time_total}" "$URL" 2>/dev/null)
if [ $? -ne 0 ]; then
    echo "CRITICAL - Cannot connect to Eclipse Shield"
    exit $STATE_CRITICAL
fi

http_code=$(echo "$response" | cut -d: -f1)
response_time=$(echo "$response" | cut -d: -f2)
body=$(echo "$response" | sed 's/[0-9]*:[0-9.]*$//')

if [ "$http_code" = "200" ]; then
    status=$(echo "$body" | jq -r '.status' 2>/dev/null)
    if [ "$status" = "healthy" ]; then
        echo "OK - Eclipse Shield healthy (${response_time}s)"
        exit $STATE_OK
    elif [ "$status" = "degraded" ]; then
        echo "WARNING - Eclipse Shield degraded (${response_time}s)"
        exit $STATE_WARNING
    fi
fi

echo "CRITICAL - Eclipse Shield unhealthy (HTTP: $http_code)"
exit $STATE_CRITICAL
```

## Security Event Monitoring

### Failed Authentication Tracking

```python
# Track authentication failures
class AuthFailureTracker:
    def __init__(self, redis_client):
        self.redis = redis_client
        
    def record_failure(self, ip_address, api_key_prefix=None):
        key = f"auth_failures:{ip_address}"
        pipe = self.redis.pipeline()
        
        # Increment failure count
        pipe.incr(key)
        pipe.expire(key, 900)  # 15 minute window
        
        # Record details
        failure_data = {
            'timestamp': time.time(),
            'ip': ip_address,
            'api_key_prefix': api_key_prefix,
            'user_agent': request.user_agent.string[:200]
        }
        
        pipe.lpush(f"auth_failure_details:{ip_address}", 
                  json.dumps(failure_data))
        pipe.expire(f"auth_failure_details:{ip_address}", 3600)
        pipe.ltrim(f"auth_failure_details:{ip_address}", 0, 99)  # Keep last 100
        
        results = pipe.execute()
        failure_count = results[0]
        
        # Alert on threshold
        if failure_count >= 5:
            self.alert_security_team(ip_address, failure_count)
            
        return failure_count
    
    def alert_security_team(self, ip_address, failure_count):
        alert_data = {
            'type': 'authentication_failure_threshold',
            'ip_address': ip_address,
            'failure_count': failure_count,
            'timestamp': datetime.utcnow().isoformat(),
            'action_required': 'consider_ip_blocking'
        }
        
        # Log critical security event
        security_logger.critical("Authentication failure threshold exceeded", 
                               extra=alert_data)
        
        # Send to security monitoring system
        send_security_alert(alert_data)
```

### Rate Limiting Monitoring

```python
# Monitor rate limiting effectiveness
class RateLimitMonitor:
    def __init__(self, redis_client):
        self.redis = redis_client
    
    def record_rate_limit_hit(self, ip_address, endpoint):
        """Record when rate limit is exceeded"""
        timestamp = int(time.time())
        hour_key = f"rate_limits_hit:{timestamp // 3600}"
        
        pipe = self.redis.pipeline()
        pipe.hincrby(hour_key, f"{ip_address}:{endpoint}", 1)
        pipe.expire(hour_key, 86400)  # Keep for 24 hours
        pipe.execute()
        
        # Log for analysis
        logger.warning("Rate limit exceeded", extra={
            'ip_address': ip_address,
            'endpoint': endpoint,
            'timestamp': timestamp
        })
    
    def get_rate_limit_stats(self, hours=24):
        """Get rate limiting statistics"""
        current_hour = int(time.time()) // 3600
        stats = {}
        
        for hour_offset in range(hours):
            hour_key = f"rate_limits_hit:{current_hour - hour_offset}"
            hour_data = self.redis.hgetall(hour_key)
            
            if hour_data:
                stats[hour_key] = {}
                for key, count in hour_data.items():
                    ip, endpoint = key.decode().split(':', 1)
                    if endpoint not in stats[hour_key]:
                        stats[hour_key][endpoint] = {}
                    stats[hour_key][endpoint][ip] = int(count)
        
        return stats
```

## Log Analysis and Alerting

### Real-time Log Monitoring

```bash
#!/bin/bash
# log-monitor.sh - Real-time log analysis

SECURITY_LOG="/var/log/eclipse-shield/security.log"
APP_LOG="/var/log/eclipse-shield/app.log"
ALERT_WEBHOOK="https://your-security-webhook.com"

# Monitor for security events
tail -F "$SECURITY_LOG" | while read line; do
    # Check for critical security events
    if echo "$line" | grep -q "CRITICAL"; then
        echo "SECURITY ALERT: $line" | \
            curl -X POST "$ALERT_WEBHOOK" -d "Eclipse Shield Security Alert"
    fi
    
    # Check for authentication failures
    if echo "$line" | grep -q "Authentication failed"; then
        ip=$(echo "$line" | jq -r '.user_ip' 2>/dev/null)
        if [ -n "$ip" ]; then
            # Count recent failures from this IP
            failure_count=$(grep "$ip" "$SECURITY_LOG" | \
                          tail -50 | grep "Authentication failed" | wc -l)
            
            if [ "$failure_count" -ge 10 ]; then
                echo "High authentication failure rate from $ip: $failure_count attempts" | \
                    curl -X POST "$ALERT_WEBHOOK" -d "Potential Brute Force Attack"
            fi
        fi
    fi
done &

# Monitor application performance
tail -F "$APP_LOG" | while read line; do
    response_time=$(echo "$line" | jq -r '.response_time' 2>/dev/null)
    
    if [ -n "$response_time" ] && [ "$response_time" != "null" ]; then
        # Alert on slow responses (>2000ms)
        if (( $(echo "$response_time > 2000" | bc -l) )); then
            endpoint=$(echo "$line" | jq -r '.endpoint' 2>/dev/null)
            echo "Slow response detected: ${endpoint} took ${response_time}ms" | \
                curl -X POST "$ALERT_WEBHOOK" -d "Eclipse Shield Performance Alert"
        fi
    fi
done &
```

### Log Aggregation with ELK Stack

#### Logstash Configuration
```ruby
# logstash.conf
input {
  file {
    path => "/var/log/eclipse-shield/*.log"
    start_position => "beginning"
    codec => "json"
    type => "eclipse-shield"
  }
}

filter {
  if [type] == "eclipse-shield" {
    date {
      match => [ "timestamp", "ISO8601" ]
    }
    
    # Parse IP addresses for geolocation
    if [user_ip] {
      geoip {
        source => "user_ip"
        target => "geoip"
      }
    }
    
    # Categorize log levels
    if [level] == "ERROR" or [level] == "CRITICAL" {
      mutate {
        add_tag => [ "alert" ]
      }
    }
    
    # Parse response times
    if [response_time] {
      mutate {
        convert => { "response_time" => "float" }
      }
    }
  }
}

output {
  elasticsearch {
    hosts => ["localhost:9200"]
    index => "eclipse-shield-%{+YYYY.MM.dd}"
  }
  
  # Send alerts to separate index
  if "alert" in [tags] {
    elasticsearch {
      hosts => ["localhost:9200"]
      index => "eclipse-shield-alerts-%{+YYYY.MM.dd}"
    }
  }
}
```

#### Kibana Dashboard Queries

**Response Time Visualization**:
```json
{
  "query": {
    "bool": {
      "must": [
        {"range": {"@timestamp": {"gte": "now-1h"}}},
        {"exists": {"field": "response_time"}}
      ]
    }
  },
  "aggs": {
    "response_time_percentiles": {
      "percentiles": {
        "field": "response_time",
        "percents": [50, 95, 99]
      }
    }
  }
}
```

**Security Events Dashboard**:
```json
{
  "query": {
    "bool": {
      "must": [
        {"range": {"@timestamp": {"gte": "now-24h"}}},
        {"terms": {"level": ["WARNING", "ERROR", "CRITICAL"]}}
      ]
    }
  },
  "aggs": {
    "events_by_type": {
      "terms": {"field": "message.keyword"}
    },
    "events_by_ip": {
      "terms": {"field": "user_ip.keyword"}
    }
  }
}
```

## Alerting Configuration

### Webhook Alerts
```python
# alerts.py
import smtplib
import requests
import json

class AlertManager:
    def __init__(self, smtp_config):
        self.smtp_config = smtp_config
    
    def send_security_alert(self, alert_type, details):
        subject = f"Eclipse Shield Security Alert: {alert_type}"
        
        message = MIMEMultipart()
        payload = {
            "alert": subject,
            "message": message,
            "severity": "high"
        }
        response = requests.post(
            self.webhook_config['security_webhook'],
            json=payload,
            timeout=10
        )
        message["Subject"] = subject
        
        body = f"""
        Security Alert Details:
        
        Type: {alert_type}
        Timestamp: {details.get('timestamp')}
        Severity: {details.get('severity', 'HIGH')}
        
        Details:
        {json.dumps(details, indent=2)}
        
        Action Required: {details.get('action_required', 'Review and investigate')}
        """
        
        message.attach(MIMEText(body, "plain"))
        
        try:
            with smtplib.SMTP(self.smtp_config['server'], self.smtp_config['port']) as server:
                if self.smtp_config.get('use_tls'):
                    server.starttls()
                if self.smtp_config.get('username'):
                    server.login(self.smtp_config['username'], self.smtp_config['password'])
                server.send_message(message)
        except Exception as e:
            logger.error(f"Failed to send security alert: {e}")
```

### Slack Integration
```python
# slack_alerts.py
import requests
import json

class SlackAlerts:
    def __init__(self, webhook_url):
        self.webhook_url = webhook_url
    
    def send_alert(self, alert_type, details, severity="warning"):
        colors = {
            "info": "#36a64f",
            "warning": "#ffcc00", 
            "error": "#ff0000",
            "critical": "#ff0000"
        }
        
        payload = {
            "attachments": [
                {
                    "color": colors.get(severity, "#ffcc00"),
                    "title": f"Eclipse Shield Alert: {alert_type}",
                    "fields": [
                        {
                            "title": "Severity",
                            "value": severity.upper(),
                            "short": True
                        },
                        {
                            "title": "Timestamp", 
                            "value": details.get('timestamp'),
                            "short": True
                        }
                    ],
                    "text": json.dumps(details, indent=2)
                }
            ]
        }
        
        try:
            response = requests.post(self.webhook_url, json=payload)
            response.raise_for_status()
        except Exception as e:
            logger.error(f"Failed to send Slack alert: {e}")
```

## Maintenance and Cleanup

### Log Rotation
```bash
# /etc/logrotate.d/eclipse-shield
/var/log/eclipse-shield/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 eclipse-shield eclipse-shield
    postrotate
        systemctl reload eclipse-shield || true
    endscript
}
```

### Automated Cleanup Scripts
```bash
#!/bin/bash
# cleanup-old-data.sh

# Clean old Redis keys
redis-cli --scan --pattern "rate_limit:*" | \
    xargs -L 100 redis-cli eval "
        for i=1,#ARGV do
            local ttl = redis.call('TTL', ARGV[i])
            if ttl > 0 and ttl < 300 then
                redis.call('DEL', ARGV[i])
            end
        end
    " 0

# Clean old log files
find /var/log/eclipse-shield -name "*.log.*" -mtime +30 -delete

# Clean old backup files
find /opt/backups/eclipse-shield -name "*.tar.gz" -mtime +90 -delete

echo "Cleanup completed at $(date)"
```

This comprehensive monitoring setup provides visibility into all aspects of Eclipse Shield's operation, from basic health checks to advanced security event detection and performance analysis.
