# WAITING STATUS FIX - Complete Solution

## 🔍 Problem Identified

The "En attente" (waiting) status causes HTTP 500 errors when saving tasks due to a **schema mismatch** between frontend and database:

- **Frontend Schema**: `["todo", "doing", "review", "waiting", "done"]`
- **Backend Validation**: `["todo", "doing", "review", "waiting", "done"]` ✅ (allows "waiting")
- **Database ENUM**: `["brainstorming", "todo", "doing", "review", "done"]` ❌ (missing "waiting")

**Error**: `invalid input value for enum task_status: "waiting"` (PostgreSQL Code: 22P02)

## 🎯 Root Cause

The TRAXIS migration created a `task_status` enum with "brainstorming" but the frontend uses "waiting" instead. The backend validation was updated to match the frontend but the database enum was never updated.

## 💡 Solution Options

### Option 1: Quick Fix (Temporary) - Remove "waiting" from Frontend

Temporarily replace "waiting" with an existing status until database can be updated:

```typescript
// In: archon-ui-main/src/features/projects/tasks/schemas/index.ts
// Change line 4 from:
export const DatabaseTaskStatusSchema = z.enum(["todo", "doing", "review", "waiting", "done"]);

// To:
export const DatabaseTaskStatusSchema = z.enum(["todo", "doing", "review", "done"]);
```

This removes the "En attente" option from dropdowns but prevents crashes.

### Option 2: Permanent Fix - Add "waiting" to Database

Execute this SQL command in your Supabase SQL Editor:

```sql
ALTER TYPE task_status ADD VALUE 'waiting' AFTER 'review';
```

## 🔧 Complete Permanent Fix

### Step 1: Database Migration

1. Open **Supabase SQL Editor**
2. Execute this SQL:

```sql
-- Add 'waiting' to the task_status enum
ALTER TYPE task_status ADD VALUE 'waiting' AFTER 'review';

-- Verify the change
SELECT enumlabel
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'task_status')
ORDER BY enumsortorder;
```

Expected result: `["brainstorming", "todo", "doing", "review", "waiting", "done"]`

### Step 2: Verify the Fix

1. **Test the API directly**:
```bash
curl -X PUT http://localhost:8181/api/tasks/f4c2f45e-bc25-4959-95ee-08496a09112c \
  -H "Content-Type: application/json" \
  -d '{"status": "waiting"}'
```

Should return success instead of HTTP 500.

2. **Test in UI**:
   - Open TreeView
   - Edit a task
   - Change status to "En attente" (waiting)
   - Save - should work without errors

## 📋 Files Affected

- **Frontend Schema**: `archon-ui-main/src/features/projects/tasks/schemas/index.ts:4`
- **Backend Validation**: `python/src/server/services/projects/task_service.py:38`
- **Database**: `task_status` enum in PostgreSQL
- **UI Components**: 32 files use "waiting" status

## 🎉 Expected Outcome

After applying the database migration:

- ✅ "En attente" (waiting) status works without HTTP 500 errors
- ✅ TreeView task editing completes successfully
- ✅ All existing functionality preserved
- ✅ No frontend changes needed

## 🔍 Testing Checklist

- [ ] Database migration executed successfully
- [ ] API test with "waiting" status returns 200 OK
- [ ] UI dropdown shows "En attente" option
- [ ] Task save with "waiting" status completes without error
- [ ] TreeView updates persist correctly

## 📝 Migration Record

The migration is documented in:
- `/home/jmtrappier/Archon/traxis/migration/ADD_WAITING_STATUS.sql`

## 🚨 Alternative: Quick UI Fix

If database access is not available, temporarily comment out "waiting" from the frontend schema:

```typescript
export const DatabaseTaskStatusSchema = z.enum([
  "todo",
  "doing",
  "review",
  // "waiting",  // Temporarily disabled - database doesn't support this yet
  "done"
]);
```

This prevents the error but removes the "En attente" option from the UI.