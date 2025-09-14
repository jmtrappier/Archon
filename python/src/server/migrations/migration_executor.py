"""
Direct SQL Migration Executor for TRAXIS

Uses psycopg2 to execute migrations directly against the database.
This provides better control over transactions and error handling.
"""

import hashlib
import logging
import os
import re
import time
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class DirectMigrationExecutor:
    """Execute migrations directly using psycopg2."""

    def __init__(self):
        """Initialize with database connection from environment."""
        self.supabase_url = os.getenv("SUPABASE_URL", "")
        self.connection = None
        self.migrations_dir = self._find_migrations_dir()

    def _find_migrations_dir(self) -> Path:
        """Find the migrations directory."""
        # Try Docker path first
        docker_path = Path("/app/migration")
        if docker_path.exists():
            return docker_path

        # Try relative path from this file
        local_path = Path(__file__).parent.parent.parent.parent.parent / "migration"
        if local_path.exists():
            return local_path

        # Fallback to current directory
        return Path("migration")

    def _get_db_connection_params(self) -> dict:
        """Extract database connection parameters from Supabase URL."""
        if not self.supabase_url:
            raise ValueError("SUPABASE_URL not set")

        # Parse Supabase URL to get database connection
        # Format: https://xxxxx.supabase.co or http://localhost:8000
        parsed = urlparse(self.supabase_url)

        # For Supabase cloud
        if "supabase.co" in parsed.hostname:
            # Extract project ref from hostname
            project_ref = parsed.hostname.split('.')[0]
            return {
                "host": f"db.{project_ref}.supabase.co",
                "port": 5432,
                "database": "postgres",
                "user": "postgres",
                "password": os.getenv("SUPABASE_SERVICE_KEY", "")
            }

        # For local Supabase
        elif "localhost" in parsed.hostname or "127.0.0.1" in parsed.hostname:
            # Local Supabase typically runs PostgreSQL on port 54322
            return {
                "host": "localhost",
                "port": 54322,
                "database": "postgres",
                "user": "postgres",
                "password": "postgres"  # Default local password
            }

        # For Docker Supabase (host.docker.internal)
        elif "host.docker.internal" in self.supabase_url:
            return {
                "host": "host.docker.internal",
                "port": 5432,
                "database": "postgres",
                "user": "postgres",
                "password": "your-super-secret-and-long-postgres-password"
            }

        else:
            raise ValueError(f"Unknown Supabase URL format: {self.supabase_url}")

    def connect(self) -> bool:
        """Establish database connection."""
        try:
            import psycopg2

            params = self._get_db_connection_params()
            self.connection = psycopg2.connect(**params)
            self.connection.autocommit = False  # Use transactions
            logger.info(f"Connected to database at {params['host']}:{params['port']}")
            return True

        except ImportError:
            logger.error("psycopg2 not installed. Using fallback migration method.")
            return False

        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            return False

    def disconnect(self):
        """Close database connection."""
        if self.connection:
            try:
                self.connection.close()
            except Exception:
                pass

    def execute_migration_file(self, file_path: Path) -> Tuple[bool, Optional[str]]:
        """
        Execute a SQL migration file.

        Args:
            file_path: Path to the SQL file

        Returns:
            Tuple of (success, error_message)
        """
        if not self.connection:
            return False, "No database connection"

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                sql_content = f.read()

            cursor = self.connection.cursor()

            try:
                # Execute the entire migration as one transaction
                cursor.execute(sql_content)
                self.connection.commit()
                return True, None

            except Exception as e:
                self.connection.rollback()
                return False, str(e)

            finally:
                cursor.close()

        except Exception as e:
            return False, f"Failed to read file: {e}"

    def check_migration_table_exists(self) -> bool:
        """Check if the migration tracking table exists."""
        if not self.connection:
            return False

        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public'
                    AND table_name = 'archon_migrations'
                )
            """)
            exists = cursor.fetchone()[0]
            cursor.close()
            return exists

        except Exception as e:
            logger.error(f"Failed to check migration table: {e}")
            return False

    def is_migration_executed(self, migration_name: str) -> bool:
        """Check if a migration has been executed."""
        if not self.connection:
            return False

        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                SELECT COUNT(*) FROM archon_migrations
                WHERE migration_name = %s AND status = 'completed'
            """, (migration_name,))
            count = cursor.fetchone()[0]
            cursor.close()
            return count > 0

        except Exception:
            return False

    def record_migration(
        self,
        migration_name: str,
        execution_time_ms: int,
        checksum: str,
        status: str,
        error_message: Optional[str] = None
    ):
        """Record migration execution."""
        if not self.connection:
            return

        try:
            cursor = self.connection.cursor()
            cursor.execute("""
                INSERT INTO archon_migrations
                (migration_name, execution_time_ms, checksum, status, error_message)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (migration_name)
                DO UPDATE SET
                    executed_at = CURRENT_TIMESTAMP,
                    execution_time_ms = EXCLUDED.execution_time_ms,
                    checksum = EXCLUDED.checksum,
                    status = EXCLUDED.status,
                    error_message = EXCLUDED.error_message
            """, (migration_name, execution_time_ms, checksum, status, error_message))
            self.connection.commit()
            cursor.close()

        except Exception as e:
            logger.error(f"Failed to record migration: {e}")
            self.connection.rollback()

    def calculate_checksum(self, file_path: Path) -> str:
        """Calculate SHA256 checksum of a file."""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def run_all_migrations(self) -> Tuple[int, int, int]:
        """
        Run all pending migrations.

        Returns:
            Tuple of (executed, skipped, failed)
        """
        if not self.connect():
            logger.warning("Cannot connect to database for migrations")
            return 0, 0, 0

        try:
            # Ensure migration table exists
            if not self.check_migration_table_exists():
                logger.info("Creating migration tracking table...")
                migration_system = self.migrations_dir / "00_migration_system.sql"
                if migration_system.exists():
                    success, error = self.execute_migration_file(migration_system)
                    if not success:
                        logger.error(f"Failed to create migration table: {error}")
                        return 0, 0, 1

            # Get all migration files
            migration_files = sorted(
                [f for f in self.migrations_dir.glob("*.sql")
                 if not any(skip in f.name.lower() for skip in ["validate", "test", "rollback"])],
                key=lambda x: x.name
            )

            executed = 0
            skipped = 0
            failed = 0

            for migration_file in migration_files:
                migration_name = migration_file.name

                # Skip if already executed
                if self.is_migration_executed(migration_name):
                    logger.debug(f"Already executed: {migration_name}")
                    skipped += 1
                    continue

                # Execute migration
                logger.info(f"Executing migration: {migration_name}")
                checksum = self.calculate_checksum(migration_file)
                start_time = time.time()

                success, error = self.execute_migration_file(migration_file)
                execution_time_ms = int((time.time() - start_time) * 1000)

                if success:
                    self.record_migration(
                        migration_name,
                        execution_time_ms,
                        checksum,
                        "completed"
                    )
                    logger.info(f"✅ Migration completed: {migration_name} ({execution_time_ms}ms)")
                    executed += 1
                else:
                    self.record_migration(
                        migration_name,
                        execution_time_ms,
                        checksum,
                        "failed",
                        error
                    )
                    logger.error(f"❌ Migration failed: {migration_name}")
                    logger.error(f"   Error: {error}")
                    failed += 1
                    break  # Stop on first failure

            return executed, skipped, failed

        finally:
            self.disconnect()


def run_direct_migrations() -> Tuple[int, int, int]:
    """
    Run migrations using direct database connection.

    Returns:
        Tuple of (executed, skipped, failed)
    """
    executor = DirectMigrationExecutor()
    return executor.run_all_migrations()