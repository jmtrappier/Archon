-- =====================================================
-- NOMENCLATURE HIÉRARCHIQUE - MIGRATION CODES UNIQUES
-- =====================================================
--
-- INSTRUCTIONS POUR EXÉCUTION MANUELLE :
-- 1. Ouvrez Supabase SQL Editor
-- 2. Copiez/collez ce fichier complet
-- 3. Cliquez "Run" - Opération 100% SAFE et ADDITIVE
-- 4. Redémarrez : docker-compose restart
--
-- SYSTÈME DE NOMENCLATURE :
-- EPIC:    E-XX        (E-01, E-02, E-03...)
-- STORY:   S-XX-YY     (S-01-01, S-01-02, S-02-01...)
-- TASK:    T-XX-YY-ZZ  (T-01-01-01, T-01-01-02...)
-- SUBTASK: ST-XX-YY-ZZ-AA (ST-01-01-01-01...)
--
-- =====================================================

-- Ajouter colonnes de codes hiérarchiques
ALTER TABLE archon_epics
ADD COLUMN IF NOT EXISTS code VARCHAR(10) UNIQUE,
ADD COLUMN IF NOT EXISTS epic_order INTEGER;

ALTER TABLE archon_stories
ADD COLUMN IF NOT EXISTS code VARCHAR(15) UNIQUE,
ADD COLUMN IF NOT EXISTS story_order INTEGER;

ALTER TABLE archon_tasks
ADD COLUMN IF NOT EXISTS code VARCHAR(20) UNIQUE,
ADD COLUMN IF NOT EXISTS task_order_in_story INTEGER;

-- Indexes pour performance
CREATE INDEX IF NOT EXISTS idx_archon_epics_code ON archon_epics(code);
CREATE INDEX IF NOT EXISTS idx_archon_epics_epic_order ON archon_epics(project_id, epic_order);

CREATE INDEX IF NOT EXISTS idx_archon_stories_code ON archon_stories(code);
CREATE INDEX IF NOT EXISTS idx_archon_stories_story_order ON archon_stories(epic_id, story_order);

CREATE INDEX IF NOT EXISTS idx_archon_tasks_code ON archon_tasks(code);
CREATE INDEX IF NOT EXISTS idx_archon_tasks_task_order_story ON archon_tasks(story_id, task_order_in_story);

-- Contraintes d'unicité hiérarchiques
DO $$
BEGIN
    -- Epic order unique par projet
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_epic_order_per_project') THEN
        ALTER TABLE archon_epics ADD CONSTRAINT unique_epic_order_per_project
        UNIQUE (project_id, epic_order);
    END IF;

    -- Story order unique par epic
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_story_order_per_epic') THEN
        ALTER TABLE archon_stories ADD CONSTRAINT unique_story_order_per_epic
        UNIQUE (epic_id, story_order);
    END IF;

    -- Task order unique par story
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_task_order_per_story') THEN
        ALTER TABLE archon_tasks ADD CONSTRAINT unique_task_order_per_story
        UNIQUE (story_id, task_order_in_story);
    END IF;
END
$$;

-- Fonction pour générer le code Epic
CREATE OR REPLACE FUNCTION generate_epic_code(project_uuid UUID)
RETURNS VARCHAR(10) AS $$
DECLARE
    next_order INTEGER;
    epic_code VARCHAR(10);
BEGIN
    -- Trouver le prochain numéro d'epic dans ce projet
    SELECT COALESCE(MAX(epic_order), 0) + 1
    INTO next_order
    FROM archon_epics
    WHERE project_id = project_uuid;

    epic_code := 'E-' || LPAD(next_order::TEXT, 2, '0');

    RETURN epic_code;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour générer le code Story
CREATE OR REPLACE FUNCTION generate_story_code(epic_uuid UUID)
RETURNS VARCHAR(15) AS $$
DECLARE
    epic_order_num INTEGER;
    next_story_order INTEGER;
    story_code VARCHAR(15);
BEGIN
    -- Récupérer l'ordre de l'epic parent
    SELECT epic_order INTO epic_order_num
    FROM archon_epics
    WHERE id = epic_uuid;

    -- Trouver le prochain numéro de story dans cet epic
    SELECT COALESCE(MAX(story_order), 0) + 1
    INTO next_story_order
    FROM archon_stories
    WHERE epic_id = epic_uuid;

    story_code := 'S-' || LPAD(epic_order_num::TEXT, 2, '0') || '-' || LPAD(next_story_order::TEXT, 2, '0');

    RETURN story_code;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour générer le code Task
CREATE OR REPLACE FUNCTION generate_task_code(story_uuid UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
    epic_order_num INTEGER;
    story_order_num INTEGER;
    next_task_order INTEGER;
    task_code VARCHAR(20);
BEGIN
    -- Récupérer les ordres epic et story parents
    SELECT e.epic_order, s.story_order
    INTO epic_order_num, story_order_num
    FROM archon_stories s
    JOIN archon_epics e ON s.epic_id = e.id
    WHERE s.id = story_uuid;

    -- Trouver le prochain numéro de task dans cette story
    SELECT COALESCE(MAX(task_order_in_story), 0) + 1
    INTO next_task_order
    FROM archon_tasks
    WHERE story_id = story_uuid;

    task_code := 'T-' ||
                LPAD(epic_order_num::TEXT, 2, '0') || '-' ||
                LPAD(story_order_num::TEXT, 2, '0') || '-' ||
                LPAD(next_task_order::TEXT, 2, '0');

    RETURN task_code;
END;
$$ LANGUAGE plpgsql;

-- Triggers pour auto-génération des codes
CREATE OR REPLACE FUNCTION trigger_generate_epic_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.code IS NULL THEN
        NEW.epic_order := (SELECT COALESCE(MAX(epic_order), 0) + 1 FROM archon_epics WHERE project_id = NEW.project_id);
        NEW.code := generate_epic_code(NEW.project_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_generate_story_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.code IS NULL AND NEW.epic_id IS NOT NULL THEN
        NEW.story_order := (SELECT COALESCE(MAX(story_order), 0) + 1 FROM archon_stories WHERE epic_id = NEW.epic_id);
        NEW.code := generate_story_code(NEW.epic_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_generate_task_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.code IS NULL AND NEW.story_id IS NOT NULL THEN
        NEW.task_order_in_story := (SELECT COALESCE(MAX(task_order_in_story), 0) + 1 FROM archon_tasks WHERE story_id = NEW.story_id);
        NEW.code := generate_task_code(NEW.story_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Créer les triggers
DROP TRIGGER IF EXISTS epic_code_trigger ON archon_epics;
CREATE TRIGGER epic_code_trigger
    BEFORE INSERT ON archon_epics
    FOR EACH ROW EXECUTE FUNCTION trigger_generate_epic_code();

DROP TRIGGER IF EXISTS story_code_trigger ON archon_stories;
CREATE TRIGGER story_code_trigger
    BEFORE INSERT ON archon_stories
    FOR EACH ROW EXECUTE FUNCTION trigger_generate_story_code();

DROP TRIGGER IF EXISTS task_code_trigger ON archon_tasks;
CREATE TRIGGER task_code_trigger
    BEFORE INSERT ON archon_tasks
    FOR EACH ROW EXECUTE FUNCTION trigger_generate_task_code();

-- Vue étendue avec codes hiérarchiques
CREATE OR REPLACE VIEW archon_hierarchy_with_codes AS
SELECT
    p.id as project_id,
    p.title as project_title,
    e.id as epic_id,
    e.code as epic_code,
    e.title as epic_title,
    e.epic_order,
    s.id as story_id,
    s.code as story_code,
    s.title as story_title,
    s.story_order,
    t.id as task_id,
    t.code as task_code,
    t.title as task_title,
    t.task_order_in_story,
    t.status as task_status
FROM archon_projects p
LEFT JOIN archon_epics e ON p.id = e.project_id
LEFT JOIN archon_stories s ON e.id = s.epic_id
LEFT JOIN archon_tasks t ON s.id = t.story_id
ORDER BY p.title, e.epic_order, s.story_order, t.task_order_in_story;

-- Enregistrer cette migration
INSERT INTO archon_migrations (migration_name, execution_time_ms, checksum, status)
VALUES ('UNIQUE_CODES_MIGRATION.sql', 0, 'manual_codes_execution', 'completed')
ON CONFLICT (migration_name) DO NOTHING;

-- =====================================================
-- MIGRATION CODES HIÉRARCHIQUES TERMINÉE ✅
-- =====================================================
--
-- NOUVEAUX CHAMPS AJOUTÉS :
-- ✅ archon_epics: code, epic_order
-- ✅ archon_stories: code, story_order
-- ✅ archon_tasks: code, task_order_in_story
-- ✅ Contraintes d'unicité hiérarchiques
-- ✅ Triggers auto-génération des codes
-- ✅ Fonctions utilitaires
-- ✅ Vue archon_hierarchy_with_codes
--
-- EXEMPLES D'USAGE :
-- INSERT INTO archon_epics (project_id, title) VALUES (...); -- Auto: E-01
-- INSERT INTO archon_stories (epic_id, title) VALUES (...);  -- Auto: S-01-01
-- INSERT INTO archon_tasks (story_id, title) VALUES (...);   -- Auto: T-01-01-01
--
-- PROCHAINES ÉTAPES :
-- 1. Redémarrer : docker-compose restart
-- 2. Mettre à jour les services backend
-- 3. Plus jamais de doublons STORY 1.1 ! 🎉
--
-- =====================================================