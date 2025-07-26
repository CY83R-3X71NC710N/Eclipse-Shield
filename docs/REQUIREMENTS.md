# System Requirements

## Minimum Requirements

### Hardware
- **CPU**: 1 core, 1 GHz processor
- **Memory**: 2GB RAM (4GB recommended)
- **Storage**: 1GB free disk space
- **Network**: Stable internet connection for AI API calls

### Operating Systems

#### Supported
- **macOS**: 10.15 (Catalina) or later
- **Linux**: Ubuntu 18.04+, CentOS 7+, Debian 10+
- **Windows**: Windows 10+ with WSL2 (for development)

#### Recommended
- **macOS**: 12.0+ (Monterey)
- **Linux**: Ubuntu 20.04+ LTS
- **Windows**: Windows 11 with WSL2

### Software Dependencies

#### Required
- **Python**: 3.8, 3.9, 3.10, or 3.11
- **pip**: Latest version (comes with Python)
- **Git**: For repository cloning

#### Optional (Development)
- **Redis**: 6.0+ for rate limiting and caching
- **Docker**: 20.10+ for containerized deployment
- **Docker Compose**: 2.0+ for multi-service deployment

#### Optional (Production)
- **Nginx**: 1.18+ for reverse proxy
- **Supervisor**: For process management
- **UFW/iptables**: For firewall configuration

## Browser Requirements

### Supported Browsers
- **Google Chrome**: Version 90+
- **Opera**: Version 75+
- **Chromium**: Version 90+

### Browser Extension Requirements
- Extension Developer Mode enabled
- Local file access permissions
- Storage permissions for settings

## API Requirements

### Google Gemini API
- **Account**: Google account with API access
- **Quota**: Minimum 100 requests per day (free tier sufficient for testing)
- **Key**: Valid API key from [Google AI Studio](https://aistudio.google.com/)

### Rate Limits (Google Gemini)
- **Free Tier**: 15 requests per minute, 1,500 requests per day
- **Paid Tier**: Higher limits available based on billing plan

## Network Requirements

### Outbound Connections
- **Port 443 (HTTPS)**: For Google Gemini API calls
- **Port 80/443**: For general web browsing analysis
- **Custom ports**: If running on non-standard ports

### Firewall Configuration
```bash
# Allow inbound on application port (default 5000)
sudo ufw allow 5000

# Allow outbound HTTPS for API calls
sudo ufw allow out 443
```

## Performance Specifications

### Recommended Hardware

#### Development Environment
- **CPU**: 2+ cores, 2.0+ GHz
- **Memory**: 4GB RAM
- **Storage**: 2GB SSD space
- **Network**: 10+ Mbps internet

#### Production Environment
- **CPU**: 4+ cores, 2.5+ GHz
- **Memory**: 8GB+ RAM
- **Storage**: 10GB+ SSD space
- **Network**: 100+ Mbps internet, low latency

### Performance Benchmarks

#### Response Times (typical)
- **URL Analysis**: 200-800ms (depends on AI processing)
- **Health Check**: <10ms
- **Static Files**: <50ms
- **Extension Communication**: <100ms

#### Throughput
- **Development**: 10-50 requests/minute
- **Production**: 100-500 requests/minute (with proper scaling)

## Platform-Specific Notes

### macOS
- **Homebrew**: Recommended for installing dependencies
- **Xcode Command Line Tools**: Required for some Python packages
- **Security**: May require allowing applications in Security & Privacy settings

### Linux (Ubuntu/Debian)
```bash
# Install system dependencies
sudo apt update
sudo apt install python3 python3-pip python3-venv git curl

# Optional: Redis for production
sudo apt install redis-server

# Optional: Nginx for production
sudo apt install nginx
```

### Linux (CentOS/RHEL)
```bash
# Install system dependencies
sudo yum update
sudo yum install python3 python3-pip git curl

# Optional: Redis for production
sudo yum install redis

# Optional: Nginx for production
sudo yum install nginx
```

### Windows (WSL2)
```bash
# After setting up WSL2 with Ubuntu
sudo apt update
sudo apt install python3 python3-pip python3-venv git curl

# Install Windows Terminal for better experience
# Download from Microsoft Store
```

## Scalability Considerations

### Single Instance
- **Users**: Up to 50 concurrent users
- **Requests**: Up to 100 requests/minute
- **Memory**: 2-4GB RAM usage

### Load Balanced (Multiple Instances)
- **Users**: 500+ concurrent users
- **Requests**: 1000+ requests/minute
- **Memory**: 8-16GB RAM total
- **Additional**: Redis cluster, database replication

### Enterprise Deployment
- **Users**: 10,000+ concurrent users
- **Requests**: 10,000+ requests/minute
- **Infrastructure**: Kubernetes, microservices architecture
- **Additional**: CDN, caching layers, monitoring

## Security Requirements

### SSL/TLS
- **Development**: HTTP acceptable for localhost
- **Production**: HTTPS required, valid SSL certificate
- **Minimum**: TLS 1.2, recommended TLS 1.3

### Firewall
- **Development**: Basic OS firewall sufficient
- **Production**: Enterprise firewall, intrusion detection
- **Fail2ban**: Recommended for automated threat response

### API Security
- **Authentication**: API key management
- **Rate Limiting**: Per-IP and per-key limits
- **Input Validation**: All user inputs sanitized

## Monitoring Requirements

### Basic Monitoring
- **Logs**: Application and error logs
- **Health Checks**: Automated endpoint monitoring
- **Resource Usage**: CPU, memory, disk monitoring

### Advanced Monitoring
- **APM**: Application Performance Monitoring
- **Security Events**: SIEM integration
- **Alerting**: Webhook/API notifications for issues

## Compatibility Matrix

| Component | Version | Status |
|-----------|---------|--------|
| Python 3.8 | 3.8.x | ✅ Supported |
| Python 3.9 | 3.9.x | ✅ Recommended |
| Python 3.10 | 3.10.x | ✅ Recommended |
| Python 3.11 | 3.11.x | ✅ Supported |
| Python 3.12 | 3.12.x | ⚠️ Testing |
| Redis 6.0 | 6.0.x | ✅ Supported |
| Redis 7.0 | 7.0.x | ✅ Recommended |
| Nginx 1.18 | 1.18.x | ✅ Supported |
| Nginx 1.20+ | 1.20.x+ | ✅ Recommended |
| Docker 20.10 | 20.10.x | ✅ Supported |
| Docker 24.0+ | 24.0.x+ | ✅ Recommended |

## Troubleshooting Common Issues

### Python Version Issues
```bash
# Check Python version
python3 --version

# Install specific version on macOS
brew install python@3.9

# Install specific version on Ubuntu
sudo apt install python3.9
```

### Memory Issues
```bash
# Check memory usage
free -h

# Monitor Eclipse Shield memory usage
ps aux | grep python3
```

### Network Issues
```bash
# Test API connectivity
curl -I https://generativelanguage.googleapis.com/

# Check local connectivity
curl http://localhost:5000/health
```

For more troubleshooting help, see [TROUBLESHOOTING.md](../TROUBLESHOOTING.md).
