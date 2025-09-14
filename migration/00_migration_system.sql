-- =====================================================
-- Système de Migration Automatique TRAXIS
-- =====================================================
-- Ce fichier doit TOUJOURS être exécuté en premier
-- Il crée la table de suivi des migrations

-- =====================================================
-- SECTION 1: TABLE DE SUIVI DES MIGRATIONS
-- =====================================================

-- Créer la table des migrations si elle n'existe pas
CREATE TABLE IF NOT EXISTS archon_migrations (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) NOT NULL UNIQUE,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INTEGER,
    checksum VARCHAR(64),
    status VARCHAR(20) DEFAULT 'completed',
    error_message TEXT,
    applied_by VARCHAR(100) DEFAULT 'system'
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_archon_migrations_name ON archon_migrations(migration_name);
CREATE INDEX IF NOT EXISTS idx_archon_migrations_status ON archon_migrations(status);

-- Commentaires pour documentation
COMMENT ON TABLE archon_migrations IS 'Table de suivi des migrations TRAXIS - NE PAS MODIFIER MANUELLEMENT';
COMMENT ON COLUMN archon_migrations.migration_name IS 'Nom du fichier de migration (ex: epic_1_1_hierarchical_tables.sql)';
COMMENT ON COLUMN archon_migrations.executed_at IS 'Date et heure d\'exécution de la migration';
COMMENT ON COLUMN archon_migrations.execution_time_ms IS 'Temps d\'exécution en millisecondes';
COMMENT ON COLUMN archon_migrations.checksum IS 'Hash SHA256 du fichier pour détecter les modifications';
COMMENT ON COLUMN archon_migrations.status IS 'completed, failed, or pending';
COMMENT ON COLUMN archon_migrations.error_message IS 'Message d\'erreur si la migration a échoué';
COMMENT ON COLUMN archon_migrations.applied_by IS 'Utilisateur ou système ayant appliqué la migration';

-- =====================================================
-- SECTION 2: FONCTION DE VÉRIFICATION
-- =====================================================

-- Fonction pour vérifier si une migration a déjà été exécutée
CREATE OR REPLACE FUNCTION is_migration_executed(migration_name_param VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM archon_migrations
        WHERE migration_name = migration_name_param
        AND status = 'completed'
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SECTION 3: FONCTION D'ENREGISTREMENT
-- =====================================================

-- Fonction pour enregistrer l'exécution d'une migration
CREATE OR REPLACE FUNCTION record_migration(
    migration_name_param VARCHAR,
    execution_time_param INTEGER DEFAULT NULL,
    checksum_param VARCHAR DEFAULT NULL,
    status_param VARCHAR DEFAULT 'completed',
    error_msg_param TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO archon_migrations (
        migration_name,
        execution_time_ms,
        checksum,
        status,
        error_message
    )
    VALUES (
        migration_name_param,
        execution_time_param,
        checksum_param,
        status_param,
        error_msg_param
    )
    ON CONFLICT (migration_name)
    DO UPDATE SET
        executed_at = CURRENT_TIMESTAMP,
        execution_time_ms = EXCLUDED.execution_time_ms,
        checksum = EXCLUDED.checksum,
        status = EXCLUDED.status,
        error_message = EXCLUDED.error_message;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SECTION 4: VUE DE STATUT DES MIGRATIONS
-- =====================================================

-- Vue pour voir facilement le statut des migrations
CREATE OR REPLACE VIEW archon_migration_status AS
SELECT
    migration_name,
    executed_at,
    status,
    execution_time_ms,
    CASE
        WHEN status = 'completed' THEN '✅'
        WHEN status = 'failed' THEN '❌'
        ELSE '⏳'
    END as status_icon,
    error_message
FROM archon_migrations
ORDER BY executed_at DESC;

-- =====================================================
-- SECTION 5: INITIALISATION
-- =====================================================

-- Enregistrer cette migration comme exécutée
SELECT record_migration(
    '00_migration_system.sql',
    1,
    'initial',
    'completed',
    NULL
);

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE '✅ Système de migration TRAXIS initialisé avec succès';
    RAISE NOTICE 'Table archon_migrations créée pour le suivi des migrations';
END $$;