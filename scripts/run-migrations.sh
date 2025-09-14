#!/bin/bash

# TRAXIS Database Migration Script
# Run this script to manually apply database migrations

set -e

echo "🔄 TRAXIS Database Migration Tool"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Parse command line arguments
MODE="docker"
if [ "$1" == "--local" ]; then
    MODE="local"
elif [ "$1" == "--help" ]; then
    echo "Usage: $0 [--local|--docker]"
    echo "  --local  : Run migrations against local Supabase (localhost:54322)"
    echo "  --docker : Run migrations inside Docker container (default)"
    exit 0
fi

echo "Mode: $MODE"
echo ""

if [ "$MODE" == "docker" ]; then
    echo "🐳 Running migrations in Docker container..."

    # Check if container is running
    if ! docker ps | grep -q archon-server; then
        echo -e "${YELLOW}⚠️ archon-server container is not running.${NC}"
        echo "Starting container..."
        docker compose up -d archon-server
        sleep 5
    fi

    # Execute migrations inside container
    docker exec archon-server python -c "
import sys
sys.path.append('/app')
from src.server.migrations.migration_runner import run_migrations_on_startup
import logging
logging.basicConfig(level=logging.INFO)
run_migrations_on_startup()
"

    RESULT=$?

else
    echo "💻 Running migrations locally..."

    # Check for Python environment
    if ! command -v python &> /dev/null; then
        echo -e "${RED}❌ Python not found. Please install Python 3.12+${NC}"
        exit 1
    fi

    # Set environment variables for local execution
    export SUPABASE_URL="${SUPABASE_URL:-http://localhost:8000}"
    export SUPABASE_SERVICE_KEY="${SUPABASE_SERVICE_KEY}"

    # Run migrations directly
    cd "$(dirname "$0")/../python"
    python -c "
import sys
sys.path.append('.')
from src.server.migrations.migration_runner import run_migrations_on_startup
import logging
logging.basicConfig(level=logging.INFO)
run_migrations_on_startup()
"

    RESULT=$?
fi

# Check result
if [ $RESULT -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✅ Migrations completed successfully!${NC}"
else
    echo ""
    echo -e "${RED}❌ Migrations failed. Check the logs above for details.${NC}"
    exit 1
fi

# Optional: Show migration status
echo ""
echo "📊 Migration Status:"
echo "-------------------"

if [ "$MODE" == "docker" ]; then
    docker exec archon-server python -c "
import os
from urllib.parse import urlparse
os.environ['PGPASSWORD'] = 'postgres'
url = os.getenv('SUPABASE_URL', '')
if 'localhost' in url or 'host.docker.internal' in url:
    host = 'host.docker.internal'
    port = 54322
else:
    parsed = urlparse(url)
    project_ref = parsed.hostname.split('.')[0]
    host = f'db.{project_ref}.supabase.co'
    port = 5432

import subprocess
result = subprocess.run([
    'psql', '-h', host, '-p', str(port), '-U', 'postgres', '-d', 'postgres',
    '-c', 'SELECT migration_name, status_icon, executed_at FROM archon_migration_status LIMIT 10;'
], capture_output=True, text=True)
print(result.stdout)
" 2>/dev/null || echo "Could not fetch migration status (psql not available in container)"
fi

echo ""
echo "✨ Done!"