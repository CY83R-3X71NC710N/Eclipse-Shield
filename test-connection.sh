#!/bin/bash

# Eclipse Shield Connection Test Script
# This script tests all the endpoints your Chrome extension needs

echo "🔍 Eclipse Shield Connection Test"
echo "================================="
echo ""

# Test if the server is running
echo "1. Testing if server is running..."
if curl -s http://localhost:5000/health > /dev/null; then
    echo "✅ Server is running on localhost:5000"
else
    echo "❌ Server is NOT running on localhost:5000"
    echo "   Please start the server with: python3 secure_app.py"
    exit 1
fi

echo ""

# Test health endpoint
echo "2. Testing health endpoint..."
HEALTH_RESPONSE=$(curl -s http://localhost:5000/health)
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo "✅ Health endpoint working"
    echo "   Response: $HEALTH_RESPONSE"
else
    echo "❌ Health endpoint failed"
    echo "   Response: $HEALTH_RESPONSE"
fi

echo ""

# Test connection endpoint
echo "3. Testing Chrome extension connection..."
CONNECTION_RESPONSE=$(curl -s -H "Origin: chrome-extension://test" http://localhost:5000/test-connection)
if echo "$CONNECTION_RESPONSE" | grep -q "success"; then
    echo "✅ Chrome extension connection working"
    echo "   Response: $CONNECTION_RESPONSE"
else
    echo "❌ Chrome extension connection failed"
    echo "   Response: $CONNECTION_RESPONSE"
fi

echo ""

# Test CORS preflight
echo "4. Testing CORS preflight (OPTIONS)..."
CORS_RESPONSE=$(curl -s -X OPTIONS -H "Origin: chrome-extension://test" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: Content-Type" -I http://localhost:5000/analyze)
if echo "$CORS_RESPONSE" | grep -q "Access-Control-Allow-Origin"; then
    echo "✅ CORS preflight working"
    echo "   Headers include: $(echo "$CORS_RESPONSE" | grep "Access-Control-Allow")"
else
    echo "❌ CORS preflight failed"
    echo "   Response: $CORS_RESPONSE"
fi

echo ""

# Test analyze endpoint
echo "5. Testing analyze endpoint..."
ANALYZE_RESPONSE=$(curl -s -X POST -H "Content-Type: application/json" -H "Origin: chrome-extension://test" -d '{"url":"https://example.com","domain":"example.com"}' http://localhost:5000/analyze)
if echo "$ANALYZE_RESPONSE" | grep -q "confidence"; then
    echo "✅ Analyze endpoint working"
    echo "   Response: $ANALYZE_RESPONSE"
else
    echo "❌ Analyze endpoint failed"
    echo "   Response: $ANALYZE_RESPONSE"
fi

echo ""

# Test from browser perspective
echo "6. Testing browser access..."
echo "   Try opening these URLs in your browser:"
echo "   🔗 http://localhost:5000/health"
echo "   🔗 http://localhost:5000/test-connection"
echo ""
echo "   If these work in browser but not in extension, check:"
echo "   - Chrome extension permissions in chrome://extensions/"
echo "   - Extension manifest.json host_permissions"
echo "   - Extension CSP settings"

echo ""
echo "🎉 Connection test complete!"
echo ""
echo "If all tests pass but your extension still fails:"
echo "1. Check Chrome DevTools Console for extension errors"
echo "2. Verify your extension ID matches manifest permissions"
echo "3. Try reloading the extension in chrome://extensions/"
echo "4. Check if any other security software is blocking connections"
