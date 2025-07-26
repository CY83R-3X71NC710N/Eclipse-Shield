#!/bin/bash

# Eclipse Shield Secure Local Installation for macOS
# This script sets up Eclipse Shield with Docker for secure localhost deployment

set -e  # Exit on any error

echo "🛡️  Eclipse Shield - Secure Local Setup for macOS"
echo "=================================================="

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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

print_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if Docker is installed and running
print_step "Checking Docker installation..."
if ! command -v docker >/dev/null 2>&1; then
    print_error "Docker is not installed. Please install Docker Desktop for Mac first."
    echo "Download from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop."
    exit 1
fi

print_status "Docker is installed and running ✓"

# Check if Docker Compose is available
if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
    print_error "Docker Compose is not available. Please install Docker Desktop with Compose."
    exit 1
fi

print_status "Docker Compose is available ✓"

# Create necessary directories
print_step "Creating project directories..."
mkdir -p logs
chmod 755 logs

# Generate secure environment configuration
print_step "Generating secure configuration..."

if [ ! -f ".env.local" ]; then
    print_status "Creating .env.local file with secure defaults..."
    
    # Generate secure keys
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(32))")
    API_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
    REDIS_PASSWORD=$(python3 -c "import secrets; print(secrets.token_urlsafe(16))")
    
    cat > .env.local << EOF
# Eclipse Shield Local Environment Configuration
# Generated on $(date)

# Flask Configuration
FLASK_ENV=development
FLASK_DEBUG=False

# Security Keys - KEEP THESE SECURE!
SECRET_KEY=$SECRET_KEY
ECLIPSE_SHIELD_API_KEY=$API_KEY

# Redis Configuration
REDIS_PASSWORD=$REDIS_PASSWORD

# Localhost-specific settings
CORS_ORIGINS=http://localhost:5000,http://127.0.0.1:5000
EOF

    print_status ".env.local file created with secure defaults"
    chmod 600 .env.local
else
    print_status ".env.local file already exists, skipping creation"
fi

# Create or verify API key file
if [ ! -f "api_key.txt" ]; then
    print_warning "api_key.txt not found. Please add your Google Generative AI API key."
    echo "Enter your Google Generative AI API key (or press Enter to skip):"
    read -r api_key
    if [ -n "$api_key" ]; then
        echo "$api_key" > api_key.txt
        chmod 600 api_key.txt
        print_status "API key saved to api_key.txt"
    else
        echo "your-google-api-key-here" > api_key.txt
        chmod 600 api_key.txt
        print_warning "Please edit api_key.txt with your actual API key before starting"
    fi
else
    print_status "api_key.txt already exists ✓"
fi

# Create or verify settings.json
if [ ! -f "settings.json" ]; then
    print_step "Creating default settings.json..."
    cat > settings.json << 'EOF'
{
  "domains": {
    "work": {
      "allowed_platforms": {
        "productivity": ["google.com", "microsoft.com", "notion.so", "slack.com"],
        "development": ["github.com", "stackoverflow.com", "python.org", "docker.com"],
        "ai_tools": ["chat.openai.com", "claude.ai", "gemini.google.com"]
      },
      "blocked_specific": ["facebook.com", "twitter.com", "instagram.com", "tiktok.com"],
      "blocked_keywords": ["game", "entertainment", "social", "streaming"]
    },
    "study": {
      "allowed_platforms": {
        "educational": ["coursera.org", "khan-academy.org", "wikipedia.org", "mit.edu"],
        "research": ["scholar.google.com", "arxiv.org", "jstor.org", "pubmed.ncbi.nlm.nih.gov"],
        "ai_tools": ["chat.openai.com", "claude.ai", "gemini.google.com"]
      },
      "blocked_specific": ["youtube.com", "netflix.com", "twitch.tv"],
      "blocked_keywords": ["game", "entertainment", "streaming"]
    },
    "personal": {
      "contextualization_required": true,
      "base_blocked_categories": ["adult_content", "gambling"],
      "flexibility_level": "high",
      "ai_tools": ["chat.openai.com", "claude.ai", "gemini.google.com"],
      "productivity_tools": ["notion.so", "evernote.com", "todoist.com"]
    }
  }
}
EOF
    print_status "Default settings.json created"
else
    print_status "settings.json already exists ✓"
fi

# Create startup scripts
print_step "Creating management scripts..."

# Start script
cat > start.sh << 'EOF'
#!/bin/bash

echo "🚀 Starting Eclipse Shield (Secure Local Mode)"
echo "=============================================="

# Load environment variables
if [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
fi

# Start services
if command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f docker-compose.local.yml up -d
else
    docker compose -f docker-compose.local.yml up -d
fi

echo ""
echo "✅ Eclipse Shield is starting up..."
echo "🌐 Access URL: http://localhost:5000"
echo "❤️  Health Check: http://localhost:5000/health"
echo ""
echo "📋 Useful commands:"
echo "   ./stop.sh       - Stop all services"
echo "   ./logs.sh       - View application logs"
echo "   ./status.sh     - Check service status"
echo "   ./test.sh       - Run security tests"
EOF

# Stop script
cat > stop.sh << 'EOF'
#!/bin/bash

echo "🛑 Stopping Eclipse Shield..."

if command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f docker-compose.local.yml down
else
    docker compose -f docker-compose.local.yml down
fi

echo "✅ Eclipse Shield stopped"
EOF

# Logs script
cat > logs.sh << 'EOF'
#!/bin/bash

echo "📋 Eclipse Shield Logs (press Ctrl+C to exit)"
echo "============================================="

if command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f docker-compose.local.yml logs -f eclipse-shield
else
    docker compose -f docker-compose.local.yml logs -f eclipse-shield
fi
EOF

# Status script
cat > status.sh << 'EOF'
#!/bin/bash

echo "📊 Eclipse Shield Status"
echo "========================"

if command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f docker-compose.local.yml ps
else
    docker compose -f docker-compose.local.yml ps
fi

echo ""
echo "🌐 Testing connectivity..."
if curl -s http://localhost:5000/health >/dev/null; then
    echo "✅ Eclipse Shield is responding at http://localhost:5000"
else
    echo "❌ Eclipse Shield is not responding"
fi
EOF

# Test script
cat > test.sh << 'EOF'
#!/bin/bash

echo "🧪 Running Eclipse Shield Security Tests"
echo "========================================"

# Wait for service to be ready
echo "Waiting for service to start..."
sleep 5

# Run security tests
if [ -f "security_test.py" ]; then
    python3 security_test.py http://localhost:5000
else
    echo "❌ security_test.py not found"
fi
EOF

# Make scripts executable
chmod +x start.sh stop.sh logs.sh status.sh test.sh

print_status "Management scripts created ✓"

# Build the Docker image
print_step "Building secure Docker image..."
if command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f docker-compose.local.yml build
else
    docker compose -f docker-compose.local.yml build
fi

print_status "Docker image built successfully ✓"

echo ""
echo "🎉 Installation Complete!"
echo "========================="
echo ""
echo "📁 Files created:"
echo "   .env.local       - Environment configuration"
echo "   start.sh         - Start Eclipse Shield"
echo "   stop.sh          - Stop Eclipse Shield"
echo "   logs.sh          - View logs"
echo "   status.sh        - Check status"
echo "   test.sh          - Run security tests"
echo ""
echo "🚀 Quick Start:"
echo "   1. Edit api_key.txt with your Google API key"
echo "   2. Run: ./start.sh"
echo "   3. Open: http://localhost:5000"
echo ""
echo "🔒 Security Features Enabled:"
echo "   ✅ Docker container isolation"
echo "   ✅ Non-root user execution"
echo "   ✅ Input validation and sanitization"
echo "   ✅ Rate limiting and CSRF protection"
echo "   ✅ Security headers for localhost"
echo "   ✅ Redis session storage with password"
echo "   ✅ Resource limits and health checks"
echo ""
echo "⚠️  Important Notes:"
echo "   - Keep your .env.local file secure"
echo "   - Don't share your API keys"
echo "   - Access only via http://localhost:5000"
echo "   - Check logs with ./logs.sh if issues occur"
echo ""
print_status "Ready to start Eclipse Shield! 🛡️"
