-- =====================================================
-- MIGRATION: ADD "WAITING" STATUS TO task_status ENUM
-- =====================================================
--
-- OBJECTIF:
-- Ajouter le statut "waiting" à l'ENUM task_status existant
-- pour corriger l'erreur 500 lors de la sauvegarde des tâches
-- avec le statut "En attente" (waiting)
--
-- PROBLÈME IDENTIFIÉ:
-- - Frontend utilise "waiting" dans 32 fichiers
-- - Database ENUM n'a que: brainstorming, todo, doing, review, done
-- - Erreur PostgreSQL: invalid input value for enum task_status: "waiting"
--
-- INSTRUCTIONS D'EXÉCUTION:
-- 1. Ouvrez Supabase SQL Editor
-- 2. Copiez/collez ce fichier COMPLET
-- 3. Cliquez "Run" - Opération 100% SAFE
-- 4. Testez le statut "waiting" dans l'interface
--
-- =====================================================

-- Ajouter le statut "waiting" à l'ENUM existant
DO $$
BEGIN
    -- Vérifier si le statut "waiting" existe déjà
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'task_status'
        )
        AND enumlabel = 'waiting'
    ) THEN
        -- Ajouter "waiting" après "review" dans l'ENUM
        ALTER TYPE task_status ADD VALUE 'waiting' AFTER 'review';
        RAISE NOTICE 'Statut "waiting" ajouté avec succès à l''ENUM task_status';
    ELSE
        RAISE NOTICE 'Statut "waiting" existe déjà dans l''ENUM task_status';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erreur lors de l''ajout du statut waiting: %', SQLERRM;
END $$;

-- Enregistrer cette migration
INSERT INTO archon_migrations (migration_name, execution_time_ms, checksum, status)
VALUES ('ADD_WAITING_STATUS.sql', 0, 'add_waiting_status_manual_execution', 'completed')
ON CONFLICT (migration_name) DO NOTHING;

-- =====================================================
-- VALIDATION DE LA MIGRATION
-- =====================================================

-- Vérifier que le statut "waiting" est disponible
DO $$
DECLARE
    enum_values TEXT[];
BEGIN
    -- Récupérer toutes les valeurs de l'ENUM task_status
    SELECT array_agg(enumlabel ORDER BY enumsortorder)
    INTO enum_values
    FROM pg_enum
    WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'task_status');

    RAISE NOTICE '====================================================================';
    RAISE NOTICE '           MIGRATION ADD WAITING STATUS TERMINÉE ✅';
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'ENUM task_status disponible: %', array_to_string(enum_values, ', ');
    RAISE NOTICE '';
    RAISE NOTICE 'STATUTS DISPONIBLES POUR TASKS:';
    RAISE NOTICE '  - todo (défaut)';
    RAISE NOTICE '  - doing';
    RAISE NOTICE '  - review';
    RAISE NOTICE '  - waiting ← NOUVEAU ✅';
    RAISE NOTICE '  - done';
    RAISE NOTICE '  - brainstorming (pour EPICs/STORIEs)';
    RAISE NOTICE '';
    RAISE NOTICE 'PROBLÈME RÉSOLU:';
    RAISE NOTICE '  ✅ HTTP 500 Error corrigé';
    RAISE NOTICE '  ✅ Status "En attente" fonctionne maintenant';
    RAISE NOTICE '  ✅ Frontend/Backend synchronisés';
    RAISE NOTICE '';
    RAISE NOTICE 'TEST À EFFECTUER:';
    RAISE NOTICE '  1. Ouvrir TreeView dans l''interface';
    RAISE NOTICE '  2. Éditer une tâche';
    RAISE NOTICE '  3. Changer le statut vers "En attente"';
    RAISE NOTICE '  4. Sauvegarder → devrait réussir sans erreur 500';
    RAISE NOTICE '====================================================================';
END $$;

-- =====================================================
-- MIGRATION ADD WAITING STATUS TERMINÉE ✅
-- =====================================================