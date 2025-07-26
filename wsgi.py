#!/usr/bin/env python3
"""
WSGI entry point for Eclipse Shield application.
This file provides a production-ready WSGI interface for deployment with
Gunicorn, uWSGI, or other WSGI servers.
"""

import os
import sys
import logging
from logging.handlers import RotatingFileHandler

# Add project directory to Python path
project_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, project_dir)

# Configure production logging
def setup_production_logging():
    """Configure production-grade logging with rotation."""
    # Skip file logging in Docker environments
    if os.getenv('RUNNING_IN_DOCKER') or os.path.exists('/.dockerenv'):
        # Use console logging only in Docker
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        formatter = logging.Formatter(
            '%(asctime)s %(name)s %(levelname)s %(filename)s:%(lineno)d %(message)s'
        )
        console_handler.setFormatter(formatter)
        
        root_logger = logging.getLogger()
        root_logger.setLevel(logging.INFO)
        root_logger.addHandler(console_handler)
        return
    
    # File logging for non-Docker environments
    log_dir = os.path.join(project_dir, 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    # Create rotating file handler
    log_file = os.path.join(log_dir, 'eclipse_shield.log')
    file_handler = RotatingFileHandler(
        log_file,
        maxBytes=10*1024*1024,  # 10MB
        backupCount=10,
        encoding='utf-8'
    )
    
    # Set log format
    formatter = logging.Formatter(
        '%(asctime)s %(name)s %(levelname)s %(filename)s:%(lineno)d %(message)s'
    )
    file_handler.setFormatter(formatter)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    root_logger.addHandler(file_handler)
    
    # Add console handler for errors
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.ERROR)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

# Setup logging for production
setup_production_logging()

# Import the Flask app
try:
    from secure_app import create_app
    application = create_app()
except ImportError:
    # Fallback to original app if secure_app doesn't exist yet
    from app import app as application

if __name__ == "__main__":
    # This is only for development testing
    application.run(host='0.0.0.0', port=5000)
