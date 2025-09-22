#!/usr/bin/env python3
"""
Script to fix the waiting status issue by adding "waiting" to the task_status enum.
This resolves the HTTP 500 error when saving tasks with "waiting" status.
"""

import asyncio
import asyncpg
import os

async def fix_waiting_status():
    """Add 'waiting' to the task_status enum in the database"""

    # Database connection details
    DATABASE_URL = "postgresql://postgres:your-super-secret-and-long-postgres-password@localhost:5432/postgres"

    try:
        # Connect to the database
        conn = await asyncpg.connect(DATABASE_URL)
        print("✅ Connected to database")

        # Check current enum values
        current_values = await conn.fetch("""
            SELECT enumlabel
            FROM pg_enum
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'task_status')
            ORDER BY enumsortorder
        """)

        current_labels = [row['enumlabel'] for row in current_values]
        print(f"📋 Current task_status enum values: {current_labels}")

        # Check if 'waiting' already exists
        if 'waiting' in current_labels:
            print("ℹ️ Status 'waiting' already exists in the enum")
        else:
            print("🔧 Adding 'waiting' status to task_status enum...")

            # Add 'waiting' to the enum after 'review'
            await conn.execute("ALTER TYPE task_status ADD VALUE 'waiting' AFTER 'review'")
            print("✅ Successfully added 'waiting' status to task_status enum")

            # Verify the addition
            updated_values = await conn.fetch("""
                SELECT enumlabel
                FROM pg_enum
                WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'task_status')
                ORDER BY enumsortorder
            """)

            updated_labels = [row['enumlabel'] for row in updated_values]
            print(f"📋 Updated task_status enum values: {updated_labels}")

        # Record the migration
        await conn.execute("""
            INSERT INTO archon_migrations (migration_name, execution_time_ms, checksum, status)
            VALUES ('ADD_WAITING_STATUS.sql', 0, 'add_waiting_status_script_execution', 'completed')
            ON CONFLICT (migration_name) DO NOTHING
        """)
        print("📝 Migration recorded in archon_migrations table")

        await conn.close()
        print("✅ Database connection closed")
        print("\n🎉 WAITING STATUS FIX COMPLETED!")
        print("   You can now use 'En attente' (waiting) status without HTTP 500 errors")

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    return True

if __name__ == "__main__":
    asyncio.run(fix_waiting_status())