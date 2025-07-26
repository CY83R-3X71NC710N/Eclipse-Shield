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
