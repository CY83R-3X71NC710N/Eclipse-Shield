#!/bin/bash

# Eclipse Shield - Browser Compatibility Switcher

echo "🛡️  Eclipse Shield Browser Compatibility Switcher"
echo "================================================"

if [ "$1" = "opera" ]; then
    echo "🔄 Switching to Opera-compatible version..."
    
    # Backup current files if they don't exist
    [ ! -f extension/manifest-chrome.json ] && cp extension/manifest.json extension/manifest-chrome.json
    [ ! -f extension/background-chrome.js ] && cp extension/background.js extension/background-chrome.js
    
    # Switch to Opera versions
    cp extension/manifest-opera.json extension/manifest.json
    cp extension/background-opera.js extension/background.js
    
    echo "✅ Switched to Opera-compatible version"
    echo "📖 Read OPERA_INSTALLATION.md for installation instructions"
    
elif [ "$1" = "chrome" ]; then
    echo "🔄 Switching to Chrome-compatible version..."
    
    # Switch back to Chrome versions
    [ -f extension/manifest-chrome.json ] && cp extension/manifest-chrome.json extension/manifest.json
    [ -f extension/background-chrome.js ] && cp extension/background-chrome.js extension/background.js
    
    echo "✅ Switched to Chrome-compatible version"
    
else
    echo "Usage: $0 [chrome|opera]"
    echo ""
    echo "Examples:"
    echo "  $0 opera   - Switch to Opera-compatible version"
    echo "  $0 chrome  - Switch to Chrome-compatible version"
    echo ""
    echo "Current manifest:"
    if grep -q "chrome_url_overrides" extension/manifest.json 2>/dev/null; then
        echo "  📍 Chrome version (has chrome_url_overrides)"
    else
        echo "  📍 Opera version (no chrome_url_overrides)"
    fi
fi
