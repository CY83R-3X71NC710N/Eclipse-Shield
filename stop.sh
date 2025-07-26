#!/bin/bash

echo "🛑 Stopping Eclipse Shield..."

if command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f docker-compose.local.yml down
else
    docker compose -f docker-compose.local.yml down
fi

echo "✅ Eclipse Shield stopped"
