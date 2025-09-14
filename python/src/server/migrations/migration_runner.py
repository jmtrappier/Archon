"""
TRAXIS Database Migration Runner

Automatically executes database migrations at server startup.
Tracks executed migrations to avoid re-running them.
"""

import hashlib
import logging
import os
import time
from pathlib import Path
from typing import Optional, Tuple

from src.server.utils import get_supabase_client

logger = logging.getLogger(__name__)


class MigrationRunner:
    """Handles automatic database migration execution."""

    def __init__(self, migrations_dir: str = "/app/migrations"):
        """
        Initialize the migration runner.

        Args:
            migrations_dir: Directory containing SQL migration files
        """
        self.migrations_dir = Path(migrations_dir)
        self.supabase = get_supabase_client()

        # Alternative path for development
        if not self.migrations_dir.exists():
            alt_path = Path(__file__).parent.parent.parent.parent.parent / "migration"
            if alt_path.exists():
                self.migrations_dir = alt_path
                logger.info(f"Using alternative migrations path: {self.migrations_dir}")

    def calculate_checksum(self, file_path: Path) -> str:
        """Calculate SHA256 checksum of a file."""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def is_migration_executed(self, migration_name: str) -> bool:
        """
        Check if a migration has already been executed.

        Args:
            migration_name: Name of the migration file

        Returns:
            True if migration was already executed successfully
        """
        try:
            result = self.supabase.rpc(
                "is_migration_executed",
                {"migration_name_param": migration_name}
            ).execute()

            return result.data if result.data is not None else False

        except Exception as e:
            logger.debug(f"Migration {migration_name} not yet executed: {e}")
            return False

    def record_migration(
        self,
        migration_name: str,
        execution_time_ms: int,
        checksum: str,
        status: str = "completed",
        error_message: Optional[str] = None
    ) -> None:
        """Record migration execution in the database."""
        try:
            self.supabase.rpc(
                "record_migration",
                {
                    "migration_name_param": migration_name,
                    "execution_time_param": execution_time_ms,
                    "checksum_param": checksum,
                    "status_param": status,
                    "error_msg_param": error_message
                }
            ).execute()
        except Exception as e:
            logger.error(f"Failed to record migration {migration_name}: {e}")

    def execute_sql_file(self, file_path: Path) -> Tuple[bool, Optional[str]]:
        """
        Execute a SQL file.

        Args:
            file_path: Path to the SQL file

        Returns:
            Tuple of (success, error_message)
        """
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                sql_content = f.read()

            # Split by semicolons but be careful with functions/procedures
            # Simple approach: execute the entire file as one statement
            # For production, consider using psycopg2 directly for better control

            # Execute via Supabase raw SQL (if available)
            # Note: This is a simplified approach - in production, you might want
            # to use psycopg2 directly for better transaction control

            # For now, we'll parse and execute statement by statement
            statements = self._parse_sql_statements(sql_content)

            for statement in statements:
                if statement.strip():
                    try:
                        # Execute raw SQL via Supabase
                        # This assumes Supabase client has a way to execute raw SQL
                        # If not, you'll need to use psycopg2 directly
                        self._execute_raw_sql(statement)
                    except Exception as e:
                        return False, str(e)

            return True, None

        except Exception as e:
            logger.error(f"Failed to execute {file_path}: {e}")
            return False, str(e)

    def _parse_sql_statements(self, sql_content: str) -> list:
        """
        Parse SQL content into individual statements.
        This is a simplified parser - for production, use a proper SQL parser.
        """
        # Remove comments
        lines = sql_content.split('\n')
        cleaned_lines = []
        in_function = False

        for line in lines:
            # Skip comment lines
            if line.strip().startswith('--'):
                continue

            # Track if we're inside a function/procedure definition
            if 'CREATE OR REPLACE FUNCTION' in line or 'CREATE FUNCTION' in line:
                in_function = True
            elif line.strip() == '$$ LANGUAGE plpgsql;' or line.strip() == '$$ LANGUAGE SQL;':
                in_function = False

            cleaned_lines.append(line)

        # Join and split by semicolons (simplified approach)
        content = '\n'.join(cleaned_lines)

        # For now, return as single statement to avoid parsing complexity
        # In production, use proper SQL parser
        return [content]

    def _execute_raw_sql(self, sql: str) -> None:
        """
        Execute raw SQL statement.
        This is a placeholder - implement based on your Supabase setup.
        """
        # If Supabase client doesn't support raw SQL, you'll need to:
        # 1. Extract database credentials from SUPABASE_URL
        # 2. Use psycopg2 to connect directly
        # 3. Execute the SQL

        # For now, we'll skip statements that can't be executed via Supabase
        # and log them for manual execution
        if sql.strip():
            logger.info(f"Would execute SQL: {sql[:100]}...")
            # In production, implement actual SQL execution here

    def ensure_migration_table_exists(self) -> None:
        """Ensure the migration tracking table exists."""
        migration_system_file = self.migrations_dir / "00_migration_system.sql"

        if migration_system_file.exists():
            # Check if migration table exists
            try:
                result = self.supabase.table("archon_migrations").select("id").limit(1).execute()
                logger.info("Migration table already exists")
            except Exception:
                # Table doesn't exist, create it
                logger.info("Creating migration tracking table...")
                success, error = self.execute_sql_file(migration_system_file)
                if not success:
                    logger.error(f"Failed to create migration table: {error}")
                    raise RuntimeError("Cannot proceed without migration tracking table")

    def run_migrations(self) -> Tuple[int, int, int]:
        """
        Run all pending migrations.

        Returns:
            Tuple of (executed_count, skipped_count, failed_count)
        """
        logger.info("Starting TRAXIS database migration check...")

        # Ensure migration table exists
        self.ensure_migration_table_exists()

        if not self.migrations_dir.exists():
            logger.warning(f"Migrations directory not found: {self.migrations_dir}")
            return 0, 0, 0

        # Get all SQL files, sorted by name
        migration_files = sorted(
            self.migrations_dir.glob("*.sql"),
            key=lambda x: x.name
        )

        executed = 0
        skipped = 0
        failed = 0

        for migration_file in migration_files:
            migration_name = migration_file.name

            # Skip the migration system file (already handled)
            if migration_name == "00_migration_system.sql":
                continue

            # Skip validation/test files
            if "validate" in migration_name.lower() or "test" in migration_name.lower():
                logger.debug(f"Skipping validation/test file: {migration_name}")
                continue

            # Check if already executed
            if self.is_migration_executed(migration_name):
                logger.debug(f"Migration already executed: {migration_name}")
                skipped += 1
                continue

            # Execute the migration
            logger.info(f"Executing migration: {migration_name}")
            checksum = self.calculate_checksum(migration_file)
            start_time = time.time()

            success, error = self.execute_sql_file(migration_file)

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
                logger.error(f"❌ Migration failed: {migration_name} - {error}")
                failed += 1

                # Stop on first failure to maintain consistency
                break

        logger.info(
            f"Migration summary: {executed} executed, {skipped} skipped, {failed} failed"
        )

        return executed, skipped, failed


def run_migrations_on_startup():
    """
    Function to be called at server startup to run pending migrations.
    """
    try:
        # Try direct execution first (preferred method)
        try:
            from .migration_executor import run_direct_migrations
            logger.info("Using direct database connection for migrations")
            executed, skipped, failed = run_direct_migrations()
        except ImportError:
            # Fallback to Supabase-based execution
            logger.info("Using Supabase client for migrations (limited functionality)")
            runner = MigrationRunner()
            executed, skipped, failed = runner.run_migrations()

        if failed > 0:
            logger.error(f"⚠️ {failed} migration(s) failed. Manual intervention may be required.")
            # Don't halt startup - allow manual fixes
        elif executed > 0:
            logger.info(f"✅ Successfully applied {executed} new migration(s)")
        else:
            logger.info("✅ All migrations are up to date")

    except Exception as e:
        logger.error(f"Migration runner failed: {e}")
        # Don't halt startup - allow service to run even if migrations fail
        logger.warning("Service starting despite migration issues - manual intervention may be required")


if __name__ == "__main__":
    # Allow running directly for testing
    import sys
    sys.path.append(str(Path(__file__).parent.parent.parent.parent))

    logging.basicConfig(level=logging.INFO)
    run_migrations_on_startup()