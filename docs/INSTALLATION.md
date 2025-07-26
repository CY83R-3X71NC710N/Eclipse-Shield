# Installation Guide

## Overview

This guide provides detailed installation instructions for Eclipse Shield across different platforms and deployment scenarios.

## Prerequisites

### System Requirements
- **Operating System**: macOS 10.15+, Ubuntu 18.04+, Windows 10+ (with WSL2)
- **Python**: 3.8 or higher
- **Memory**: Minimum 2GB RAM (4GB recommended)
- **Storage**: 1GB free space
- **Network**: Internet connection for AI API calls

### Required Software
- **Git**: For cloning the repository
- **Python 3.8+**: Runtime environment
- **Google Gemini API Key**: From [Google AI Studio](https://aistudio.google.com/)

### Optional (for production)
- **Docker & Docker Compose**: For containerized deployment
- **Redis**: For advanced rate limiting and caching
- **Nginx**: For reverse proxy in production

## Installation Methods

### Method 1: Quick Install (macOS - Recommended)

**Best for**: macOS users who want to get started quickly

```bash
# 1. Clone the repository
git clone https://github.com/CY83R-3X71NC710N/Eclipse-Shield.git
cd Eclipse-Shield

# 2. Run the automated installer
./install-local.sh

# 3. Add your API key
echo "your-google-gemini-api-key" > api_key.txt

# 4. Start Eclipse Shield
./start.sh
```

### Method 2: Manual Installation

**Best for**: Advanced users or non-macOS platforms

#### Step 1: Clone Repository
```bash
git clone https://github.com/CY83R-3X71NC710N/Eclipse-Shield.git
cd Eclipse-Shield
```

#### Step 2: Create Virtual Environment
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

#### Step 3: Install Dependencies
```bash
# For basic development
pip install -r requirements.txt

# For production with security features
pip install -r requirements-secure.txt
```

#### Step 4: Configuration
```bash
# Copy environment template
cp .env.example .env

# Edit configuration (optional)
nano .env
```

#### Step 5: Add API Key
```bash
# Add your Google Gemini API key
echo "your-api-key-here" > api_key.txt
```

#### Step 6: Start Application
```bash
# Development mode
python3 secure_app.py

# Or production mode
gunicorn --config gunicorn.conf.py wsgi:application
```

### Method 3: Docker Installation

**Best for**: Production deployments or containerized environments

#### Prerequisites
- Docker Desktop (macOS/Windows) or Docker Engine (Linux)
- Docker Compose

#### Installation Steps
```bash
# 1. Clone repository
git clone https://github.com/CY83R-3X71NC710N/Eclipse-Shield.git
cd Eclipse-Shield

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env with your settings
nano .env

# 4. Add API key
echo "your-api-key-here" > api_key.txt

# 5. Start with Docker Compose
docker-compose up -d
```

## Getting Your Google Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click "Get API Key"
4. Create a new API key or use an existing one
5. Copy the API key and add it to `api_key.txt`

**Important**: Keep your API key secure and never commit it to version control.

## Verification

After installation, verify Eclipse Shield is working:

### Health Check
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "ai_connection": "ok"
}
```

### Browser Extension Test
1. Open Chrome and go to `chrome://extensions/`
2. Enable Developer Mode
3. Click "Load unpacked" and select the `extension` folder
4. Navigate to any website - you should see Eclipse Shield analyzing the page

## Troubleshooting Common Issues

### Python Version Issues
```bash
# Check Python version
python3 --version

# If Python 3.8+ not available, install via:
# macOS: brew install python@3.9
# Ubuntu: sudo apt install python3.9
```

### Permission Errors (macOS/Linux)
```bash
# Make scripts executable
chmod +x install-local.sh start.sh stop.sh
```

### API Key Issues
- Verify your API key is valid at [Google AI Studio](https://aistudio.google.com/)
- Check that `api_key.txt` contains only the key (no extra whitespace)
- Ensure you have quota remaining on your API account

### Port Already in Use
```bash
# Find process using port 5000
lsof -i :5000

# Kill the process if needed
kill -9 <PID>
```

## Next Steps

- **Basic Usage**: See [QUICKSTART.md](../QUICKSTART.md)
- **Configuration**: Read [CONFIGURATION.md](CONFIGURATION.md)
- **Production Deployment**: Follow [DEPLOYMENT.md](DEPLOYMENT.md)
- **Browser Extension**: Load the extension from the `extension/` folder

## Uninstallation

To remove Eclipse Shield:

```bash
# Stop the application
./stop.sh

# Remove virtual environment
rm -rf venv

# Remove the entire directory
cd .. && rm -rf Eclipse-Shield
```

For Docker installations:
```bash
docker-compose down -v
docker rmi eclipse-shield:latest
```
