"""
Production Configuration & Secret Management
STORY 02.04: Production Environment & Deployment

This module provides production-ready configuration management with:
- Environment variable validation
- Secret management with security checks
- Configuration validation on startup
- Production vs development environment detection
"""

import os
import logging
import sys
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

@dataclass
class ConfigValidationError(Exception):
    """Raised when configuration validation fails."""
    missing_vars: List[str]
    invalid_vars: List[str]
    message: str

@dataclass
class ProductionConfig:
    """Production configuration with validation."""

    # Environment detection
    environment: str
    debug: bool

    # Database configuration
    supabase_url: str
    supabase_service_key: str

    # External services
    openai_api_key: Optional[str]
    logfire_token: Optional[str]

    # Service configuration
    archon_server_port: int
    archon_mcp_port: int
    archon_agents_port: int
    archon_ui_port: int

    # Performance & limits
    worker_processes: int
    max_connections: int
    connection_timeout: int

    # Security
    allowed_origins: List[str]
    api_key_header: str
    https_only: bool

    # Monitoring
    prometheus_enabled: bool
    grafana_enabled: bool
    health_check_interval: int

    @classmethod
    def from_environment(cls) -> 'ProductionConfig':
        """Create configuration from environment variables with validation."""

        # Environment detection
        environment = os.getenv('ENVIRONMENT', 'development').lower()
        debug = os.getenv('DEBUG', 'false').lower() == 'true'

        # In production, debug should be False
        if environment == 'production' and debug:
            logger.warning("DEBUG=true in production environment - forcing to False")
            debug = False

        # Validate required configuration
        missing_vars = []
        invalid_vars = []

        # Required for all environments
        supabase_url = os.getenv('SUPABASE_URL')
        if not supabase_url:
            missing_vars.append('SUPABASE_URL')

        supabase_service_key = os.getenv('SUPABASE_SERVICE_KEY')
        if not supabase_service_key:
            missing_vars.append('SUPABASE_SERVICE_KEY')
        elif supabase_service_key.startswith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'):
            # This looks like an anon key - validate it's actually a service key
            if 'anon' in supabase_service_key or len(supabase_service_key) < 100:
                invalid_vars.append('SUPABASE_SERVICE_KEY (appears to be anon key, need service key)')

        # Service ports with defaults
        try:
            archon_server_port = int(os.getenv('ARCHON_SERVER_PORT', '8181'))
            archon_mcp_port = int(os.getenv('ARCHON_MCP_PORT', '8051'))
            archon_agents_port = int(os.getenv('ARCHON_AGENTS_PORT', '8052'))
            archon_ui_port = int(os.getenv('ARCHON_UI_PORT', '3737'))
        except ValueError as e:
            invalid_vars.append(f'Port configuration invalid: {e}')
            # Use defaults
            archon_server_port = 8181
            archon_mcp_port = 8051
            archon_agents_port = 8052
            archon_ui_port = 3737

        # Performance settings
        try:
            worker_processes = int(os.getenv('WORKER_PROCESSES', '4'))
            max_connections = int(os.getenv('MAX_CONNECTIONS', '1000'))
            connection_timeout = int(os.getenv('CONNECTION_TIMEOUT', '30'))
        except ValueError as e:
            invalid_vars.append(f'Performance configuration invalid: {e}')
            worker_processes = 4
            max_connections = 1000
            connection_timeout = 30

        # Security configuration
        allowed_origins_str = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3737')
        allowed_origins = [origin.strip() for origin in allowed_origins_str.split(',')]

        api_key_header = os.getenv('API_KEY_HEADER', 'X-API-Key')
        https_only = os.getenv('HTTPS_ONLY', 'false').lower() == 'true'

        # Optional services
        openai_api_key = os.getenv('OPENAI_API_KEY')
        logfire_token = os.getenv('LOGFIRE_TOKEN')

        # Monitoring
        prometheus_enabled = os.getenv('PROMETHEUS_ENABLED', 'true').lower() == 'true'
        grafana_enabled = os.getenv('GRAFANA_ENABLED', 'true').lower() == 'true'

        try:
            health_check_interval = int(os.getenv('HEALTH_CHECK_INTERVAL', '30'))
        except ValueError:
            health_check_interval = 30

        # Production-specific validation
        if environment == 'production':
            # In production, certain things are required
            if not openai_api_key:
                logger.warning("OPENAI_API_KEY not set in production - AI features will be limited")

            if https_only and not any('https://' in origin for origin in allowed_origins):
                logger.warning("HTTPS_ONLY=true but no HTTPS origins configured")

        # Raise validation errors if any critical issues
        if missing_vars or invalid_vars:
            error_msg = []
            if missing_vars:
                error_msg.append(f"Missing required variables: {', '.join(missing_vars)}")
            if invalid_vars:
                error_msg.append(f"Invalid configuration: {', '.join(invalid_vars)}")

            raise ConfigValidationError(
                missing_vars=missing_vars,
                invalid_vars=invalid_vars,
                message="; ".join(error_msg)
            )

        return cls(
            environment=environment,
            debug=debug,
            supabase_url=supabase_url,
            supabase_service_key=supabase_service_key,
            openai_api_key=openai_api_key,
            logfire_token=logfire_token,
            archon_server_port=archon_server_port,
            archon_mcp_port=archon_mcp_port,
            archon_agents_port=archon_agents_port,
            archon_ui_port=archon_ui_port,
            worker_processes=worker_processes,
            max_connections=max_connections,
            connection_timeout=connection_timeout,
            allowed_origins=allowed_origins,
            api_key_header=api_key_header,
            https_only=https_only,
            prometheus_enabled=prometheus_enabled,
            grafana_enabled=grafana_enabled,
            health_check_interval=health_check_interval
        )

    def validate_startup(self) -> Dict[str, Any]:
        """Perform startup validation checks."""
        checks = {
            'config_loaded': True,
            'environment': self.environment,
            'debug_mode': self.debug,
            'services_configured': True,
            'security_configured': True,
            'monitoring_enabled': self.prometheus_enabled,
            'warnings': []
        }

        # Validate service ports are available
        import socket
        for service, port in [
            ('server', self.archon_server_port),
            ('mcp', self.archon_mcp_port),
            ('agents', self.archon_agents_port),
            ('ui', self.archon_ui_port)
        ]:
            if not self._is_port_available(port):
                checks['warnings'].append(f"{service} port {port} may not be available")

        # Security validation
        if self.environment == 'production':
            if self.debug:
                checks['warnings'].append("Debug mode enabled in production")

            if not self.https_only:
                checks['warnings'].append("HTTPS not enforced in production")

            if len(self.supabase_service_key) < 100:
                checks['warnings'].append("Supabase service key appears invalid")

        return checks

    def _is_port_available(self, port: int) -> bool:
        """Check if a port is available for binding."""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('localhost', port))
                return True
        except OSError:
            return False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging (without sensitive data)."""
        return {
            'environment': self.environment,
            'debug': self.debug,
            'archon_server_port': self.archon_server_port,
            'archon_mcp_port': self.archon_mcp_port,
            'archon_agents_port': self.archon_agents_port,
            'archon_ui_port': self.archon_ui_port,
            'worker_processes': self.worker_processes,
            'max_connections': self.max_connections,
            'connection_timeout': self.connection_timeout,
            'allowed_origins': self.allowed_origins,
            'https_only': self.https_only,
            'prometheus_enabled': self.prometheus_enabled,
            'grafana_enabled': self.grafana_enabled,
            'health_check_interval': self.health_check_interval,
            'has_openai_key': bool(self.openai_api_key),
            'has_logfire_token': bool(self.logfire_token),
            'has_supabase_config': bool(self.supabase_url and self.supabase_service_key)
        }

# Global configuration instance
_production_config: Optional[ProductionConfig] = None

def get_production_config() -> ProductionConfig:
    """Get or create production configuration singleton."""
    global _production_config

    if _production_config is None:
        _production_config = ProductionConfig.from_environment()
        logger.info("Production configuration loaded successfully")

        # Log configuration (without secrets)
        config_dict = _production_config.to_dict()
        logger.info(f"Configuration: {config_dict}")

        # Perform startup validation
        validation_results = _production_config.validate_startup()
        if validation_results['warnings']:
            for warning in validation_results['warnings']:
                logger.warning(f"Configuration warning: {warning}")

    return _production_config

def validate_production_environment():
    """Validate production environment and fail fast if issues."""
    try:
        config = get_production_config()

        if config.environment == 'production':
            logger.info("🏭 Running in PRODUCTION mode")

            # Extra validation for production
            critical_issues = []

            # Check for development-only settings
            if config.debug:
                critical_issues.append("DEBUG mode enabled in production")

            # Check security settings
            if not config.https_only and 'localhost' not in str(config.allowed_origins):
                critical_issues.append("HTTPS not enforced for external access")

            if critical_issues:
                error_msg = "Critical production configuration issues: " + "; ".join(critical_issues)
                logger.error(error_msg)
                raise ConfigValidationError([], critical_issues, error_msg)

        else:
            logger.info(f"🛠️ Running in {config.environment.upper()} mode")

        return config

    except ConfigValidationError as e:
        logger.error(f"Configuration validation failed: {e.message}")
        logger.error("Application cannot start with invalid configuration")
        sys.exit(1)

    except Exception as e:
        logger.error(f"Unexpected error during configuration validation: {e}")
        sys.exit(1)

# Environment helper functions
def is_production() -> bool:
    """Check if running in production environment."""
    return get_production_config().environment == 'production'

def is_development() -> bool:
    """Check if running in development environment."""
    return get_production_config().environment == 'development'

def get_service_url(service: str) -> str:
    """Get service URL based on configuration."""
    config = get_production_config()

    port_map = {
        'server': config.archon_server_port,
        'mcp': config.archon_mcp_port,
        'agents': config.archon_agents_port,
        'ui': config.archon_ui_port
    }

    if service not in port_map:
        raise ValueError(f"Unknown service: {service}")

    protocol = 'https' if config.https_only else 'http'
    host = 'localhost'  # In Docker, this would be service name
    port = port_map[service]

    return f"{protocol}://{host}:{port}"