# Development Setup Guide

## Overview

This guide helps developers set up a complete development environment for Eclipse Shield, including all tools, dependencies, and configurations needed for security-focused development.

## Prerequisites

### System Requirements

#### Minimum Development Environment
- **OS**: macOS 10.15+, Ubuntu 18.04+, or Windows 10+ with WSL2
- **CPU**: 2+ cores, 2.0 GHz
- **Memory**: 4GB RAM (8GB recommended)
- **Storage**: 5GB free space
- **Network**: Stable internet connection

#### Required Software
- **Python 3.8+**: Primary development language
- **Git**: Version control
- **Modern Browser**: Chrome or Opera for extension testing
- **Text Editor/IDE**: VS Code, PyCharm, or similar

#### Recommended Tools
- **Docker**: For containerized testing
- **Redis**: For local rate limiting testing
- **Postman/Insomnia**: For API testing
- **Browser Developer Tools**: For extension debugging

## Development Environment Setup

### 1. Clone and Fork Repository

```bash
# Fork the repository on GitHub first, then clone your fork
git clone https://github.com/YOUR_USERNAME/Eclipse-Shield.git
cd Eclipse-Shield

# Add upstream remote for staying sync with main repository
git remote add upstream https://github.com/CY83R-3X71NC710N/Eclipse-Shield.git

# Verify remotes
git remote -v
```

### 2. Python Environment Setup

#### Using Virtual Environment (Recommended)
```bash
# Create virtual environment
python3 -m venv venv

# Activate virtual environment
# On macOS/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Upgrade pip
pip install --upgrade pip

# Install development dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt  # If available
```

#### Using Poetry (Alternative)
```bash
# Install Poetry if not already installed
curl -sSL https://install.python-poetry.org | python3 -

# Install dependencies
poetry install

# Activate shell
poetry shell
```

### 3. Development Dependencies

Create `requirements-dev.txt` for development-specific packages:

```text
# Development and testing tools
pytest>=7.0.0
pytest-cov>=4.0.0
pytest-mock>=3.10.0
black>=22.0.0
flake8>=5.0.0
mypy>=1.0.0
pre-commit>=2.20.0
bandit>=1.7.0

# Security testing
safety>=2.0.0
semgrep>=1.0.0

# API testing
requests>=2.28.0
httpx>=0.24.0

# Development utilities
python-dotenv>=1.0.0
watchdog>=2.1.0
ipython>=8.0.0

# Documentation
sphinx>=5.0.0
sphinx-rtd-theme>=1.2.0
```

Install development dependencies:
```bash
pip install -r requirements-dev.txt
```

### 4. Configuration Setup

#### Environment Configuration
```bash
# Copy environment template
cp .env.example .env.development

# Edit development configuration
nano .env.development
```

**Development `.env.development`**:
```bash
# Development settings
FLASK_ENV=development
DEBUG=true
SECRET_KEY=dev-secret-key-change-in-production
CSRF_SECRET_KEY=dev-csrf-key

# API Configuration
ECLIPSE_SHIELD_API_KEY=your-development-api-key

# Development database/cache
REDIS_URL=redis://localhost:6379/1

# Security settings (relaxed for development)
RATE_LIMITING_ENABLED=false
SECURITY_HEADERS_ENABLED=true
SSL_ENABLED=false

# Logging
LOG_LEVEL=DEBUG
LOG_FILE=logs/development.log

# Development features
RELOAD_ON_CHANGE=true
```

#### API Key Setup
```bash
# Add your Google Gemini API key for development
echo "your-development-google-gemini-api-key" > api_key.txt

# Secure the file
chmod 600 api_key.txt
```

### 5. Pre-commit Hooks Setup

Configure pre-commit hooks for code quality:

```bash
# Install pre-commit
pip install pre-commit

# Install hooks
pre-commit install
```

Create `.pre-commit-config.yaml`:
```yaml
repos:
  - repo: https://github.com/psf/black
    rev: 22.10.0
    hooks:
      - id: black
        language_version: python3

  - repo: https://github.com/pycqa/flake8
    rev: 5.0.4
    hooks:
      - id: flake8
        args: [--max-line-length=88, --extend-ignore=E203]

  - repo: https://github.com/pycqa/bandit
    rev: 1.7.4
    hooks:
      - id: bandit
        args: [-r, ., -x, tests/]

  - repo: https://github.com/pre-commit/mirrors-mypy
    rev: v1.0.0
    hooks:
      - id: mypy
        additional_dependencies: [types-requests]

  - repo: https://github.com/Lucas-C/pre-commit-hooks-safety
    rev: v1.3.0
    hooks:
      - id: python-safety-dependencies-check
```

### 6. IDE Configuration

#### Visual Studio Code Setup

Install recommended extensions via `.vscode/extensions.json`:
```json
{
  "recommendations": [
    "ms-python.python",
    "ms-python.flake8",
    "ms-python.black-formatter",
    "ms-python.mypy-type-checker",
    "ms-vscode.vscode-json",
    "redhat.vscode-yaml",
    "ms-vscode.test-adapter-converter",
    "ms-python.pytest"
  ]
}
```

Configure VS Code settings in `.vscode/settings.json`:
```json
{
  "python.defaultInterpreterPath": "./venv/bin/python",
  "python.terminal.activateEnvironment": true,
  "python.testing.pytestEnabled": true,
  "python.testing.pytestArgs": ["tests"],
  "python.linting.enabled": true,
  "python.linting.flake8Enabled": true,
  "python.formatting.provider": "black",
  "python.formatting.blackArgs": ["--line-length", "88"],
  "files.exclude": {
    "**/__pycache__": true,
    "**/*.pyc": true
  },
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

#### PyCharm Setup

1. **Project Interpreter**: Configure to use your virtual environment
2. **Code Style**: Set to Black formatting (88 character line length)
3. **Inspections**: Enable Python security inspections
4. **Run Configurations**: Set up for Flask development server

## Development Workflow

### 1. Daily Development

```bash
# Start development session
source venv/bin/activate  # Activate virtual environment
git pull upstream main    # Get latest changes
pip install -r requirements.txt  # Update dependencies if needed

# Start development server
export FLASK_ENV=development
python3 secure_app.py

# In another terminal, start Redis for testing
redis-server

# Run tests
python3 security_test.py http://localhost:5000
```

### 2. Code Quality Checks

```bash
# Run all quality checks
make quality  # If Makefile available, or run individually:

# Code formatting
black .

# Linting
flake8 .

# Type checking
mypy .

# Security scanning
bandit -r . -x tests/

# Dependency checking
safety check
```

### 3. Testing Workflow

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test categories
pytest tests/test_security.py -v
pytest tests/test_api.py -v

# Run security tests
python3 security_test.py http://localhost:5000
```

## Development Tools

### 1. Debugging Setup

#### Flask Debugging
```python
# In secure_app.py for development
if __name__ == '__main__':
    app.run(
        debug=True,
        host='127.0.0.1',
        port=5000,
        use_reloader=True,
        use_debugger=True
    )
```

#### Browser Extension Debugging
```javascript
// In extension background.js for development
const DEBUG = true;

function debugLog(message, data = null) {
    if (DEBUG) {
        console.log(`[Eclipse Shield Debug] ${message}`, data || '');
    }
}

// Enable Chrome extension debugging
chrome.runtime.onInstalled.addListener(() => {
    debugLog('Extension installed/updated');
});
```

### 2. API Testing

#### Postman Collection
Create a Postman collection for API testing:

```json
{
  "info": {
    "name": "Eclipse Shield API",
    "description": "Development API testing"
  },
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "http://localhost:5000/health",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["health"]
        }
      }
    },
    {
      "name": "Analyze URL",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          },
          {
            "key": "X-API-Key",
            "value": "{{api_key}}"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"url\": \"https://github.com\",\n  \"context\": \"work\"\n}"
        },
        "url": {
          "raw": "http://localhost:5000/analyze",
          "protocol": "http",
          "host": ["localhost"],
          "port": "5000",
          "path": ["analyze"]
        }
      }
    }
  ]
}
```

#### cURL Examples for Testing
```bash
# Health check
curl http://localhost:5000/health

# Analyze URL
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"url": "https://github.com", "context": "work"}'

# Get context question
curl -X POST http://localhost:5000/get_question \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"domain": "github.com", "context": {"type": "work"}}'
```

### 3. Database/Cache Setup

#### Redis Development Setup
```bash
# Install Redis (macOS)
brew install redis

# Install Redis (Ubuntu)
sudo apt install redis-server

# Start Redis for development
redis-server

# Connect to Redis CLI for debugging
redis-cli

# Common Redis commands for development
redis-cli KEYS "eclipse_shield:*"
redis-cli FLUSHDB  # Clear development data
```

### 4. Hot Reloading Setup

#### Flask Development Server
```python
# development_server.py
from werkzeug.serving import run_with_reloader
from secure_app import create_app
import os

def create_dev_app():
    """Create app with development configuration."""
    os.environ['FLASK_ENV'] = 'development'
    app = create_app('development')
    return app

if __name__ == '__main__':
    run_with_reloader(
        lambda: create_dev_app().run(
            host='127.0.0.1',
            port=5000,
            debug=True,
            use_reloader=False  # reloader handles this
        )
    )
```

#### File Watching for Extension Development
```bash
# Install file watcher
npm install -g nodemon

# Watch extension files for changes
nodemon --watch extension/ --ext js,json,html --exec "echo 'Extension files changed - reload extension in browser'"
```

## Security Development Guidelines

### 1. Secure Development Practices

#### Input Validation Testing
```python
# Always test input validation in development
def test_input_validation():
    """Test various malicious inputs during development."""
    test_inputs = [
        "<script>alert('xss')</script>",
        "'; DROP TABLE users; --",
        "../../../etc/passwd",
        "javascript:alert('xss')",
        "data:text/html,<script>alert('xss')</script>"
    ]
    
    for test_input in test_inputs:
        result = InputValidator.sanitize_string(test_input)
        assert "<script>" not in result
        print(f"✓ Input sanitized: {test_input[:20]}...")
```

#### Security Headers Testing
```python
def test_security_headers():
    """Verify security headers in development."""
    response = client.get('/health')
    
    required_headers = [
        'X-Content-Type-Options',
        'X-Frame-Options', 
        'X-XSS-Protection'
    ]
    
    for header in required_headers:
        assert header in response.headers
        print(f"✓ Security header present: {header}")
```

### 2. Development Security Checklist

Before committing code:
- [ ] All inputs validated and sanitized
- [ ] No hardcoded secrets or API keys
- [ ] Error messages don't expose sensitive information
- [ ] Security headers implemented
- [ ] Rate limiting tested
- [ ] CSRF protection verified
- [ ] Input validation tests added
- [ ] Security tests pass

## Performance Development

### 1. Local Performance Testing

```bash
# Install Apache Bench for load testing
# macOS
brew install httpd

# Ubuntu
sudo apt install apache2-utils

# Simple load test
ab -n 100 -c 10 http://localhost:5000/health

# API endpoint load test
ab -n 50 -c 5 -p post_data.json -T application/json -H "X-API-Key: test-key" http://localhost:5000/analyze
```

### 2. Memory and CPU Monitoring

```python
# development_monitor.py
import psutil
import time
import threading

class DevelopmentMonitor:
    def __init__(self):
        self.monitoring = False
    
    def start_monitoring(self):
        """Monitor application performance during development."""
        self.monitoring = True
        
        def monitor():
            while self.monitoring:
                process = psutil.Process()
                memory = process.memory_info()
                cpu = process.cpu_percent()
                
                print(f"Memory: {memory.rss / 1024 / 1024:.1f}MB, CPU: {cpu:.1f}%")
                time.sleep(5)
        
        thread = threading.Thread(target=monitor)
        thread.daemon = True
        thread.start()
    
    def stop_monitoring(self):
        self.monitoring = False

# Usage in development
monitor = DevelopmentMonitor()
monitor.start_monitoring()
```

## Troubleshooting Development Issues

### Common Issues and Solutions

#### 1. Virtual Environment Issues
```bash
# Recreate virtual environment
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

#### 2. Port Already in Use
```bash
# Find process using port 5000
lsof -i :5000

# Kill process
kill -9 <PID>

# Or use different port
export FLASK_RUN_PORT=5001
```

#### 3. Redis Connection Issues
```bash
# Check if Redis is running
redis-cli ping

# Start Redis
redis-server

# Check Redis logs
tail -f /usr/local/var/log/redis.log
```

#### 4. Extension Loading Issues
1. Check Chrome Extensions page for errors
2. Verify manifest.json syntax
3. Check console for JavaScript errors
4. Reload extension after code changes

### Getting Help

- **Documentation**: Check the `docs/` folder
- **Issues**: Search existing GitHub issues
- **Discussions**: Use GitHub Discussions for questions
- **Security**: Use Security Report template for security-related questions

This development setup provides a robust foundation for contributing to Eclipse Shield while maintaining security best practices throughout the development process.
