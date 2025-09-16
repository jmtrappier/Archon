#!/bin/bash
# Production Environment Validation Script
# STORY 02.04: Production Environment & Deployment
#
# This script validates that the production environment is properly configured
# and all services are healthy before deploying.

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="${1:-docker-compose.prod.yml}"
TIMEOUT=${TIMEOUT:-60}
RETRY_INTERVAL=5

echo -e "${BLUE}🏭 Archon TRAXIS - Production Environment Validation${NC}"
echo "================================================="
echo "Compose file: $COMPOSE_FILE"
echo "Timeout: ${TIMEOUT}s"
echo ""

# Function to print status
print_status() {
    local status=$1
    local message=$2
    case $status in
        "success")
            echo -e "${GREEN}✅ $message${NC}"
            ;;
        "warning")
            echo -e "${YELLOW}⚠️  $message${NC}"
            ;;
        "error")
            echo -e "${RED}❌ $message${NC}"
            ;;
        "info")
            echo -e "${BLUE}ℹ️  $message${NC}"
            ;;
    esac
}

# Function to check if service is healthy
check_service_health() {
    local service_name=$1
    local health_url=$2
    local max_attempts=$((TIMEOUT / RETRY_INTERVAL))
    local attempt=1

    print_status "info" "Checking health of $service_name..."

    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$health_url" > /dev/null 2>&1; then
            print_status "success" "$service_name is healthy"
            return 0
        fi

        echo "  Attempt $attempt/$max_attempts failed, retrying in ${RETRY_INTERVAL}s..."
        sleep $RETRY_INTERVAL
        ((attempt++))
    done

    print_status "error" "$service_name failed health check after $max_attempts attempts"
    return 1
}

# Function to validate Docker and Docker Compose
validate_docker() {
    print_status "info" "Validating Docker environment..."

    if ! command -v docker &> /dev/null; then
        print_status "error" "Docker is not installed or not in PATH"
        return 1
    fi

    if ! docker info &> /dev/null; then
        print_status "error" "Docker daemon is not running or not accessible"
        return 1
    fi

    if ! command -v docker compose &> /dev/null && ! command -v docker-compose &> /dev/null; then
        print_status "error" "Docker Compose is not installed"
        return 1
    fi

    print_status "success" "Docker environment is ready"
    return 0
}

# Function to validate environment variables
validate_environment_variables() {
    print_status "info" "Validating environment variables..."

    local required_vars=(
        "SUPABASE_URL"
        "SUPABASE_SERVICE_KEY"
        "ARCHON_SERVER_PORT"
        "ARCHON_MCP_PORT"
        "ARCHON_UI_PORT"
    )

    local missing_vars=()

    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            missing_vars+=("$var")
        fi
    done

    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_status "error" "Missing required environment variables: ${missing_vars[*]}"
        print_status "info" "Please set these variables in your .env file or environment"
        return 1
    fi

    # Validate Supabase configuration
    if [[ "$SUPABASE_SERVICE_KEY" == *"anon"* ]]; then
        print_status "warning" "SUPABASE_SERVICE_KEY appears to be an anon key, service key required"
    fi

    print_status "success" "Environment variables are valid"
    return 0
}

# Function to validate compose file
validate_compose_file() {
    print_status "info" "Validating Docker Compose configuration..."

    if [ ! -f "$COMPOSE_FILE" ]; then
        print_status "error" "Compose file not found: $COMPOSE_FILE"
        return 1
    fi

    # Use appropriate docker compose command
    local compose_cmd="docker compose"
    if ! command -v docker compose &> /dev/null; then
        compose_cmd="docker-compose"
    fi

    if ! $compose_cmd -f "$COMPOSE_FILE" config > /dev/null 2>&1; then
        print_status "error" "Docker Compose configuration is invalid"
        $compose_cmd -f "$COMPOSE_FILE" config
        return 1
    fi

    print_status "success" "Docker Compose configuration is valid"
    return 0
}

# Function to check system resources
check_system_resources() {
    print_status "info" "Checking system resources..."

    # Check available memory
    local available_mem_mb
    if command -v free &> /dev/null; then
        available_mem_mb=$(free -m | awk 'NR==2{printf "%.0f", $7}')
        if [ "$available_mem_mb" -lt 1000 ]; then
            print_status "warning" "Low available memory: ${available_mem_mb}MB (recommend 1GB+)"
        else
            print_status "success" "Available memory: ${available_mem_mb}MB"
        fi
    fi

    # Check available disk space
    local available_disk_gb
    available_disk_gb=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
    if [ "$available_disk_gb" -lt 5 ]; then
        print_status "warning" "Low disk space: ${available_disk_gb}GB (recommend 5GB+)"
    else
        print_status "success" "Available disk space: ${available_disk_gb}GB"
    fi

    # Check if required ports are available
    local ports=("${ARCHON_SERVER_PORT}" "${ARCHON_MCP_PORT}" "${ARCHON_UI_PORT}")
    for port in "${ports[@]}"; do
        if netstat -tln 2>/dev/null | grep -q ":$port "; then
            print_status "warning" "Port $port is already in use"
        else
            print_status "success" "Port $port is available"
        fi
    done
}

# Function to start services and validate
start_and_validate_services() {
    print_status "info" "Starting production services..."

    # Use appropriate docker compose command
    local compose_cmd="docker compose"
    if ! command -v docker compose &> /dev/null; then
        compose_cmd="docker-compose"
    fi

    # Start services
    if ! $compose_cmd -f "$COMPOSE_FILE" up -d --build; then
        print_status "error" "Failed to start services"
        return 1
    fi

    print_status "success" "Services started, waiting for initialization..."
    sleep 10

    # Check service health
    local services_healthy=true

    # Check main server
    if ! check_service_health "archon-server" "http://localhost:${ARCHON_SERVER_PORT}/api/health"; then
        services_healthy=false
    fi

    # Check MCP server
    if ! check_service_health "archon-mcp" "http://localhost:${ARCHON_MCP_PORT}/health"; then
        services_healthy=false
    fi

    # Check frontend
    if ! check_service_health "archon-frontend" "http://localhost:${ARCHON_UI_PORT}/health"; then
        services_healthy=false
    fi

    if [ "$services_healthy" = true ]; then
        print_status "success" "All services are healthy"
        return 0
    else
        print_status "error" "Some services are not healthy"
        return 1
    fi
}

# Function to run smoke tests
run_smoke_tests() {
    print_status "info" "Running smoke tests..."

    # Test API endpoints
    local tests_passed=true

    # Test server root endpoint
    if curl -f -s "http://localhost:${ARCHON_SERVER_PORT}/" > /dev/null; then
        print_status "success" "Server root endpoint accessible"
    else
        print_status "error" "Server root endpoint not accessible"
        tests_passed=false
    fi

    # Test metrics endpoint
    if curl -f -s "http://localhost:${ARCHON_SERVER_PORT}/api/metrics" > /dev/null; then
        print_status "success" "Metrics endpoint accessible"
    else
        print_status "warning" "Metrics endpoint not accessible"
    fi

    # Test frontend
    if curl -f -s "http://localhost:${ARCHON_UI_PORT}/" > /dev/null; then
        print_status "success" "Frontend accessible"
    else
        print_status "error" "Frontend not accessible"
        tests_passed=false
    fi

    if [ "$tests_passed" = true ]; then
        print_status "success" "Smoke tests passed"
        return 0
    else
        print_status "error" "Some smoke tests failed"
        return 1
    fi
}

# Function to show logs for debugging
show_service_logs() {
    print_status "info" "Service logs (last 20 lines each):"
    echo ""

    local compose_cmd="docker compose"
    if ! command -v docker compose &> /dev/null; then
        compose_cmd="docker-compose"
    fi

    for service in archon-server archon-mcp archon-frontend; do
        echo -e "${BLUE}--- $service logs ---${NC}"
        $compose_cmd -f "$COMPOSE_FILE" logs --tail=20 "$service" 2>/dev/null || echo "No logs available"
        echo ""
    done
}

# Main validation flow
main() {
    local validation_failed=false

    echo "Starting production environment validation..."
    echo ""

    # Step 1: Validate Docker
    if ! validate_docker; then
        validation_failed=true
    fi

    # Step 2: Validate environment variables
    if ! validate_environment_variables; then
        validation_failed=true
    fi

    # Step 3: Validate compose file
    if ! validate_compose_file; then
        validation_failed=true
    fi

    # Step 4: Check system resources
    check_system_resources

    # If basic validation failed, don't continue
    if [ "$validation_failed" = true ]; then
        print_status "error" "Basic validation failed, cannot proceed with service tests"
        exit 1
    fi

    # Step 5: Start and validate services
    if ! start_and_validate_services; then
        print_status "error" "Service validation failed"
        show_service_logs
        exit 1
    fi

    # Step 6: Run smoke tests
    if ! run_smoke_tests; then
        print_status "error" "Smoke tests failed"
        show_service_logs
        exit 1
    fi

    # All validation passed
    echo ""
    print_status "success" "🎉 Production environment validation completed successfully!"
    echo ""
    echo "Services are ready:"
    echo "  • Frontend: http://localhost:${ARCHON_UI_PORT}"
    echo "  • API: http://localhost:${ARCHON_SERVER_PORT}"
    echo "  • MCP: http://localhost:${ARCHON_MCP_PORT}"
    echo "  • Metrics: http://localhost:${ARCHON_SERVER_PORT}/api/metrics"
    echo ""
}

# Run main function
main "$@"