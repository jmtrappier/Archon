"""
Production Logging Configuration
STORY 02.04: Production Environment & Deployment

This module provides structured logging configuration for production:
- JSON structured logging for log aggregation
- Different log levels for different environments
- Log rotation and management
- Integration with monitoring systems
"""

import json
import logging
import logging.config
import os
import sys
from datetime import datetime
from typing import Dict, Any
from pathlib import Path

class JSONFormatter(logging.Formatter):
    """
    JSON formatter for structured logging.
    Formats log records as JSON for easy parsing by log aggregation systems.
    """

    def format(self, record: logging.LogRecord) -> str:
        # Create base log entry
        log_entry = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'service': 'archon-backend',
            'environment': os.getenv('ENVIRONMENT', 'development')
        }

        # Add contextual information
        if hasattr(record, 'module'):
            log_entry['module'] = record.module

        if hasattr(record, 'funcName'):
            log_entry['function'] = record.funcName

        if hasattr(record, 'lineno'):
            log_entry['line'] = record.lineno

        # Add extra fields from LogRecord
        for key, value in record.__dict__.items():
            if key not in ['name', 'msg', 'args', 'levelname', 'levelno', 'pathname',
                          'filename', 'module', 'lineno', 'funcName', 'created', 'msecs',
                          'relativeCreated', 'thread', 'threadName', 'processName',
                          'process', 'getMessage', 'stack_info', 'exc_info', 'exc_text']:
                log_entry[key] = value

        # Add exception information if present
        if record.exc_info:
            log_entry['exception'] = {
                'type': record.exc_info[0].__name__ if record.exc_info[0] else None,
                'message': str(record.exc_info[1]) if record.exc_info[1] else None,
                'traceback': self.formatException(record.exc_info) if record.exc_info else None
            }

        # Add stack trace for debugging
        if record.stack_info:
            log_entry['stack'] = record.stack_info

        return json.dumps(log_entry, default=str, ensure_ascii=False)

class ProductionLoggingConfig:
    """Production logging configuration manager."""

    @staticmethod
    def setup_logging(
        service_name: str = 'archon-backend',
        log_level: str = None,
        log_dir: str = '/app/logs'
    ) -> None:
        """
        Set up production logging configuration.

        Args:
            service_name: Name of the service for log identification
            log_level: Override log level (defaults to environment variable)
            log_dir: Directory for log files
        """

        # Determine log level
        if log_level is None:
            log_level = os.getenv('LOG_LEVEL', 'INFO').upper()

        # Determine environment
        environment = os.getenv('ENVIRONMENT', 'development').lower()

        # Create log directory
        log_path = Path(log_dir)
        log_path.mkdir(parents=True, exist_ok=True)

        # Log file paths
        main_log_file = log_path / f"{service_name}.log"
        error_log_file = log_path / f"{service_name}.error.log"

        # Different configurations for different environments
        if environment == 'production':
            config = ProductionLoggingConfig._get_production_config(
                service_name, log_level, main_log_file, error_log_file
            )
        else:
            config = ProductionLoggingConfig._get_development_config(
                service_name, log_level, main_log_file, error_log_file
            )

        # Apply configuration
        logging.config.dictConfig(config)

        # Set up root logger
        root_logger = logging.getLogger()
        root_logger.info(f"Logging configured for {service_name} in {environment} mode")
        root_logger.info(f"Log level: {log_level}")
        root_logger.info(f"Log directory: {log_dir}")

    @staticmethod
    def _get_production_config(
        service_name: str,
        log_level: str,
        main_log_file: Path,
        error_log_file: Path
    ) -> Dict[str, Any]:
        """Get production logging configuration with JSON formatting."""
        return {
            'version': 1,
            'disable_existing_loggers': False,
            'formatters': {
                'json': {
                    '()': JSONFormatter,
                },
                'detailed': {
                    'format': '%(asctime)s - %(name)s - %(levelname)s - %(module)s:%(funcName)s:%(lineno)d - %(message)s',
                    'datefmt': '%Y-%m-%d %H:%M:%S'
                }
            },
            'handlers': {
                'console': {
                    'class': 'logging.StreamHandler',
                    'level': log_level,
                    'formatter': 'json',
                    'stream': 'ext://sys.stdout'
                },
                'file': {
                    'class': 'logging.handlers.RotatingFileHandler',
                    'level': 'INFO',
                    'formatter': 'json',
                    'filename': str(main_log_file),
                    'maxBytes': 50 * 1024 * 1024,  # 50MB
                    'backupCount': 5,
                    'encoding': 'utf-8'
                },
                'error_file': {
                    'class': 'logging.handlers.RotatingFileHandler',
                    'level': 'ERROR',
                    'formatter': 'detailed',  # Use detailed format for errors
                    'filename': str(error_log_file),
                    'maxBytes': 10 * 1024 * 1024,  # 10MB
                    'backupCount': 3,
                    'encoding': 'utf-8'
                }
            },
            'loggers': {
                '': {  # Root logger
                    'level': log_level,
                    'handlers': ['console', 'file', 'error_file'],
                    'propagate': False
                },
                'uvicorn': {
                    'level': 'WARNING',  # Reduce uvicorn noise
                    'handlers': ['console'],
                    'propagate': False
                },
                'uvicorn.access': {
                    'level': 'WARNING',  # Reduce access log noise
                    'handlers': ['file'],
                    'propagate': False
                },
                'fastapi': {
                    'level': 'INFO',
                    'handlers': ['console', 'file'],
                    'propagate': False
                },
                'sqlalchemy': {
                    'level': 'WARNING',  # Reduce SQL noise
                    'handlers': ['file'],
                    'propagate': False
                }
            }
        }

    @staticmethod
    def _get_development_config(
        service_name: str,
        log_level: str,
        main_log_file: Path,
        error_log_file: Path
    ) -> Dict[str, Any]:
        """Get development logging configuration with readable formatting."""
        return {
            'version': 1,
            'disable_existing_loggers': False,
            'formatters': {
                'detailed': {
                    'format': '%(asctime)s - %(name)s - %(levelname)s - %(module)s:%(funcName)s:%(lineno)d - %(message)s',
                    'datefmt': '%Y-%m-%d %H:%M:%S'
                },
                'simple': {
                    'format': '%(levelname)s - %(name)s - %(message)s'
                },
                'json': {
                    '()': JSONFormatter,
                }
            },
            'handlers': {
                'console': {
                    'class': 'logging.StreamHandler',
                    'level': log_level,
                    'formatter': 'detailed',
                    'stream': 'ext://sys.stdout'
                },
                'file': {
                    'class': 'logging.handlers.RotatingFileHandler',
                    'level': 'DEBUG',
                    'formatter': 'json',  # Still use JSON for files in dev
                    'filename': str(main_log_file),
                    'maxBytes': 10 * 1024 * 1024,  # 10MB
                    'backupCount': 2,
                    'encoding': 'utf-8'
                }
            },
            'loggers': {
                '': {  # Root logger
                    'level': log_level,
                    'handlers': ['console', 'file'],
                    'propagate': False
                },
                'uvicorn.access': {
                    'level': 'INFO',
                    'handlers': ['console'],
                    'propagate': False
                }
            }
        }

    @staticmethod
    def create_structured_logger(name: str) -> logging.Logger:
        """
        Create a logger with structured logging capabilities.

        Args:
            name: Logger name (usually __name__)

        Returns:
            Logger instance configured for structured logging
        """
        logger = logging.getLogger(name)

        # Add helper methods for structured logging
        def log_with_context(level: int, message: str, **context):
            """Log with additional context fields."""
            if logger.isEnabledFor(level):
                record = logger.makeRecord(
                    logger.name, level, __file__, 0, message, (), None
                )
                # Add context fields to record
                for key, value in context.items():
                    setattr(record, key, value)
                logger.handle(record)

        # Add convenience methods
        logger.info_with_context = lambda msg, **ctx: log_with_context(logging.INFO, msg, **ctx)
        logger.error_with_context = lambda msg, **ctx: log_with_context(logging.ERROR, msg, **ctx)
        logger.warning_with_context = lambda msg, **ctx: log_with_context(logging.WARNING, msg, **ctx)
        logger.debug_with_context = lambda msg, **ctx: log_with_context(logging.DEBUG, msg, **ctx)

        return logger

# Convenience functions
def setup_production_logging(service_name: str = 'archon-backend') -> None:
    """Set up logging for production environment."""
    ProductionLoggingConfig.setup_logging(service_name)

def get_structured_logger(name: str) -> logging.Logger:
    """Get a logger with structured logging capabilities."""
    return ProductionLoggingConfig.create_structured_logger(name)

# Context manager for request logging
class RequestLoggingContext:
    """Context manager for logging request-specific information."""

    def __init__(self, logger: logging.Logger, request_id: str = None):
        self.logger = logger
        self.request_id = request_id or f"req-{datetime.utcnow().timestamp()}"
        self.start_time = None

    def __enter__(self):
        self.start_time = datetime.utcnow()
        self.logger.info_with_context(
            "Request started",
            request_id=self.request_id,
            start_time=self.start_time.isoformat()
        )
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        end_time = datetime.utcnow()
        duration = (end_time - self.start_time).total_seconds()

        if exc_type is None:
            self.logger.info_with_context(
                "Request completed successfully",
                request_id=self.request_id,
                duration_seconds=duration,
                end_time=end_time.isoformat()
            )
        else:
            self.logger.error_with_context(
                "Request failed",
                request_id=self.request_id,
                duration_seconds=duration,
                end_time=end_time.isoformat(),
                exception_type=exc_type.__name__ if exc_type else None,
                exception_message=str(exc_val) if exc_val else None
            )