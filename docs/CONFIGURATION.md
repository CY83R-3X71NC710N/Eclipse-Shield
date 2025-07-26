# Configuration Guide

## Overview

Eclipse Shield offers flexible configuration options to customize its behavior for your specific productivity needs and security requirements.

## Configuration Files

### 1. Environment Variables (`.env`)

Create a `.env` file in the root directory to configure application settings:

```bash
# Application Settings
FLASK_ENV=production
SECRET_KEY=your-secret-key-here
DEBUG=false

# API Configuration
ECLIPSE_SHIELD_API_KEY=your-google-gemini-api-key

# Security Settings
CSRF_SECRET_KEY=another-secret-key
API_RATE_LIMIT=100

# Database & Caching
REDIS_URL=redis://localhost:6379/0

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/eclipse_shield.log
```

### 2. Domain Settings (`settings.json`)

Configure productivity rules and website filtering:

```json
{
  "domains": {
    "work": {
      "description": "Professional work context",
      "allowed_platforms": {
        "productivity": ["google.com", "microsoft.com", "notion.so"],
        "development": ["github.com", "stackoverflow.com", "docs.python.org"],
        "ai_tools": ["chat.openai.com", "claude.ai", "gemini.google.com"],
        "communication": ["slack.com", "zoom.us", "teams.microsoft.com"]
      },
      "blocked_specific": [
        "facebook.com", "twitter.com", "instagram.com", 
        "reddit.com", "youtube.com", "tiktok.com"
      ],
      "blocked_keywords": ["game", "entertainment", "social", "news"],
      "time_limits": {
        "youtube.com": 30,
        "reddit.com": 15
      }
    },
    "research": {
      "description": "Academic and research work",
      "allowed_platforms": {
        "academic": ["scholar.google.com", "arxiv.org", "researchgate.net"],
        "reference": ["wikipedia.org", "britannica.com"],
        "tools": ["zotero.org", "mendeley.com"]
      },
      "blocked_specific": ["facebook.com", "twitter.com"],
      "blocked_keywords": ["game", "entertainment"],
      "ai_strictness": "high"
    },
    "learning": {
      "description": "Online courses and skill development",
      "allowed_platforms": {
        "education": ["coursera.org", "udemy.com", "edx.org", "khanacademy.org"],
        "coding": ["codecademy.com", "freecodecamp.org", "leetcode.com"],
        "documentation": ["w3schools.com", "mdn.mozilla.org"]
      },
      "blocked_specific": ["social.*", "game.*"],
      "time_limits": {},
      "ai_strictness": "medium"
    }
  },
  "global_settings": {
    "ai_model": "gemini-2.0-flash",
    "question_frequency": "adaptive",
    "block_duration": 300,
    "learning_mode": true,
    "privacy_mode": false
  }
}
```

## Configuration Options Explained

### Domain Contexts

**Purpose**: Define different work contexts with specific rules and allowed websites.

- **`allowed_platforms`**: Categorized lists of productive websites for this context
- **`blocked_specific`**: Specific domains to always block in this context
- **`blocked_keywords`**: URL keywords that trigger blocking
- **`time_limits`**: Maximum minutes per day for specific sites (0 = unlimited)
- **`ai_strictness`**: How strict the AI should be (`low`, `medium`, `high`)

### Global Settings

- **`ai_model`**: Which AI model to use (gemini-2.0-flash, gemini-1.5-flash)
- **`question_frequency`**: How often to ask context questions (`never`, `low`, `medium`, `high`, `adaptive`)
- **`block_duration`**: Default block time in seconds when a site is blocked
- **`learning_mode`**: Whether the AI should learn from your responses
- **`privacy_mode`**: If enabled, doesn't log URLs or personal information

## Advanced Configuration

### Custom AI Prompts

Create `prompts.json` to customize AI behavior:

```json
{
  "context_questions": {
    "work": "What specific work task are you focusing on right now?",
    "research": "What research question are you trying to answer?", 
    "learning": "What concept or skill are you currently learning?"
  },
  "blocking_messages": {
    "work": "This site might distract from your work goals. Stay focused!",
    "research": "Consider if this supports your research objectives.",
    "learning": "Focus on your learning goals instead."
  },
  "productivity_tips": {
    "work": "Try the Pomodoro technique: 25 minutes focused work, 5 minute break.",
    "research": "Take notes as you read to improve retention.",
    "learning": "Practice active recall by testing yourself on the material."
  }
}
```

### Security Configuration

Edit `security_config.py` for advanced security settings:

```python
# Rate limiting
RATE_LIMIT_DEFAULT = "100 per hour"
RATE_LIMIT_API = "10 per minute"

# Session security
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'

# CORS settings
CORS_ORIGINS = [
    "chrome-extension://*",
    "moz-extension://*", 
    "http://localhost:5000"
]

# Input validation
MAX_URL_LENGTH = 2048
MAX_CONTEXT_LENGTH = 5000
ALLOWED_DOMAINS_REGEX = r'^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$'
```

## Browser Extension Configuration

### Chrome Extension Settings

Edit `extension/manifest.json` for Chrome-specific settings:

```json
{
  "name": "Eclipse Shield",
  "version": "1.0.0",
  "permissions": [
    "activeTab",
    "storage", 
    "tabs",
    "webRequest",
    "webRequestBlocking",
    "http://localhost:5000/*"
  ],
  "host_permissions": [
    "<all_urls>"
  ]
}
```

### Extension Options

Users can configure the extension through the popup:

- **Server URL**: Where Eclipse Shield backend is running
- **Context Mode**: Which domain context to use
- **Notification Level**: How much feedback to show
- **Auto-sync**: Whether to sync settings across devices

## Environment-Specific Configurations

### Development Environment

```bash
# .env.development
FLASK_ENV=development
DEBUG=true
LOG_LEVEL=DEBUG
RATE_LIMITING_ENABLED=false
SECURITY_HEADERS_ENABLED=false
```

### Production Environment  

```bash
# .env.production
FLASK_ENV=production
DEBUG=false
LOG_LEVEL=INFO
RATE_LIMITING_ENABLED=true
SECURITY_HEADERS_ENABLED=true
SSL_ENABLED=true
```

### Testing Environment

```bash
# .env.testing
FLASK_ENV=testing
DEBUG=true
LOG_LEVEL=DEBUG
TESTING=true
RATE_LIMITING_ENABLED=false
```

## Configuration Validation

Eclipse Shield validates your configuration on startup:

```bash
# Check configuration
python3 -c "from secure_app import validate_config; validate_config()"

# Test with your settings
python3 security_test.py --config-test
```

## Common Configuration Patterns

### Strict Work Environment
```json
{
  "ai_strictness": "high",
  "question_frequency": "high", 
  "block_duration": 600,
  "time_limits": {
    "*": 0
  },
  "blocked_keywords": ["social", "news", "entertainment", "game", "video"]
}
```

### Flexible Learning Environment
```json
{
  "ai_strictness": "medium",
  "question_frequency": "adaptive",
  "block_duration": 180,
  "time_limits": {
    "youtube.com": 60,
    "reddit.com": 30
  }
}
```

### Research-Focused Setup
```json
{
  "ai_strictness": "low",
  "question_frequency": "low",
  "allowed_platforms": {
    "academic": ["*scholar*", "*arxiv*", "*research*"],
    "reference": ["wikipedia.org", "*.edu"]
  }
}
```

## Troubleshooting Configuration

### Invalid JSON
```bash
# Validate JSON syntax
python3 -m json.tool settings.json
```

### Permission Issues
```bash
# Fix file permissions
chmod 644 settings.json .env
chmod 600 api_key.txt  # Keep API key secure
```

### Testing Changes
```bash
# Restart after configuration changes
./stop.sh && ./start.sh

# Test specific domain rules
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "context": "work"}'
```

For more help, see [TROUBLESHOOTING.md](../TROUBLESHOOTING.md).
