#!/bin/bash

echo "📋 Eclipse Shield Logs (press Ctrl+C to exit)"
echo "============================================="

if command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f docker-compose.local.yml logs -f eclipse-shield
else
    docker compose -f docker-compose.local.yml logs -f eclipse-shield
fi
