-- =====================================================
-- Archon BMAD Integration - Database Schema
-- =====================================================
-- Extension du schéma Archon pour supporter la hiérarchie BMAD
-- EPIC → STORY → TASK → SUBTASK
-- =====================================================

-- =====================================================
-- SECTION 1: NOUVELLES TABLES HIÉRARCHIQUES
-- =====================================================

-- Table des EPICs (niveau 1 de la hiérarchie)
CREATE TABLE IF NOT EXISTS archon_epics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES archon_projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status epic_status DEFAULT 'todo',
    priority INTEGER DEFAULT 0,
    mvp_flag BOOLEAN DEFAULT false,
    progress_percentage INTEGER DEFAULT 0,
    estimated_hours INTEGER,
    actual_hours INTEGER,
    due_date TIMESTAMPTZ,
    assigned_to TEXT DEFAULT 'User',
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des STORIES (niveau 2 de la hiérarchie)
CREATE TABLE IF NOT EXISTS archon_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    epic_id UUID REFERENCES archon_epics(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status story_status DEFAULT 'todo',
    priority INTEGER DEFAULT 0,
    mvp_flag BOOLEAN DEFAULT false,
    progress_percentage INTEGER DEFAULT 0,
    estimated_hours INTEGER,
    actual_hours INTEGER,
    due_date TIMESTAMPTZ,
    assigned_to TEXT DEFAULT 'User',
    acceptance_criteria JSONB DEFAULT '[]'::jsonb,
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des SUBTASKS (niveau 4 de la hiérarchie)
CREATE TABLE IF NOT EXISTS archon_subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES archon_tasks(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status subtask_status DEFAULT 'todo',
    priority INTEGER DEFAULT 0,
    progress_percentage INTEGER DEFAULT 0,
    estimated_hours INTEGER,
    actual_hours INTEGER,
    due_date TIMESTAMPTZ,
    assigned_to TEXT DEFAULT 'User',
    created_by TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- SECTION 2: TYPES ENUMÉRÉS POUR LES ÉTATS
-- =====================================================

-- Type pour les états des EPICs
CREATE TYPE epic_status AS ENUM (
    'todo',
    'doing', 
    'review',
    'waiting_validation',
    'done'
);

-- Type pour les états des STORIES
CREATE TYPE story_status AS ENUM (
    'todo',
    'doing',
    'review', 
    'waiting_validation',
    'done'
);

-- Type pour les états des SUBTASKS
CREATE TYPE subtask_status AS ENUM (
    'todo',
    'doing',
    'review',
    'waiting_validation', 
    'done'
);

-- =====================================================
-- SECTION 3: MODIFICATION DE LA TABLE TASKS EXISTANTE
-- =====================================================

-- Ajouter la référence vers story_id dans archon_tasks
ALTER TABLE archon_tasks 
ADD COLUMN IF NOT EXISTS story_id UUID REFERENCES archon_stories(id) ON DELETE CASCADE;

-- Ajouter les champs BMAD pour les tâches
ALTER TABLE archon_tasks 
ADD COLUMN IF NOT EXISTS mvp_flag BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS estimated_hours INTEGER,
ADD COLUMN IF NOT EXISTS actual_hours INTEGER,
ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS acceptance_criteria JSONB DEFAULT '[]'::jsonb;

-- =====================================================
-- SECTION 4: TABLE DE VALIDATION UTILISATEUR
-- =====================================================

-- Table pour gérer les validations utilisateur
CREATE TABLE IF NOT EXISTS archon_validations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id UUID NOT NULL, -- ID de l'item à valider (epic, story, task, subtask)
    item_type TEXT NOT NULL CHECK (item_type IN ('epic', 'story', 'task', 'subtask')),
    validation_status validation_status DEFAULT 'pending',
    validation_notes TEXT,
    validated_by TEXT,
    validated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Type pour les statuts de validation
CREATE TYPE validation_status AS ENUM (
    'pending',
    'approved',
    'rejected',
    'needs_revision'
);

-- =====================================================
-- SECTION 5: TABLE DE DÉPENDANCES
-- =====================================================

-- Table pour gérer les dépendances entre éléments
CREATE TABLE IF NOT EXISTS archon_dependencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dependent_item_id UUID NOT NULL,
    dependent_item_type TEXT NOT NULL CHECK (dependent_item_type IN ('epic', 'story', 'task', 'subtask')),
    dependency_item_id UUID NOT NULL,
    dependency_item_type TEXT NOT NULL CHECK (dependency_item_type IN ('epic', 'story', 'task', 'subtask')),
    dependency_type dependency_type DEFAULT 'blocks',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Type pour les types de dépendances
CREATE TYPE dependency_type AS ENUM (
    'blocks',
    'requires',
    'related_to'
);

-- =====================================================
-- SECTION 6: INDEX POUR LES PERFORMANCES
-- =====================================================

-- Index pour archon_epics
CREATE INDEX IF NOT EXISTS idx_archon_epics_project_id ON archon_epics(project_id);
CREATE INDEX IF NOT EXISTS idx_archon_epics_status ON archon_epics(status);
CREATE INDEX IF NOT EXISTS idx_archon_epics_priority ON archon_epics(priority);
CREATE INDEX IF NOT EXISTS idx_archon_epics_mvp_flag ON archon_epics(mvp_flag);
CREATE INDEX IF NOT EXISTS idx_archon_epics_assigned_to ON archon_epics(assigned_to);

-- Index pour archon_stories
CREATE INDEX IF NOT EXISTS idx_archon_stories_epic_id ON archon_stories(epic_id);
CREATE INDEX IF NOT EXISTS idx_archon_stories_status ON archon_stories(status);
CREATE INDEX IF NOT EXISTS idx_archon_stories_priority ON archon_stories(priority);
CREATE INDEX IF NOT EXISTS idx_archon_stories_mvp_flag ON archon_stories(mvp_flag);
CREATE INDEX IF NOT EXISTS idx_archon_stories_assigned_to ON archon_stories(assigned_to);

-- Index pour archon_subtasks
CREATE INDEX IF NOT EXISTS idx_archon_subtasks_task_id ON archon_subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_archon_subtasks_status ON archon_subtasks(status);
CREATE INDEX IF NOT EXISTS idx_archon_subtasks_priority ON archon_subtasks(priority);
CREATE INDEX IF NOT EXISTS idx_archon_subtasks_assigned_to ON archon_subtasks(assigned_to);

-- Index pour archon_tasks (nouveaux champs)
CREATE INDEX IF NOT EXISTS idx_archon_tasks_story_id ON archon_tasks(story_id);
CREATE INDEX IF NOT EXISTS idx_archon_tasks_mvp_flag ON archon_tasks(mvp_flag);
CREATE INDEX IF NOT EXISTS idx_archon_tasks_progress ON archon_tasks(progress_percentage);

-- Index pour archon_validations
CREATE INDEX IF NOT EXISTS idx_archon_validations_item_id ON archon_validations(item_id);
CREATE INDEX IF NOT EXISTS idx_archon_validations_item_type ON archon_validations(item_type);
CREATE INDEX IF NOT EXISTS idx_archon_validations_status ON archon_validations(validation_status);

-- Index pour archon_dependencies
CREATE INDEX IF NOT EXISTS idx_archon_dependencies_dependent ON archon_dependencies(dependent_item_id, dependent_item_type);
CREATE INDEX IF NOT EXISTS idx_archon_dependencies_dependency ON archon_dependencies(dependency_item_id, dependency_item_type);

-- =====================================================
-- SECTION 7: TRIGGERS POUR MISE À JOUR AUTOMATIQUE
-- =====================================================

-- Trigger pour mettre à jour updated_at sur archon_epics
CREATE OR REPLACE TRIGGER update_archon_epics_updated_at
    BEFORE UPDATE ON archon_epics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour mettre à jour updated_at sur archon_stories
CREATE OR REPLACE TRIGGER update_archon_stories_updated_at
    BEFORE UPDATE ON archon_stories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour mettre à jour updated_at sur archon_subtasks
CREATE OR REPLACE TRIGGER update_archon_subtasks_updated_at
    BEFORE UPDATE ON archon_subtasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger pour mettre à jour updated_at sur archon_validations
CREATE OR REPLACE TRIGGER update_archon_validations_updated_at
    BEFORE UPDATE ON archon_validations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SECTION 8: FONCTIONS POUR CALCUL D'AVANCEMENT
-- =====================================================

-- Fonction pour calculer l'avancement d'un EPIC basé sur ses STORIES
CREATE OR REPLACE FUNCTION calculate_epic_progress(epic_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
    total_stories INTEGER;
    completed_stories INTEGER;
    progress_percentage INTEGER;
BEGIN
    -- Compter le total des stories
    SELECT COUNT(*) INTO total_stories
    FROM archon_stories
    WHERE epic_id = epic_id_param;
    
    -- Compter les stories terminées
    SELECT COUNT(*) INTO completed_stories
    FROM archon_stories
    WHERE epic_id = epic_id_param AND status = 'done';
    
    -- Calculer le pourcentage
    IF total_stories = 0 THEN
        progress_percentage := 0;
    ELSE
        progress_percentage := (completed_stories * 100) / total_stories;
    END IF;
    
    -- Mettre à jour l'EPIC
    UPDATE archon_epics
    SET progress_percentage = progress_percentage,
        updated_at = NOW()
    WHERE id = epic_id_param;
    
    RETURN progress_percentage;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer l'avancement d'une STORY basé sur ses TASKS
CREATE OR REPLACE FUNCTION calculate_story_progress(story_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
    total_tasks INTEGER;
    completed_tasks INTEGER;
    progress_percentage INTEGER;
BEGIN
    -- Compter le total des tasks
    SELECT COUNT(*) INTO total_tasks
    FROM archon_tasks
    WHERE story_id = story_id_param;
    
    -- Compter les tasks terminées
    SELECT COUNT(*) INTO completed_tasks
    FROM archon_tasks
    WHERE story_id = story_id_param AND status = 'done';
    
    -- Calculer le pourcentage
    IF total_tasks = 0 THEN
        progress_percentage := 0;
    ELSE
        progress_percentage := (completed_tasks * 100) / total_tasks;
    END IF;
    
    -- Mettre à jour la STORY
    UPDATE archon_stories
    SET progress_percentage = progress_percentage,
        updated_at = NOW()
    WHERE id = story_id_param;
    
    RETURN progress_percentage;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour calculer l'avancement d'une TASK basé sur ses SUBTASKS
CREATE OR REPLACE FUNCTION calculate_task_progress(task_id_param UUID)
RETURNS INTEGER AS $$
DECLARE
    total_subtasks INTEGER;
    completed_subtasks INTEGER;
    progress_percentage INTEGER;
BEGIN
    -- Compter le total des subtasks
    SELECT COUNT(*) INTO total_subtasks
    FROM archon_subtasks
    WHERE task_id = task_id_param;
    
    -- Compter les subtasks terminées
    SELECT COUNT(*) INTO completed_subtasks
    FROM archon_subtasks
    WHERE task_id = task_id_param AND status = 'done';
    
    -- Calculer le pourcentage
    IF total_subtasks = 0 THEN
        progress_percentage := 0;
    ELSE
        progress_percentage := (completed_subtasks * 100) / total_subtasks;
    END IF;
    
    -- Mettre à jour la TASK
    UPDATE archon_tasks
    SET progress_percentage = progress_percentage,
        updated_at = NOW()
    WHERE id = task_id_param;
    
    RETURN progress_percentage;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SECTION 9: TRIGGERS POUR CALCUL AUTOMATIQUE
-- =====================================================

-- Trigger pour recalculer l'avancement de l'EPIC quand une STORY change
CREATE OR REPLACE FUNCTION trigger_epic_progress_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Si c'est une insertion ou mise à jour
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM calculate_epic_progress(NEW.epic_id);
    END IF;
    
    -- Si c'est une suppression
    IF TG_OP = 'DELETE' THEN
        PERFORM calculate_epic_progress(OLD.epic_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_epic_progress_calculation
    AFTER INSERT OR UPDATE OR DELETE ON archon_stories
    FOR EACH ROW EXECUTE FUNCTION trigger_epic_progress_update();

-- Trigger pour recalculer l'avancement de la STORY quand une TASK change
CREATE OR REPLACE FUNCTION trigger_story_progress_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Si c'est une insertion ou mise à jour
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM calculate_story_progress(NEW.story_id);
    END IF;
    
    -- Si c'est une suppression
    IF TG_OP = 'DELETE' THEN
        PERFORM calculate_story_progress(OLD.story_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_story_progress_calculation
    AFTER INSERT OR UPDATE OR DELETE ON archon_tasks
    FOR EACH ROW EXECUTE FUNCTION trigger_story_progress_update();

-- Trigger pour recalculer l'avancement de la TASK quand une SUBTASK change
CREATE OR REPLACE FUNCTION trigger_task_progress_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Si c'est une insertion ou mise à jour
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        PERFORM calculate_task_progress(NEW.task_id);
    END IF;
    
    -- Si c'est une suppression
    IF TG_OP = 'DELETE' THEN
        PERFORM calculate_task_progress(OLD.task_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_task_progress_calculation
    AFTER INSERT OR UPDATE OR DELETE ON archon_subtasks
    FOR EACH ROW EXECUTE FUNCTION trigger_task_progress_update();

-- =====================================================
-- SECTION 10: POLITIQUES RLS (Row Level Security)
-- =====================================================

-- Activer RLS sur les nouvelles tables
ALTER TABLE archon_epics ENABLE ROW LEVEL SECURITY;
ALTER TABLE archon_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE archon_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE archon_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE archon_dependencies ENABLE ROW LEVEL SECURITY;

-- Politiques pour archon_epics
CREATE POLICY "Allow service role full access" ON archon_epics
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read and update" ON archon_epics
    FOR ALL TO authenticated USING (true);

-- Politiques pour archon_stories
CREATE POLICY "Allow service role full access" ON archon_stories
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read and update" ON archon_stories
    FOR ALL TO authenticated USING (true);

-- Politiques pour archon_subtasks
CREATE POLICY "Allow service role full access" ON archon_subtasks
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read and update" ON archon_subtasks
    FOR ALL TO authenticated USING (true);

-- Politiques pour archon_validations
CREATE POLICY "Allow service role full access" ON archon_validations
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read and update" ON archon_validations
    FOR ALL TO authenticated USING (true);

-- Politiques pour archon_dependencies
CREATE POLICY "Allow service role full access" ON archon_dependencies
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow authenticated users to read and update" ON archon_dependencies
    FOR ALL TO authenticated USING (true);

-- =====================================================
-- SECTION 11: COMMENTAIRES ET DOCUMENTATION
-- =====================================================

COMMENT ON TABLE archon_epics IS 'EPICs - Niveau 1 de la hiérarchie BMAD. Regroupent les STORIES par objectif métier majeur.';
COMMENT ON TABLE archon_stories IS 'STORIES - Niveau 2 de la hiérarchie BMAD. Fonctionnalités utilisateur regroupées par EPIC.';
COMMENT ON TABLE archon_subtasks IS 'SUBTASKS - Niveau 4 de la hiérarchie BMAD. Découpage fin des TASKS complexes.';
COMMENT ON TABLE archon_validations IS 'Validations utilisateur obligatoires pour chaque niveau de la hiérarchie.';
COMMENT ON TABLE archon_dependencies IS 'Dépendances entre éléments de la hiérarchie BMAD.';

COMMENT ON COLUMN archon_epics.mvp_flag IS 'Indique si cet EPIC fait partie du MVP (Minimum Viable Product).';
COMMENT ON COLUMN archon_stories.mvp_flag IS 'Indique si cette STORY fait partie du MVP.';
COMMENT ON COLUMN archon_tasks.mvp_flag IS 'Indique si cette TASK fait partie du MVP.';

COMMENT ON COLUMN archon_epics.progress_percentage IS 'Pourcentage d''avancement calculé automatiquement basé sur les STORIES.';
COMMENT ON COLUMN archon_stories.progress_percentage IS 'Pourcentage d''avancement calculé automatiquement basé sur les TASKS.';
COMMENT ON COLUMN archon_tasks.progress_percentage IS 'Pourcentage d''avancement calculé automatiquement basé sur les SUBTASKS.';

-- =====================================================
-- FIN DU SCHÉMA
-- =====================================================

