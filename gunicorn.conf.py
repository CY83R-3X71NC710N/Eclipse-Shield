"""
Gunicorn configuration for Eclipse Shield production deployment.
Optimized for security and performance.
"""

import os
import multiprocessing

# Server socket
bind = "0.0.0.0:5000"
backlog = 2048

# Worker processes
workers = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"  # Use sync worker instead of gevent
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 100

# Worker timeout and restarts
timeout = 30
keepalive = 2
graceful_timeout = 30

# Security
limit_request_line = 4094
limit_request_fields = 100
limit_request_field_size = 8190

# Logging
accesslog = "-"  # Log to stdout
errorlog = "-"   # Log to stderr
loglevel = "info"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "eclipse-shield"

# Server mechanics
daemon = False
pidfile = "/tmp/eclipse-shield.pid"
user = None
group = None
tmp_upload_dir = None

# SSL (enable if using HTTPS)
keyfile = None
certfile = None

# Worker recycling
max_requests = 1000
max_requests_jitter = 50

# Preload application for better performance
preload_app = True

# Enable stats
statsd_host = None
statsd_prefix = "eclipse_shield"

def when_ready(server):
    """Called when the server is ready to accept connections."""
    server.log.info("Eclipse Shield server ready to accept connections")

def worker_int(worker):
    """Called when a worker receives the INT or QUIT signal."""
    worker.log.info("Worker interrupted")

def pre_fork(server, worker):
    """Called before a worker is forked."""
    server.log.info(f"Worker {worker.pid} forked")

def post_fork(server, worker):
    """Called after a worker is forked."""
    server.log.info(f"Worker {worker.pid} ready")

def worker_abort(worker):
    """Called when a worker is aborted."""
    worker.log.info(f"Worker {worker.pid} aborted")

# Environment variables
raw_env = [
    'FLASK_ENV=production',
]
