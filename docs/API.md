# API Reference

## Overview

Eclipse Shield provides a RESTful API for analyzing URLs, managing contexts, and retrieving productivity insights. All endpoints require proper authentication and follow security best practices.

## Base URL

```
http://localhost:5000
```

For production deployments, replace with your actual domain.

## Authentication

### API Key Authentication

Include your API key in the request headers:

```http
X-API-Key: your-api-key-here
```

### CSRF Protection

For web requests, include the CSRF token:

```http
X-CSRF-Token: csrf-token-value
```

Get CSRF token from `/csrf-token` endpoint.

## Core Endpoints

### 1. Health Check

Check if the service is running and healthy.

**Endpoint:** `GET /health`

**Authentication:** None required

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "ai_connection": "ok",
  "timestamp": "2025-07-25T10:30:00Z"
}
```

**Status Codes:**
- `200 OK`: Service is healthy
- `503 Service Unavailable`: Service has issues

---

### 2. Analyze URL

Analyze whether a URL is productive for the current context.

**Endpoint:** `POST /analyze`

**Authentication:** API Key required

**Request Headers:**
```http
Content-Type: application/json
X-API-Key: your-api-key
```

**Request Body:**
```json
{
  "url": "https://example.com/page",
  "context": "work",
  "user_goal": "Working on Python project",
  "previous_context": [
    {
      "question": "What are you working on?",
      "answer": "Building a web application"
    }
  ]
}
```

**Parameters:**
- `url` (required): The URL to analyze
- `context` (required): Context domain (work, research, learning, etc.)
- `user_goal` (optional): Current task description
- `previous_context` (optional): Array of previous Q&A pairs

**Response:**
```json
{
  "allowed": false,
  "reason": "Social media site may distract from work tasks",
  "confidence": 0.85,
  "alternatives": [
    "https://github.com",
    "https://stackoverflow.com"
  ],
  "productivity_score": 2,
  "next_question": "What specific programming problem are you trying to solve?"
}
```

**Response Fields:**
- `allowed`: Boolean indicating if URL should be accessible
- `reason`: Human-readable explanation for the decision
- `confidence`: AI confidence score (0.0 to 1.0)
- `alternatives`: Suggested productive alternatives
- `productivity_score`: Score from 1-10 (10 = highly productive)
- `next_question`: Follow-up question to better understand context

**Status Codes:**
- `200 OK`: Analysis completed successfully
- `400 Bad Request`: Invalid URL or parameters
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Analysis failed

---

### 3. Get Context Question

Get an AI-generated question to understand user's current task better.

**Endpoint:** `POST /get_question`

**Authentication:** API Key required

**Request Body:**
```json
{
  "domain": "github.com",
  "context": {
    "type": "work",
    "activity": "programming"
  }
}
```

**Response:**
```json
{
  "question": "What specific feature of the web application are you currently developing?",
  "question_type": "clarification",
  "expected_answer_type": "text",
  "followup_available": true
}
```

**Status Codes:**
- `200 OK`: Question generated successfully
- `400 Bad Request`: Invalid context or parameters
- `401 Unauthorized`: Missing or invalid API key

---

## Static Endpoints

### Extension Files

**Endpoint:** `GET /extension/<filename>`

Serves browser extension files.

### Block Page

**Endpoint:** `GET /block.html`

Serves the blocked website page with productivity alternatives.

### Test Connection

**Endpoint:** `GET /test-connection`

Test endpoint for browser extension connectivity.

**Response:**
```json
{
  "status": "connected",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": true,
  "message": "Detailed error description",
  "code": "ERROR_CODE",
  "timestamp": "2025-07-25T10:30:00Z"
}
```

### Common Error Codes

- `INVALID_URL`: Malformed or unsupported URL
- `INVALID_CONTEXT`: Unknown context domain
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `AI_SERVICE_ERROR`: AI analysis failed
- `INVALID_API_KEY`: Authentication failed
- `MISSING_PARAMETERS`: Required parameters not provided

## Rate Limiting

### Default Limits
- **Global**: 100 requests per hour per IP
- **API Endpoints**: 10 requests per minute per API key
- **Analysis Endpoint**: 5 requests per minute per API key

### Rate Limit Headers

Responses include rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1627815600
```

## SDK Examples

### Python

```python
import requests

class EclipseShieldClient:
    def __init__(self, base_url, api_key):
        self.base_url = base_url
        self.headers = {
            'X-API-Key': api_key,
            'Content-Type': 'application/json'
        }
    
    def analyze_url(self, url, context, user_goal=None):
        data = {
            'url': url,
            'context': context,
            'user_goal': user_goal
        }
        response = requests.post(
            f'{self.base_url}/analyze',
            json=data,
            headers=self.headers
        )
        return response.json()

# Usage
client = EclipseShieldClient('http://localhost:5000', 'your-api-key')
result = client.analyze_url('https://twitter.com', 'work')
print(f"Allowed: {result['allowed']}")
```

### JavaScript (Browser Extension)

```javascript
class EclipseShieldAPI {
    constructor(baseUrl, apiKey) {
        this.baseUrl = baseUrl;
        this.apiKey = apiKey;
    }
    
    async analyzeUrl(url, context, userGoal = null) {
        const response = await fetch(`${this.baseUrl}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': this.apiKey
            },
            body: JSON.stringify({
                url: url,
                context: context,
                user_goal: userGoal
            })
        });
        
        return await response.json();
    }
}

// Usage
const api = new EclipseShieldAPI('http://localhost:5000', 'your-api-key');
const result = await api.analyzeUrl(window.location.href, 'work');
console.log('Analysis result:', result);
```

### cURL Examples

**Analyze URL:**
```bash
curl -X POST http://localhost:5000/analyze \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "url": "https://github.com",
    "context": "work",
    "user_goal": "Working on Python project"
  }'
```

**Get Question:**
```bash
curl -X POST http://localhost:5000/get_question \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "domain": "stackoverflow.com",
    "context": {
      "type": "work",
      "activity": "programming"
    }
  }'
```

## Webhooks (Future Feature)

Eclipse Shield will support webhooks for real-time notifications:

```json
{
  "event": "url_blocked",
  "timestamp": "2025-07-25T10:30:00Z",
  "data": {
    "url": "https://twitter.com",
    "context": "work",
    "reason": "Social media during work hours"
  }
}
```

## API Versioning

Current API version: `v1`

Future versions will be accessible via:
```
http://localhost:5000/api/v2/analyze
```

Version headers:
```http
API-Version: v1
Accept: application/vnd.eclipseshield.v1+json
```
