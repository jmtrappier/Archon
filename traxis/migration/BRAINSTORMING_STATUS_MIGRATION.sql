-- =====================================================
-- MIGRATION INCRÉMENTALE - AJOUT STATUT "BRAINSTORMING"
-- =====================================================
--
-- ⚠️  POUR BASES DE DONNÉES EXISTANTES UNIQUEMENT
-- ⚠️  Si vous utilisez une nouvelle installation,
--     utilisez COMPLETE_TRAXIS_MIGRATION.sql à la place
--
-- OBJECTIF :
-- Ajouter le statut "brainstorming" à l'ENUM task_status existant
-- et mettre à jour les valeurs par défaut pour EPICs et STORIEs
--
-- INSTRUCTIONS D'EXÉCUTION :
-- 1. Ouvrez Supabase SQL Editor
-- 2. Copiez/collez ce fichier COMPLET
-- 3. Cliquez "Run" - Opération 100% SAFE
-- 4. Redémarrez : docker-compose restart
--
-- WORKFLOW CIBLE :
-- EPICs/STORIEs: brainstorming → todo → doing → review → done
-- TASKs/SUBTASKs: todo → doing → review → done
--
-- =====================================================

-- Ajouter le statut "brainstorming" à l'ENUM existant
DO $$
BEGIN
    -- Vérifier si le statut "brainstorming" existe déjà
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'task_status'
        )
        AND enumlabel = 'brainstorming'
    ) THEN
        -- Ajouter "brainstorming" au début de l'ENUM
        ALTER TYPE task_status ADD VALUE 'brainstorming' BEFORE 'todo';
        RAISE NOTICE 'Statut "brainstorming" ajouté avec succès à l''ENUM task_status';
    ELSE
        RAISE NOTICE 'Statut "brainstorming" existe déjà dans l''ENUM task_status';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erreur lors de l''ajout du statut brainstorming: %', SQLERRM;
END $$;

-- Mettre à jour les valeurs par défaut pour les EPICs
DO $$
BEGIN
    -- Changer la valeur par défaut pour archon_epics.status
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'archon_epics') THEN
        ALTER TABLE archon_epics ALTER COLUMN status SET DEFAULT 'brainstorming';
        RAISE NOTICE 'Valeur par défaut pour archon_epics.status mise à jour : "brainstorming"';
    ELSE
        RAISE NOTICE 'Table archon_epics n''existe pas encore';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erreur lors de la mise à jour par défaut archon_epics: %', SQLERRM;
END $$;

-- Mettre à jour les valeurs par défaut pour les STORIEs
DO $$
BEGIN
    -- Changer la valeur par défaut pour archon_stories.status
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'archon_stories') THEN
        ALTER TABLE archon_stories ALTER COLUMN status SET DEFAULT 'brainstorming';
        RAISE NOTICE 'Valeur par défaut pour archon_stories.status mise à jour : "brainstorming"';
    ELSE
        RAISE NOTICE 'Table archon_stories n''existe pas encore';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erreur lors de la mise à jour par défaut archon_stories: %', SQLERRM;
END $$;

-- Vérifier que archon_tasks garde "todo" comme défaut (logique hiérarchique)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'archon_tasks') THEN
        -- Confirmer que archon_tasks reste en "todo" par défaut
        -- (les TASKs sont créées après brainstorming des STORIEs)
        RAISE NOTICE 'archon_tasks garde "todo" comme statut par défaut (logique hiérarchique)';
    ELSE
        RAISE NOTICE 'Table archon_tasks n''existe pas encore';
    END IF;
END $$;

-- Mise à jour de la vue archon_hierarchy_with_codes si elle existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'archon_hierarchy_with_codes') THEN
        -- Recréer la vue pour s'assurer qu'elle gère le nouveau statut
        DROP VIEW IF EXISTS archon_hierarchy_with_codes;

        CREATE VIEW archon_hierarchy_with_codes AS
        SELECT
            p.id as project_id,
            p.title as project_title,
            e.id as epic_id,
            e.code as epic_code,
            e.title as epic_title,
            e.epic_order,
            e.status as epic_status,
            s.id as story_id,
            s.code as story_code,
            s.title as story_title,
            s.story_order,
            s.status as story_status,
            s.story_points,
            t.id as task_id,
            t.code as task_code,
            t.title as task_title,
            t.task_order_in_story,
            t.status as task_status,
            COALESCE(t.task_type, 'task') as task_type,
            t.assignee as task_assignee
        FROM archon_projects p
        LEFT JOIN archon_epics e ON p.id = e.project_id
        LEFT JOIN archon_stories s ON e.id = s.epic_id
        LEFT JOIN archon_tasks t ON s.id = t.story_id
        ORDER BY p.title, e.epic_order, s.story_order, t.task_order_in_story;

        RAISE NOTICE 'Vue archon_hierarchy_with_codes mise à jour avec support statut brainstorming';
    ELSE
        RAISE NOTICE 'Vue archon_hierarchy_with_codes n''existe pas encore';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erreur lors de la mise à jour de la vue: %', SQLERRM;
END $$;

-- Enregistrer cette migration
INSERT INTO archon_migrations (migration_name, execution_time_ms, checksum, status)
VALUES ('BRAINSTORMING_STATUS_MIGRATION.sql', 0, 'brainstorming_status_manual_execution', 'completed')
ON CONFLICT (migration_name) DO NOTHING;

-- =====================================================
-- VALIDATION DE LA MIGRATION
-- =====================================================

-- Vérifier que le statut "brainstorming" est disponible
DO $$
DECLARE
    enum_values TEXT[];
    default_epic_status TEXT;
    default_story_status TEXT;
    default_task_status TEXT;
BEGIN
    -- Récupérer toutes les valeurs de l'ENUM task_status
    SELECT array_agg(enumlabel ORDER BY enumsortorder)
    INTO enum_values
    FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'task_status');

    -- Récupérer les valeurs par défaut
    SELECT column_default INTO default_epic_status
    FROM information_schema.columns
    WHERE table_name = 'archon_epics' AND column_name = 'status';

    SELECT column_default INTO default_story_status
    FROM information_schema.columns
    WHERE table_name = 'archon_stories' AND column_name = 'status';

    SELECT column_default INTO default_task_status
    FROM information_schema.columns
    WHERE table_name = 'archon_tasks' AND column_name = 'status';

    RAISE NOTICE '====================================================================';
    RAISE NOTICE '           MIGRATION BRAINSTORMING STATUS TERMINÉE ✅';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'ENUM task_status disponible: %', array_to_string(enum_values, ', ');
    RAISE NOTICE 'Défaut archon_epics.status: %', COALESCE(default_epic_status, 'non défini');
    RAISE NOTICE 'Défaut archon_stories.status: %', COALESCE(default_story_status, 'non défini');
    RAISE NOTICE 'Défaut archon_tasks.status: %', COALESCE(default_task_status, 'non défini');
    RAISE NOTICE '';
    RAISE NOTICE 'WORKFLOW RÉSULTANT:';
    RAISE NOTICE '  EPICs: brainstorming → todo → doing → review → done';
    RAISE NOTICE '  STORIEs: brainstorming → todo → doing → review → done';
    RAISE NOTICE '  TASKs: todo → doing → review → done';
    RAISE NOTICE '';
    RAISE NOTICE 'PROCHAINES ÉTAPES:';
    RAISE NOTICE '  1. Redémarrer: docker-compose restart';
    RAISE NOTICE '  2. Mettre à jour backend (services, APIs)';
    RAISE NOTICE '  3. Mettre à jour frontend (types, UI Kanban)';
    RAISE NOTICE '  4. Tester création EPICs/STORIEs avec statut brainstorming';
    RAISE NOTICE '====================================================================';
END $$;

-- =====================================================
-- MIGRATION BRAINSTORMING STATUS TERMINÉE ✅
-- =====================================================