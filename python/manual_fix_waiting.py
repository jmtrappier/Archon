#!/usr/bin/env python3
"""
Manual fix for the waiting status issue.
This script adds 'waiting' to the task_status enum to resolve HTTP 500 errors.
"""

import os
import sys
import asyncio

# Try to use the Supabase URL from environment or fallback
DATABASE_URL = "postgresql://postgres.twrkvavjgqbfufphigpk:your-super-secret-and-long-postgres-password@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"

async def fix_waiting_status():
    """Add 'waiting' to the task_status enum"""
    try:
        import asyncpg
    except ImportError:
        print("❌ asyncpg not available, trying with simple SQL execution via supabase-py")
        return await fix_via_supabase()

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
            await conn.close()
            return True

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

        await conn.close()
        print("✅ Database connection closed")
        print("\n🎉 WAITING STATUS FIX COMPLETED!")
        print("   You can now use 'En attente' (waiting) status without HTTP 500 errors")
        return True

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

async def fix_via_supabase():
    """Alternative approach using supabase client if asyncpg fails"""
    try:
        # This would require setting up the supabase client properly
        print("❌ Supabase approach not implemented. Please run the SQL manually:")
        print("\n   ALTER TYPE task_status ADD VALUE 'waiting' AFTER 'review';")
        print("\n   Execute this in your Supabase SQL editor.")
        return False
    except Exception as e:
        print(f"❌ Supabase error: {e}")
        return False

if __name__ == "__main__":
    success = asyncio.run(fix_waiting_status())
    if not success:
        print("\n💡 MANUAL SOLUTION:")
        print("   1. Open Supabase SQL Editor")
        print("   2. Execute: ALTER TYPE task_status ADD VALUE 'waiting' AFTER 'review';")
        print("   3. Test the 'En attente' status in the UI")
        sys.exit(1)