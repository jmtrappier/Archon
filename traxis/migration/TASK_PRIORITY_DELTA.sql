-- =====================================================
-- TASK PRIORITY DELTA – Ajout de la colonne `priority`
-- =====================================================
-- Ce script applique uniquement la différence par rapport à l’état
-- actuellement livré : ajout d’une colonne persistante pour la priorité
-- des tâches afin de permettre la mise à jour depuis l’interface TreeView.
-- Il doit être appliqué APRÈS le script COMPLETE_TRAXIS_MIGRATION.sql.
-- =====================================================

ALTER TABLE archon_tasks
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium'
CHECK (priority IN ('critical', 'high', 'medium', 'low'));

UPDATE archon_tasks
SET priority = COALESCE(priority, 'medium')
WHERE priority IS NULL;

CREATE INDEX IF NOT EXISTS idx_archon_tasks_priority ON archon_tasks(priority);

COMMENT ON COLUMN archon_tasks.priority IS 'Task priority indicator (critical|high|medium|low) persisted for hierarchy editing.';
