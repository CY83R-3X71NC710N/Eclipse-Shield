#!/bin/bash

# Eclipse Shield Extension Troubleshooting Script
echo "🛠️  Eclipse Shield Extension Troubleshooting"
echo "============================================="
echo ""

# Test server endpoints
echo "1. Testing Server Endpoints"
echo "----------------------------"

# Test health
echo "Testing /health endpoint..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/health)
if [ "$HEALTH_STATUS" = "200" ]; then
    echo "✅ Health endpoint: OK"
else
    echo "❌ Health endpoint: Failed (Status: $HEALTH_STATUS)"
fi

# Test ext-popup
echo "Testing /ext-popup endpoint..."
POPUP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/ext-popup)
if [ "$POPUP_STATUS" = "200" ]; then
    echo "✅ Extension popup endpoint: OK"
else
    echo "❌ Extension popup endpoint: Failed (Status: $POPUP_STATUS)"
fi

# Test test-connection
echo "Testing /test-connection endpoint..."
TEST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/test-connection)
if [ "$TEST_STATUS" = "200" ]; then
    echo "✅ Test connection endpoint: OK"
else
    echo "❌ Test connection endpoint: Failed (Status: $TEST_STATUS)"
fi

echo ""

# Test CORS for Chrome Extensions
echo "2. Testing Chrome Extension CORS"
echo "--------------------------------"

# Test Chrome extension CORS
CORS_ORIGIN=$(curl -s -H "Origin: chrome-extension://test" http://localhost:5000/test-connection -I | grep "Access-Control-Allow-Origin" | head -1)
if echo "$CORS_ORIGIN" | grep -q "chrome-extension://test"; then
    echo "✅ Chrome extension CORS: Working"
else
    echo "❌ Chrome extension CORS: Failed"
    echo "   Response: $CORS_ORIGIN"
fi

echo ""

# Test CSP for Chrome Extensions
echo "3. Testing Chrome Extension CSP"
echo "-------------------------------"

CSP_HEADER=$(curl -s -H "Origin: chrome-extension://test" -H "Referer: chrome-extension://test/" http://localhost:5000/ext-popup -I | grep "Content-Security-Policy" | head -1)
if echo "$CSP_HEADER" | grep -q "frame-ancestors.*chrome-extension"; then
    echo "✅ Chrome extension CSP: Allows framing"
else
    echo "❌ Chrome extension CSP: May block framing"
    echo "   CSP: $CSP_HEADER"
fi

echo ""

# Extension checklist
echo "4. Chrome Extension Checklist"
echo "-----------------------------"
echo "Please verify the following in chrome://extensions/:"
echo ""
echo "[ ] Eclipse Shield extension is ENABLED"
echo "[ ] Eclipse Shield extension shows no errors"
echo "[ ] Click 'Reload' button on Eclipse Shield extension"
echo "[ ] Developer mode is enabled (if needed)"
echo ""
echo "Extension permissions should include:"
echo "[ ] activeTab"
echo "[ ] storage"
echo "[ ] webRequest"
echo "[ ] host permissions for http://localhost:5000/*"
echo ""

# Browser test instructions
echo "5. Browser Testing"
echo "-----------------"
echo "Test these URLs in your browser:"
echo "🔗 http://localhost:5000/health"
echo "🔗 http://localhost:5000/test"
echo "🔗 http://localhost:5000/ext-popup"
echo ""
echo "If these work, but your extension doesn't:"
echo "- Check extension console for errors"
echo "- Verify extension permissions"
echo "- Try disabling other extensions temporarily"
echo ""

# Next steps
echo "6. Next Steps"
echo "------------"
if [ "$HEALTH_STATUS" = "200" ] && [ "$POPUP_STATUS" = "200" ] && [ "$TEST_STATUS" = "200" ]; then
    echo "✅ Server is working correctly!"
    echo ""
    echo "If your extension still shows a black screen:"
    echo "1. Open chrome://extensions/"
    echo "2. Find Eclipse Shield and click 'Service Worker'"
    echo "3. Check for error messages in the console"
    echo "4. Try reloading the extension"
    echo "5. Test the extension on a simple webpage"
    echo ""
    echo "Common issues:"
    echo "- Extension ID changed after reload"
    echo "- Extension permissions not properly set"
    echo "- Other security software blocking connections"
    echo "- Browser cache issues (try incognito mode)"
else
    echo "❌ Server issues detected!"
    echo ""
    echo "Please restart the server:"
    echo "1. Stop current server: pkill -f 'python3 secure_app.py'"
    echo "2. Start server: python3 secure_app.py"
    echo "3. Wait 5 seconds, then run this script again"
fi

echo ""
echo "🎯 Pro tip: If you see 'localhost is blocked' in your extension,"
echo "   it usually means the extension can't connect to the server."
echo "   Check your firewall, antivirus, or VPN settings."
