# Use Python 3.11 slim image for smaller size and better security
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV FLASK_ENV=production
ENV FLASK_APP=wsgi:application

# Create non-root user for security
RUN groupadd -r eclipse && useradd -r -g eclipse eclipse

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set work directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements-secure.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements-secure.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p logs && \
    mkdir -p /app/logs && \
    chown -R eclipse:eclipse /app

# Remove development files for security
RUN rm -f .env.example deploy.sh security_test.py

# Switch to non-root user
USER eclipse

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/health || exit 1

# Start command
CMD ["gunicorn", "--config", "gunicorn.conf.py", "wsgi:application"]
