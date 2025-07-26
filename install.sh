#!/bin/bash

# Eclipse Shield Secure Installation Script
# This script installs Eclipse Shield with security best practices

set -e  # Exit on any error

echo "=== Eclipse Shield Secure Installation ==="

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Python 3.8+ is available
python_version=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1-2)
if ! python3 -c "import sys; exit(0 if sys.version_info >= (3, 8) else 1)" 2>/dev/null; then
    print_error "Python 3.8+ is required. Please install a newer version of Python."
    exit 1
fi

print_status "Python version check passed: $(python3 --version)"

# Create virtual environment
print_status "Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Upgrade pip and install wheel
print_status "Upgrading pip and installing build tools..."
pip install --upgrade pip wheel setuptools

# Install secure requirements
print_status "Installing secure dependencies..."
if [ -f "requirements-secure.txt" ]; then
    pip install -r requirements-secure.txt
else
    print_warning "requirements-secure.txt not found, installing basic requirements..."
    pip install -r requirements.txt
fi

# Generate secure configuration
print_status "Generating secure configuration..."

if [ ! -f ".env" ]; then
    print_status "Creating .env file with secure defaults..."
    
    # Generate secure keys
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    API_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
    CSRF_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    JWT_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    
    cat > .env << EOF
# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=False

# Security Keys (CHANGE THESE IN PRODUCTION!)
SECRET_KEY=$SECRET_KEY
ECLIPSE_SHIELD_API_KEY=$API_KEY
CSRF_SECRET_KEY=$CSRF_KEY
JWT_SECRET_KEY=$JWT_KEY

# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# Rate Limiting
RATE_LIMIT_STORAGE_URL=memory://

# Logging
LOG_LEVEL=INFO

# Security Settings
SESSION_TIMEOUT=3600
MAX_CONTENT_LENGTH=1048576
EOF

    print_status ".env file created with secure defaults"
    chmod 600 .env
else
    print_status ".env file already exists, skipping creation"
fi

# Set secure file permissions
print_status "Setting secure file permissions..."
find . -type f -name "*.py" -exec chmod 644 {} \;
find . -type f -name "*.sh" -exec chmod 755 {} \;
chmod 600 .env 2>/dev/null || true
chmod 600 api_key.txt 2>/dev/null || true

# Create logs directory
mkdir -p logs
chmod 755 logs

# Check if settings.json exists
if [ ! -f "settings.json" ]; then
    print_warning "settings.json not found. Creating basic configuration..."
    cat > settings.json << 'EOF'
{
  "domains": {
    "work": {
      "allowed_platforms": {
        "productivity": ["google.com", "microsoft.com", "notion.so"],
        "development": ["github.com", "stackoverflow.com", "python.org"],
        "ai_tools": ["chat.openai.com", "claude.ai"]
      },
      "blocked_specific": ["facebook.com", "twitter.com", "instagram.com"],
      "blocked_keywords": ["game", "entertainment", "social"]
    },
    "study": {
      "allowed_platforms": {
        "educational": ["coursera.org", "khan-academy.org", "wikipedia.org"],
        "research": ["scholar.google.com", "arxiv.org", "jstor.org"],
        "ai_tools": ["chat.openai.com", "claude.ai"]
      },
      "blocked_specific": ["youtube.com", "netflix.com"],
      "blocked_keywords": ["game", "entertainment"]
    }
  }
}
EOF
    print_status "Basic settings.json created"
fi

# Install development dependencies for testing
print_status "Installing development dependencies..."
pip install pytest pytest-flask coverage black flake8

# Run security tests if available
if [ -f "security_test.py" ]; then
    print_status "Running security tests..."
    python3 security_test.py http://localhost:5000 || print_warning "Security tests failed (server may not be running)"
fi

# Create start script
print_status "Creating start script..."
cat > start.sh << 'EOF'
#!/bin/bash

# Eclipse Shield Start Script
cd "$(dirname "$0")"

# Activate virtual environment
source venv/bin/activate

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if this is a production environment
if [ "$FLASK_ENV" = "production" ]; then
    echo "Starting Eclipse Shield in production mode..."
    gunicorn --config gunicorn.conf.py wsgi:application
else
    echo "Starting Eclipse Shield in development mode..."
    python3 secure_app.py
fi
EOF

chmod +x start.sh

# Create stop script
cat > stop.sh << 'EOF'
#!/bin/bash

# Eclipse Shield Stop Script
echo "Stopping Eclipse Shield..."

# Kill gunicorn processes
pkill -f "gunicorn.*wsgi:application" || true

# Kill any remaining Python processes for this app
pkill -f "python.*secure_app.py" || true
pkill -f "python.*app.py" || true

echo "Eclipse Shield stopped"
EOF

chmod +x stop.sh

# Create update script
cat > update.sh << 'EOF'
#!/bin/bash

# Eclipse Shield Update Script
echo "Updating Eclipse Shield..."

# Activate virtual environment
source venv/bin/activate

# Update Python packages
pip install --upgrade -r requirements-secure.txt

# Run security tests
if [ -f "security_test.py" ]; then
    python3 security_test.py http://localhost:5000
fi

echo "Update complete"
EOF

chmod +x update.sh

print_status "Installation completed successfully!"

echo ""
echo "=== Next Steps ==="
echo "1. Update your API key in api_key.txt"
echo "2. Customize settings.json for your domains"
echo "3. Review and update .env file"
echo "4. Start the application:"
echo "   ./start.sh"
echo ""
echo "=== Security Reminders ==="
echo "• Change all secret keys in .env before production"
echo "• Set up HTTPS/SSL for production deployment"
echo "• Configure firewall rules"
echo "• Set up monitoring and logging"
echo "• Run security tests regularly"
echo ""
echo "=== Files Created ==="
echo "• .env - Environment configuration"
echo "• start.sh - Application start script"
echo "• stop.sh - Application stop script"
echo "• update.sh - Update script"
echo "• logs/ - Log directory"
echo ""

if [ -f "security_test.py" ]; then
    echo "Run security tests with: python3 security_test.py"
fi

print_status "Installation complete! 🎉"
