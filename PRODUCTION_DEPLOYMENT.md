# Archon TRAXIS - Production Deployment Guide

**STORY 02.04: Production Environment & Deployment**

This guide covers deploying Archon TRAXIS in a production environment with monitoring, security, and operational excellence.

## 🏭 Production Architecture

Archon TRAXIS production deployment includes:

- **Core Services**: archon-server, archon-mcp, archon-frontend
- **Infrastructure**: Nginx reverse proxy, Redis cache, PostgreSQL (Supabase)
- **Monitoring**: Prometheus metrics, Grafana dashboards
- **Security**: Resource limits, health checks, structured logging

## 📋 Prerequisites

### System Requirements

- **OS**: Linux (Ubuntu 20.04+ recommended) or Docker Desktop
- **CPU**: 4+ cores recommended
- **Memory**: 8GB+ RAM recommended
- **Storage**: 20GB+ free space
- **Network**: Outbound internet access for external services

### Software Requirements

- Docker 20.10+ and Docker Compose v2
- Git
- curl (for health checks)
- make (optional, for convenience commands)

### External Services

- **Supabase Project**: PostgreSQL database with service key (not anon key)
- **OpenAI API Key**: (Optional) For AI features
- **Logfire Account**: (Optional) For advanced observability

## 🚀 Quick Start

### 1. Clone and Configure

```bash
# Clone the repository
git clone https://github.com/jmtrappier/Archon.git
cd Archon

# Copy and configure environment
cp .env.production.example .env
# Edit .env with your configuration (see Configuration section)
```

### 2. Deploy with Validation

```bash
# Validate environment before deployment
make -f Makefile.production prod-validate

# Deploy to production
make -f Makefile.production prod-deploy
```

### 3. Verify Deployment

```bash
# Check service status
make -f Makefile.production prod-status

# View logs
make -f Makefile.production prod-logs

# Access services
# Frontend: http://localhost:3737
# API: http://localhost:8181
# Metrics: http://localhost:8181/api/metrics
```

## ⚙️ Configuration

### Required Configuration

Edit your `.env` file with these **required** settings:

```bash
# Database (required)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here  # NOT anon key!

# Environment
ENVIRONMENT=production
DEBUG=false
```

### Production Security Configuration

```bash
# Security
HTTPS_ONLY=true
ALLOWED_ORIGINS=https://your-domain.com
EXTERNAL_HOST=your-domain.com

# Monitoring
GRAFANA_ADMIN_PASSWORD=your-secure-password
```

### Performance Tuning

```bash
# Scale based on your resources
WORKER_PROCESSES=4          # CPU cores
MAX_CONNECTIONS=1000        # Concurrent connections
AGENTS_ENABLED=true         # Enable if you need AI processing
```

## 🐳 Docker Services

### Core Application Services

| Service | Port | Purpose | Health Check |
|---------|------|---------|--------------|
| archon-server | 8181 | Main API backend | `/api/health` |
| archon-mcp | 8051 | MCP IDE integration | `/health` |
| archon-frontend | 3737 | React frontend | `/health` |
| archon-agents | 8052 | AI processing (optional) | `/health` |

### Infrastructure Services

| Service | Port | Purpose | Notes |
|---------|------|---------|-------|
| nginx | 80, 443 | Reverse proxy | Load balancing & SSL |
| redis | 6379 | Caching | Internal network only |
| prometheus | 9090 | Metrics collection | With `--profile monitoring` |
| grafana | 3000 | Dashboards | With `--profile monitoring` |

## 📊 Monitoring & Observability

### Health Monitoring

All services provide comprehensive health endpoints:

```bash
# Basic health (load balancer checks)
GET /health

# Detailed readiness (Kubernetes-style)
GET /health/ready

# Liveness probe
GET /health/live

# Service status with metrics
GET /status
```

### Metrics Collection

Prometheus-compatible metrics available at:

```bash
# Application metrics
GET /api/metrics

# System metrics included:
# - Request rates and duration
# - Error rates and counts
# - Memory and CPU usage
# - Database query performance
```

### Structured Logging

Production logging features:

- **JSON formatted** logs for aggregation
- **Log rotation** with size limits
- **Error tracking** with stack traces
- **Request correlation** IDs
- **Performance metrics** embedded

### Grafana Dashboards

Access at `http://localhost:3000` with configured credentials:

- Service health and performance
- Resource utilization
- Error rates and trends
- Business metrics

## 🔧 Operations

### Service Management

```bash
# Start production environment
make -f Makefile.production prod-start

# Start with monitoring stack
make -f Makefile.production prod-start-full

# Stop all services
make -f Makefile.production prod-stop

# Restart services
make -f Makefile.production prod-restart

# View status and health
make -f Makefile.production prod-status
```

### Monitoring & Logs

```bash
# View aggregated logs
make -f Makefile.production prod-logs

# View specific service logs
make -f Makefile.production prod-logs-archon-server

# Open monitoring dashboard
make -f Makefile.production prod-monitor

# Check resource usage
make -f Makefile.production prod-stats
```

### Scaling & Performance

```bash
# Scale specific service
make -f Makefile.production prod-scale SERVICE=archon-server REPLICAS=3

# Run performance tests
make -f Makefile.production prod-test
```

### Backup & Recovery

```bash
# Create backup
make -f Makefile.production prod-backup

# Restore from backup (interactive)
make -f Makefile.production prod-restore
```

## 🔒 Security Considerations

### Network Security

- Services communicate via internal Docker network
- Only necessary ports exposed to host
- Nginx handles SSL termination and rate limiting

### Container Security

- Non-root users in containers
- Read-only filesystem where possible
- Resource limits prevent DoS
- Security options enabled (`no-new-privileges`)

### Application Security

- Environment variable validation
- API key authentication
- CORS configuration
- Input validation and sanitization

### Secret Management

- Environment variables for configuration
- No secrets in container images
- Service keys validated on startup
- Consider external secret management (HashiCorp Vault, AWS Secrets Manager)

## 🚨 Alerting & Troubleshooting

### Common Issues

#### Service Won't Start

```bash
# Check service logs
make -f Makefile.production prod-logs-archon-server

# Validate configuration
make -f Makefile.production prod-validate

# Check port availability
netstat -tln | grep :8181
```

#### Database Connection Issues

```bash
# Verify Supabase configuration
curl -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
     "$SUPABASE_URL/rest/v1/archon_projects?select=id&limit=1"

# Check service key is not anon key
echo $SUPABASE_SERVICE_KEY | grep -q anon && echo "ERROR: Using anon key!"
```

#### Memory Issues

```bash
# Check resource usage
docker stats

# Adjust resource limits in docker-compose.prod.yml
# Increase memory limits for services
```

### Alert Rules

Prometheus alerts configured for:

- Service availability (>1min downtime)
- High memory usage (>90% for 5min)
- High CPU usage (>80% for 5min)
- High error rate (>10% for 2min)
- Database connectivity issues
- High disk usage (>85% for 5min)

## 📈 Performance Optimization

### Application Performance

- **Caching**: Redis for session and data caching
- **Connection pooling**: Optimized database connections
- **Resource limits**: Prevent resource exhaustion
- **Health checks**: Automatic failover for degraded services

### Infrastructure Performance

- **Nginx load balancing**: Multiple backend instances
- **Gzip compression**: Reduced bandwidth usage
- **Static asset caching**: Faster frontend loading
- **Database indexing**: Optimized query performance

### Monitoring Performance

- **Request tracing**: End-to-end request monitoring
- **Database query analysis**: Slow query identification
- **Resource utilization**: CPU, memory, disk tracking
- **Business metrics**: User actions and system usage

## 🔄 Updates & Maintenance

### Updating Production

```bash
# Update with zero downtime
make -f Makefile.production prod-update
```

### Maintenance Windows

1. **Schedule maintenance**: Notify users of planned downtime
2. **Create backup**: `make -f Makefile.production prod-backup`
3. **Update services**: `make -f Makefile.production prod-update`
4. **Validate deployment**: `make -f Makefile.production prod-validate`
5. **Monitor metrics**: Check dashboards for issues

### Rollback Plan

```bash
# If issues arise, rollback quickly
git checkout previous-stable-commit
make -f Makefile.production prod-deploy
```

## 📞 Support & Documentation

### Internal Documentation

- **API Documentation**: Available at `/api/docs` (Swagger/OpenAPI)
- **MCP Tools**: Available at `/api/mcp/tools`
- **Architecture**: See `traxis/architecture/` directory

### Monitoring Resources

- **Grafana**: http://localhost:3000 (dashboard login)
- **Prometheus**: http://localhost:9090 (metrics explorer)
- **Application Metrics**: http://localhost:8181/api/metrics

### Log Locations

- **Container logs**: `docker compose logs [service]`
- **Application logs**: `/app/logs/` (inside containers)
- **Structured logs**: JSON format for aggregation tools

---

## 🎯 Success Metrics

A successful production deployment should achieve:

- ✅ **99.9% uptime** - Services remain available
- ✅ **<500ms response time** - Under normal load
- ✅ **Zero security vulnerabilities** - In production images
- ✅ **Complete observability** - All services monitored
- ✅ **Automated deployment** - Rollback capabilities

For additional support or questions, refer to the project documentation or create an issue in the repository.

---

*Generated for STORY 02.04: Production Environment & Deployment*