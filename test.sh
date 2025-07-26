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
