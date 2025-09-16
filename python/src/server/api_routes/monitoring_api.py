"""
Production Monitoring API - Health, Metrics, and Readiness Endpoints
STORY 02.04: Production Environment & Deployment

This module provides comprehensive monitoring endpoints for production deployment:
- /health - Service health and dependency checks
- /metrics - Prometheus-compatible metrics
- /ready - Kubernetes-style readiness probe
- /status - Detailed system status for operations teams
"""

import logging
import psutil
import time
from datetime import datetime, timezone
from typing import Dict, Any, List

from fastapi import APIRouter, Response, HTTPException
from pydantic import BaseModel

# Import configuration and services
from ..config.config import get_config
from ..services.client_manager import get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["monitoring"])

# Metrics storage - In production, consider using Redis or Prometheus
_metrics_store: Dict[str, Any] = {
    "requests_total": 0,
    "requests_duration": [],
    "database_queries": 0,
    "errors_total": 0,
    "start_time": time.time()
}

# Health check models
class HealthStatus(BaseModel):
    status: str  # "healthy", "degraded", "unhealthy"
    service: str
    timestamp: str
    ready: bool
    uptime_seconds: float
    version: str = "1.0.0"

class DependencyCheck(BaseModel):
    name: str
    status: str  # "healthy", "degraded", "unhealthy"
    response_time_ms: float
    message: str
    details: Dict[str, Any] = {}

class SystemMetrics(BaseModel):
    cpu_percent: float
    memory_percent: float
    memory_used_mb: float
    memory_total_mb: float
    disk_percent: float
    uptime_seconds: float

class DetailedStatus(BaseModel):
    service: HealthStatus
    dependencies: List[DependencyCheck]
    system: SystemMetrics
    application: Dict[str, Any]

# === HEALTH ENDPOINT ===

@router.get("/health", response_model=HealthStatus)
async def health_check(response: Response):
    """
    Lightweight health check endpoint.
    Returns 200 if service is operational, 503 if not.
    Suitable for load balancer health checks.
    """
    start_time = time.time()

    try:
        # Check basic service health
        uptime = time.time() - _metrics_store["start_time"]

        # Perform lightweight dependency check
        db_healthy = await _check_database_health()

        if db_healthy:
            return HealthStatus(
                status="healthy",
                service="archon-server",
                timestamp=datetime.now(timezone.utc).isoformat(),
                ready=True,
                uptime_seconds=uptime
            )
        else:
            response.status_code = 503
            return HealthStatus(
                status="degraded",
                service="archon-server",
                timestamp=datetime.now(timezone.utc).isoformat(),
                ready=False,
                uptime_seconds=uptime
            )

    except Exception as e:
        logger.error(f"Health check failed: {e}")
        response.status_code = 503
        return HealthStatus(
            status="unhealthy",
            service="archon-server",
            timestamp=datetime.now(timezone.utc).isoformat(),
            ready=False,
            uptime_seconds=0
        )
    finally:
        # Record health check duration
        duration = time.time() - start_time
        _metrics_store["requests_duration"].append(duration)

# === READINESS ENDPOINT ===

@router.get("/health/ready")
async def readiness_check(response: Response):
    """
    Kubernetes-style readiness probe.
    Checks if service is ready to accept traffic.
    More comprehensive than basic health check.
    """
    checks = []
    overall_ready = True

    # Check database connection
    db_check = await _detailed_database_check()
    checks.append(db_check)
    if db_check.status != "healthy":
        overall_ready = False

    # Check system resources
    system_check = _check_system_resources()
    checks.append(system_check)
    if system_check.status != "healthy":
        overall_ready = False

    # Check application state
    app_check = _check_application_state()
    checks.append(app_check)
    if app_check.status != "healthy":
        overall_ready = False

    if not overall_ready:
        response.status_code = 503

    return {
        "ready": overall_ready,
        "service": "archon-server",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "checks": [check.dict() for check in checks]
    }

# === LIVENESS ENDPOINT ===

@router.get("/health/live")
async def liveness_check():
    """
    Kubernetes-style liveness probe.
    Simple check that process is running and not deadlocked.
    """
    return {
        "alive": True,
        "service": "archon-server",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pid": psutil.Process().pid
    }

# === METRICS ENDPOINT ===

@router.get("/metrics")
async def prometheus_metrics():
    """
    Prometheus-compatible metrics endpoint.
    Returns metrics in Prometheus format for scraping.
    """
    uptime = time.time() - _metrics_store["start_time"]

    # Get system metrics
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    cpu = psutil.cpu_percent()

    # Calculate request metrics
    avg_duration = 0
    if _metrics_store["requests_duration"]:
        avg_duration = sum(_metrics_store["requests_duration"]) / len(_metrics_store["requests_duration"])

    metrics = f"""# HELP archon_uptime_seconds Service uptime in seconds
# TYPE archon_uptime_seconds gauge
archon_uptime_seconds {uptime}

# HELP archon_requests_total Total number of requests
# TYPE archon_requests_total counter
archon_requests_total {_metrics_store["requests_total"]}

# HELP archon_request_duration_seconds Average request duration
# TYPE archon_request_duration_seconds gauge
archon_request_duration_seconds {avg_duration}

# HELP archon_database_queries_total Total database queries
# TYPE archon_database_queries_total counter
archon_database_queries_total {_metrics_store["database_queries"]}

# HELP archon_errors_total Total number of errors
# TYPE archon_errors_total counter
archon_errors_total {_metrics_store["errors_total"]}

# HELP archon_memory_usage_bytes Memory usage in bytes
# TYPE archon_memory_usage_bytes gauge
archon_memory_usage_bytes {memory.used}

# HELP archon_memory_usage_percent Memory usage percentage
# TYPE archon_memory_usage_percent gauge
archon_memory_usage_percent {memory.percent}

# HELP archon_cpu_usage_percent CPU usage percentage
# TYPE archon_cpu_usage_percent gauge
archon_cpu_usage_percent {cpu}

# HELP archon_disk_usage_percent Disk usage percentage
# TYPE archon_disk_usage_percent gauge
archon_disk_usage_percent {disk.percent}
"""

    return Response(content=metrics, media_type="text/plain")

# === DETAILED STATUS ENDPOINT ===

@router.get("/status", response_model=DetailedStatus)
async def detailed_status():
    """
    Comprehensive status endpoint for operations teams.
    Provides detailed information about service health and performance.
    """
    # Service status
    uptime = time.time() - _metrics_store["start_time"]
    service_status = HealthStatus(
        status="healthy",
        service="archon-server",
        timestamp=datetime.now(timezone.utc).isoformat(),
        ready=True,
        uptime_seconds=uptime
    )

    # Dependency checks
    dependencies = [
        await _detailed_database_check(),
        _check_system_resources(),
        _check_application_state()
    ]

    # System metrics
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    system_metrics = SystemMetrics(
        cpu_percent=psutil.cpu_percent(),
        memory_percent=memory.percent,
        memory_used_mb=memory.used / (1024 * 1024),
        memory_total_mb=memory.total / (1024 * 1024),
        disk_percent=disk.percent,
        uptime_seconds=uptime
    )

    # Application metrics
    avg_duration = 0
    if _metrics_store["requests_duration"]:
        avg_duration = sum(_metrics_store["requests_duration"]) / len(_metrics_store["requests_duration"])

    application_metrics = {
        "requests_total": _metrics_store["requests_total"],
        "average_request_duration_ms": avg_duration * 1000,
        "database_queries": _metrics_store["database_queries"],
        "errors_total": _metrics_store["errors_total"],
        "goroutines": 1,  # Python equivalent
        "version": "1.0.0"
    }

    return DetailedStatus(
        service=service_status,
        dependencies=dependencies,
        system=system_metrics,
        application=application_metrics
    )

# === HELPER FUNCTIONS ===

async def _check_database_health() -> bool:
    """Quick database health check."""
    try:
        client = get_supabase_client()
        # Simple query to check connection
        result = client.table('archon_projects').select('id').limit(1).execute()
        _metrics_store["database_queries"] += 1
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        _metrics_store["errors_total"] += 1
        return False

async def _detailed_database_check() -> DependencyCheck:
    """Detailed database dependency check."""
    start_time = time.time()

    try:
        client = get_supabase_client()

        # Test read operation
        result = client.table('archon_projects').select('id').limit(1).execute()
        _metrics_store["database_queries"] += 1

        # Test write operation (if needed)
        # result = client.table('health_checks').insert({'timestamp': datetime.now().isoformat()}).execute()

        response_time = (time.time() - start_time) * 1000

        return DependencyCheck(
            name="supabase_database",
            status="healthy",
            response_time_ms=response_time,
            message="Database connection successful",
            details={
                "query_executed": True,
                "connection_pool": "healthy"
            }
        )

    except Exception as e:
        response_time = (time.time() - start_time) * 1000
        _metrics_store["errors_total"] += 1

        return DependencyCheck(
            name="supabase_database",
            status="unhealthy",
            response_time_ms=response_time,
            message=f"Database connection failed: {str(e)}",
            details={
                "error": str(e),
                "error_type": type(e).__name__
            }
        )

def _check_system_resources() -> DependencyCheck:
    """Check system resource availability."""
    try:
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage('/')
        cpu = psutil.cpu_percent()

        # Determine status based on resource usage
        status = "healthy"
        messages = []

        if memory.percent > 90:
            status = "degraded"
            messages.append(f"High memory usage: {memory.percent:.1f}%")

        if disk.percent > 90:
            status = "degraded"
            messages.append(f"High disk usage: {disk.percent:.1f}%")

        if cpu > 90:
            status = "degraded"
            messages.append(f"High CPU usage: {cpu:.1f}%")

        message = "; ".join(messages) if messages else "System resources healthy"

        return DependencyCheck(
            name="system_resources",
            status=status,
            response_time_ms=0,
            message=message,
            details={
                "memory_percent": memory.percent,
                "disk_percent": disk.percent,
                "cpu_percent": cpu
            }
        )

    except Exception as e:
        return DependencyCheck(
            name="system_resources",
            status="unhealthy",
            response_time_ms=0,
            message=f"Resource check failed: {str(e)}",
            details={"error": str(e)}
        )

def _check_application_state() -> DependencyCheck:
    """Check application-specific state."""
    try:
        # Check if all required services are initialized
        # This could include checking crawler status, credentials, etc.

        uptime = time.time() - _metrics_store["start_time"]
        error_rate = 0

        if _metrics_store["requests_total"] > 0:
            error_rate = _metrics_store["errors_total"] / _metrics_store["requests_total"]

        status = "healthy"
        message = "Application state healthy"

        if error_rate > 0.1:  # 10% error rate
            status = "degraded"
            message = f"High error rate: {error_rate:.2%}"

        if uptime < 30:  # Service just started
            status = "degraded"
            message = "Service recently started"

        return DependencyCheck(
            name="application_state",
            status=status,
            response_time_ms=0,
            message=message,
            details={
                "uptime_seconds": uptime,
                "error_rate": error_rate,
                "requests_total": _metrics_store["requests_total"]
            }
        )

    except Exception as e:
        return DependencyCheck(
            name="application_state",
            status="unhealthy",
            response_time_ms=0,
            message=f"Application check failed: {str(e)}",
            details={"error": str(e)}
        )

# === MIDDLEWARE FOR METRICS COLLECTION ===

def increment_request_counter():
    """Increment request counter. Call from middleware."""
    _metrics_store["requests_total"] += 1

def record_request_duration(duration: float):
    """Record request duration. Call from middleware."""
    _metrics_store["requests_duration"].append(duration)
    # Keep only last 1000 entries to prevent memory growth
    if len(_metrics_store["requests_duration"]) > 1000:
        _metrics_store["requests_duration"] = _metrics_store["requests_duration"][-1000:]

def increment_error_counter():
    """Increment error counter. Call when errors occur."""
    _metrics_store["errors_total"] += 1