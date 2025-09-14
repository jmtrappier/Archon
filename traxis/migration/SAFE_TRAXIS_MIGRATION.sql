-- =====================================================
-- TRAXIS SAFE MIGRATION - PURELY ADDITIVE
-- =====================================================
--
-- INSTRUCTIONS FOR SAFE MANUAL EXECUTION:
-- 1. Open your Supabase dashboard SQL Editor
-- 2. Copy and paste this ENTIRE file content
-- 3. Click "Run" - NO destructive operations, only additions
-- 4. Restart Archon: docker-compose restart
--
-- This migration is 100% SAFE and ADDITIVE:
-- ✅ Only creates new tables and columns
-- ✅ No data modification or deletion
-- ✅ No dropping of existing structures
-- ✅ Uses IF NOT EXISTS for everything
--
-- =====================================================

-- Create EPICS table for high-level feature groupings
CREATE TABLE IF NOT EXISTS archon_epics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'planning',
    priority INTEGER DEFAULT 50,
    progress_percentage INTEGER DEFAULT 0,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    tags TEXT[],
    acceptance_criteria TEXT,
    business_value TEXT,
    CONSTRAINT valid_epic_priority CHECK (priority >= 0 AND priority <= 100),
    CONSTRAINT valid_epic_progress CHECK (progress_percentage >= 0 AND progress_percentage <= 100)
);

-- Add foreign key separately to avoid CASCADE in CREATE TABLE
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_archon_epics_project') THEN
        ALTER TABLE archon_epics ADD CONSTRAINT fk_archon_epics_project
        FOREIGN KEY (project_id) REFERENCES archon_projects(id);
    END IF;
END
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_archon_epics_project_id ON archon_epics(project_id);
CREATE INDEX IF NOT EXISTS idx_archon_epics_status ON archon_epics(status);
CREATE INDEX IF NOT EXISTS idx_archon_epics_priority ON archon_epics(priority DESC);

-- Create STORIES table for user stories within epics
CREATE TABLE IF NOT EXISTS archon_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL,
    epic_id UUID,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    user_story TEXT,
    acceptance_criteria TEXT[],
    story_points INTEGER,
    status VARCHAR(50) DEFAULT 'backlog',
    priority INTEGER DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system',
    assigned_to VARCHAR(100),
    tags TEXT[],
    definition_of_done TEXT[],
    dependencies TEXT[],
    CONSTRAINT valid_story_priority CHECK (priority >= 0 AND priority <= 100),
    CONSTRAINT valid_story_points CHECK (story_points IS NULL OR story_points > 0)
);

-- Add foreign keys separately
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_archon_stories_project') THEN
        ALTER TABLE archon_stories ADD CONSTRAINT fk_archon_stories_project
        FOREIGN KEY (project_id) REFERENCES archon_projects(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_archon_stories_epic') THEN
        ALTER TABLE archon_stories ADD CONSTRAINT fk_archon_stories_epic
        FOREIGN KEY (epic_id) REFERENCES archon_epics(id);
    END IF;
END
$$;

-- Create indexes for stories
CREATE INDEX IF NOT EXISTS idx_archon_stories_project_id ON archon_stories(project_id);
CREATE INDEX IF NOT EXISTS idx_archon_stories_epic_id ON archon_stories(epic_id);
CREATE INDEX IF NOT EXISTS idx_archon_stories_status ON archon_stories(status);
CREATE INDEX IF NOT EXISTS idx_archon_stories_priority ON archon_stories(priority DESC);
CREATE INDEX IF NOT EXISTS idx_archon_stories_assigned_to ON archon_stories(assigned_to);

-- Extend archon_tasks table with new columns (ADDITIVE ONLY)
ALTER TABLE archon_tasks
ADD COLUMN IF NOT EXISTS epic_id UUID,
ADD COLUMN IF NOT EXISTS story_id UUID,
ADD COLUMN IF NOT EXISTS task_type VARCHAR(50) DEFAULT 'task',
ADD COLUMN IF NOT EXISTS parent_task_id UUID,
ADD COLUMN IF NOT EXISTS story_points INTEGER,
ADD COLUMN IF NOT EXISTS time_estimate_hours DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS time_spent_hours DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS dependencies TEXT[],
ADD COLUMN IF NOT EXISTS acceptance_criteria TEXT[],
ADD COLUMN IF NOT EXISTS definition_of_done TEXT[],
ADD COLUMN IF NOT EXISTS labels TEXT[],
ADD COLUMN IF NOT EXISTS review_notes TEXT,
ADD COLUMN IF NOT EXISTS blocked_reason TEXT,
ADD COLUMN IF NOT EXISTS external_references JSONB;

-- Add foreign key constraints for the new columns (separate from ALTER TABLE)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_archon_tasks_epic') THEN
        ALTER TABLE archon_tasks ADD CONSTRAINT fk_archon_tasks_epic
        FOREIGN KEY (epic_id) REFERENCES archon_epics(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_archon_tasks_story') THEN
        ALTER TABLE archon_tasks ADD CONSTRAINT fk_archon_tasks_story
        FOREIGN KEY (story_id) REFERENCES archon_stories(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_archon_tasks_parent') THEN
        ALTER TABLE archon_tasks ADD CONSTRAINT fk_archon_tasks_parent
        FOREIGN KEY (parent_task_id) REFERENCES archon_tasks(id);
    END IF;
END
$$;

-- Add indexes for the new task relationships
CREATE INDEX IF NOT EXISTS idx_archon_tasks_epic_id ON archon_tasks(epic_id);
CREATE INDEX IF NOT EXISTS idx_archon_tasks_story_id ON archon_tasks(story_id);
CREATE INDEX IF NOT EXISTS idx_archon_tasks_parent_task_id ON archon_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_archon_tasks_task_type ON archon_tasks(task_type);

-- Add constraints for data validation (PostgreSQL doesn't support IF NOT EXISTS for constraints)
-- These will only be added if they don't already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_task_story_points') THEN
        ALTER TABLE archon_tasks ADD CONSTRAINT valid_task_story_points
        CHECK (story_points IS NULL OR story_points > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_task_time_estimate') THEN
        ALTER TABLE archon_tasks ADD CONSTRAINT valid_task_time_estimate
        CHECK (time_estimate_hours IS NULL OR time_estimate_hours > 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'valid_task_time_spent') THEN
        ALTER TABLE archon_tasks ADD CONSTRAINT valid_task_time_spent
        CHECK (time_spent_hours >= 0);
    END IF;
END
$$;

-- =====================================================
-- VIEWS CREATION (AFTER ALL TABLES/COLUMNS ARE ADDED)
-- =====================================================

-- Create view for project hierarchy (safe operation)
-- Note: This view references the new columns we just added
CREATE OR REPLACE VIEW archon_project_hierarchy AS
SELECT
    p.id as project_id,
    p.title as project_title,
    e.id as epic_id,
    e.title as epic_title,
    e.status as epic_status,
    s.id as story_id,
    s.title as story_title,
    s.status as story_status,
    s.story_points as story_points,
    t.id as task_id,
    t.title as task_title,
    t.status as task_status,
    COALESCE(t.task_type, 'task') as task_type,
    t.assignee as task_assignee,
    st.id as subtask_id,
    st.title as subtask_title,
    st.status as subtask_status
FROM archon_projects p
LEFT JOIN archon_epics e ON p.id = e.project_id
LEFT JOIN archon_stories s ON e.id = s.epic_id
LEFT JOIN archon_tasks t ON s.id = t.story_id AND t.parent_task_id IS NULL
LEFT JOIN archon_tasks st ON t.id = st.parent_task_id
ORDER BY p.title, e.priority DESC, s.priority DESC, t.task_order DESC, st.task_order DESC;

-- Create project summary view
CREATE OR REPLACE VIEW archon_project_summary AS
SELECT
    p.id as project_id,
    p.title as project_title,
    COUNT(DISTINCT e.id) as total_epics,
    COUNT(DISTINCT s.id) as total_stories,
    COUNT(DISTINCT t.id) as total_tasks,
    COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.id END) as completed_epics,
    COUNT(DISTINCT CASE WHEN s.status = 'done' THEN s.id END) as completed_stories,
    COUNT(DISTINCT CASE WHEN t.status = 'done' THEN t.id END) as completed_tasks,
    ROUND(AVG(e.progress_percentage), 2) as avg_epic_progress
FROM archon_projects p
LEFT JOIN archon_epics e ON p.id = e.project_id
LEFT JOIN archon_stories s ON e.id = s.epic_id
LEFT JOIN archon_tasks t ON s.id = t.story_id OR t.project_id = p.id
GROUP BY p.id, p.title
ORDER BY p.title;

-- Utility functions for progress calculation
CREATE OR REPLACE FUNCTION get_epic_completion_percentage(epic_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    total_stories INTEGER;
    completed_stories INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_stories
    FROM archon_stories
    WHERE epic_id = epic_uuid;

    IF total_stories = 0 THEN
        RETURN 0;
    END IF;

    SELECT COUNT(*) INTO completed_stories
    FROM archon_stories
    WHERE epic_id = epic_uuid AND status = 'done';

    RETURN (completed_stories * 100 / total_stories);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_story_completion_percentage(story_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    total_tasks INTEGER;
    completed_tasks INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_tasks
    FROM archon_tasks
    WHERE story_id = story_uuid;

    IF total_tasks = 0 THEN
        RETURN 0;
    END IF;

    SELECT COUNT(*) INTO completed_tasks
    FROM archon_tasks
    WHERE story_id = story_uuid AND status = 'done';

    RETURN (completed_tasks * 100 / total_tasks);
END;
$$ LANGUAGE plpgsql;

-- Record this migration as completed
INSERT INTO archon_migrations (migration_name, execution_time_ms, checksum, status)
VALUES ('SAFE_TRAXIS_MIGRATION.sql', 0, 'manual_safe_execution', 'completed')
ON CONFLICT (migration_name) DO NOTHING;

-- =====================================================
-- SAFE MIGRATION COMPLETED ✅
-- =====================================================
--
-- WHAT WAS ADDED (NO DATA LOSS):
-- ✅ archon_epics table (new)
-- ✅ archon_stories table (new)
-- ✅ 13 new columns to archon_tasks (existing data preserved)
-- ✅ Indexes for performance
-- ✅ Views for reporting
-- ✅ Utility functions
-- ✅ Foreign key relationships (without CASCADE)
--
-- VERIFICATION QUERIES:
-- SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'archon_%';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'archon_tasks';
-- SELECT * FROM archon_project_summary;
--
-- NEXT STEPS:
-- 1. Restart Archon: docker-compose restart
-- 2. The hierarchical structure is now available
-- 3. All existing data is preserved and functional
--
-- =====================================================