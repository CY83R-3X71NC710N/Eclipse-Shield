"""
Security configuration and utilities for Eclipse Shield.
Contains security settings, validators, and middleware.
"""

import os
import secrets
import hashlib
import hmac
import time
from functools import wraps
from typing import Optional, Dict, Any
import ipaddress
import re
from urllib.parse import urlparse
import logging

logger = logging.getLogger(__name__)

class SecurityConfig:
    """Security configuration class with secure defaults."""
    
    # Generate secure secret key
    SECRET_KEY = os.environ.get('SECRET_KEY') or secrets.token_urlsafe(32)
    
    # Session configuration (localhost-friendly)
    SESSION_COOKIE_SECURE = False  # False for localhost HTTP
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_PERMANENT = False
    PERMANENT_SESSION_LIFETIME = 3600  # 1 hour
    
    # CSRF configuration
    WTF_CSRF_ENABLED = True
    WTF_CSRF_TIME_LIMIT = 3600  # 1 hour
    
    # Security headers (localhost-optimized)
    SECURITY_HEADERS = {
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',  # Allow same origin for localhost
        'X-XSS-Protection': '1; mode=block',
        'Content-Security-Policy': (
            "default-src 'self' http://localhost:* http://127.0.0.1:*; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* http://127.0.0.1:*; "
            "style-src 'self' 'unsafe-inline' http://localhost:* http://127.0.0.1:*; "
            "img-src 'self' data: blob: http://localhost:* http://127.0.0.1:*; "
            "connect-src 'self' http://localhost:* http://127.0.0.1:* chrome-extension:; "
            "font-src 'self' data: http://localhost:* http://127.0.0.1:*; "
            "frame-ancestors 'self'; "
            "base-uri 'self'; "
            "form-action 'self'"
        ),
        'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
    
    # Rate limiting configuration
    RATE_LIMIT_STORAGE_URL = 'memory://'
    RATE_LIMIT_DEFAULT = '100/hour'
    RATE_LIMIT_STRICT = '10/minute'
    
    # API key validation
    API_KEY_MIN_LENGTH = 20
    
    # CORS configuration (Chrome extension friendly)
    CORS_ORIGINS = [
        'http://localhost:5000',
        'http://127.0.0.1:5000',
        'chrome-extension://*',
        'moz-extension://*'  # Firefox support
    ]
    
    # Allowed file extensions for uploads
    ALLOWED_EXTENSIONS = {'txt', 'json'}
    MAX_CONTENT_LENGTH = 1024 * 1024  # 1MB

class InputValidator:
    """Input validation utilities."""
    
    # Regex patterns for validation
    URL_PATTERN = re.compile(
        r'^https?://'  # http:// or https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain...
        r'localhost|'  # localhost...
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # ...or ip
        r'(?::\d+)?'  # optional port
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)
    
    EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    
    DOMAIN_PATTERN = re.compile(
        r'^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$'
    )
    
    @staticmethod
    def validate_url(url: str) -> bool:
        """Validate URL format and security."""
        if not url or len(url) > 2048:  # URL length limit
            return False
            
        if not InputValidator.URL_PATTERN.match(url):
            return False
            
        try:
            parsed = urlparse(url)
            
            # Block dangerous schemes
            if parsed.scheme not in ['http', 'https']:
                return False
                
            # Block localhost access from non-local requests
            if parsed.hostname in ['localhost', '127.0.0.1', '0.0.0.0']:
                return True  # Allow for development
                
            # Block private IP ranges
            try:
                ip = ipaddress.ip_address(parsed.hostname)
                if ip.is_private:
                    logger.warning(f"Blocked private IP access: {url}")
                    return False
            except ValueError:
                pass  # Not an IP address, continue validation
                
            return True
            
        except Exception as e:
            logger.error(f"URL validation error for {url}: {e}")
            return False
    
    @staticmethod
    def validate_domain(domain: str) -> bool:
        """Validate domain format."""
        if not domain or len(domain) > 253:
            return False
        return bool(InputValidator.DOMAIN_PATTERN.match(domain))
    
    @staticmethod
    def sanitize_string(text: str, max_length: int = 1000) -> str:
        """Sanitize string input."""
        if not isinstance(text, str):
            return ""
        
        # Remove null bytes and control characters
        text = text.replace('\x00', '').replace('\r', '').replace('\n', ' ')
        
        # Truncate to max length
        if len(text) > max_length:
            text = text[:max_length]
        
        return text.strip()
    
    @staticmethod
    def validate_json_payload(data: Dict[str, Any], required_fields: list) -> tuple[bool, str]:
        """Validate JSON payload structure."""
        if not isinstance(data, dict):
            return False, "Invalid JSON format"
        
        for field in required_fields:
            if field not in data:
                return False, f"Missing required field: {field}"
        
        return True, "Valid"

class SecurityMiddleware:
    """Security middleware for request processing."""
    
    def __init__(self, app):
        self.app = app
        self.failed_attempts = {}  # Simple in-memory store
        self.cleanup_time = time.time()
    
    def cleanup_failed_attempts(self):
        """Clean up old failed attempts."""
        current_time = time.time()
        if current_time - self.cleanup_time > 3600:  # Clean every hour
            cutoff_time = current_time - 3600  # Keep last hour
            self.failed_attempts = {
                ip: attempts for ip, attempts in self.failed_attempts.items()
                if any(attempt_time > cutoff_time for attempt_time in attempts)
            }
            self.cleanup_time = current_time
    
    def is_rate_limited(self, client_ip: str, max_attempts: int = 10, window: int = 3600) -> bool:
        """Check if client IP is rate limited."""
        self.cleanup_failed_attempts()
        
        current_time = time.time()
        if client_ip not in self.failed_attempts:
            return False
        
        # Count attempts in the time window
        recent_attempts = [
            attempt_time for attempt_time in self.failed_attempts[client_ip]
            if current_time - attempt_time < window
        ]
        
        return len(recent_attempts) >= max_attempts
    
    def record_failed_attempt(self, client_ip: str):
        """Record a failed attempt."""
        current_time = time.time()
        if client_ip not in self.failed_attempts:
            self.failed_attempts[client_ip] = []
        self.failed_attempts[client_ip].append(current_time)

def generate_csrf_token() -> str:
    """Generate a CSRF token."""
    return secrets.token_urlsafe(32)

def validate_csrf_token(token: str, session_token: str) -> bool:
    """Validate CSRF token."""
    if not token or not session_token:
        return False
    return hmac.compare_digest(token, session_token)

def require_api_key(f):
    """Decorator to require API key authentication."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        from flask import request, jsonify
        
        api_key = request.headers.get('X-API-Key') or request.args.get('api_key')
        
        if not api_key:
            logger.warning(f"API key missing for {request.endpoint}")
            return jsonify({'error': 'API key required'}), 401
        
        # Validate API key format
        if len(api_key) < SecurityConfig.API_KEY_MIN_LENGTH:
            logger.warning(f"Invalid API key format for {request.endpoint}")
            return jsonify({'error': 'Invalid API key format'}), 401
        
        # Here you would validate against your API key store
        # For now, we'll check against environment variable
        valid_api_key = os.environ.get('ECLIPSE_SHIELD_API_KEY')
        if valid_api_key and not hmac.compare_digest(api_key, valid_api_key):
            logger.warning(f"Invalid API key for {request.endpoint}")
            return jsonify({'error': 'Invalid API key'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

def secure_filename(filename: str) -> str:
    """Secure a filename for safe storage."""
    # Remove path separators and dangerous characters
    filename = re.sub(r'[^\w\-_\.]', '', filename)
    
    # Remove leading dots and spaces
    filename = filename.lstrip('. ')
    
    # Limit length
    if len(filename) > 255:
        name, ext = os.path.splitext(filename)
        filename = name[:255-len(ext)] + ext
    
    return filename or 'unnamed'
