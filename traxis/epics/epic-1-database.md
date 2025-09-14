# Epic 1 - Base de Données Hiérarchique

**Priorité**: MVP #1 (Fondation)
**Objectif**: Créer la structure BDD pour supporter la hiérarchie BMAD
**Durée estimée**: Une soirée

## 🎯 Vision Epic

Étendre la base de données Archon existante pour supporter la hiérarchie complète :
**PROJET → EPIC → STORY → TASK → SUBTASK**

## 📊 État Actuel

**Table existante**: `archon_tasks`
- ✅ `parent_task_id` déjà présent (ligne 32 du schéma)
- ✅ Soft delete avec `archived/archived_at/archived_by`
- ✅ Relations avec `archon_projects`
- ✅ Support JSONB pour `sources` et `code_examples`

## 🛠️ Stories Prévues

### Story 1.1 - Créer table archon_epics
**Objectif**: Table pour le niveau EPIC
```sql
CREATE TABLE archon_epics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES archon_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status epic_status DEFAULT 'todo',
  priority INTEGER DEFAULT 0,
  mvp_flag BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ NULL,
  archived_by TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Story 1.2 - Créer table archon_stories
**Objectif**: Table pour le niveau STORY
```sql
CREATE TABLE archon_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  epic_id UUID REFERENCES archon_epics(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status story_status DEFAULT 'todo',
  priority INTEGER DEFAULT 0,
  mvp_flag BOOLEAN DEFAULT false,
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ NULL,
  archived_by TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Story 1.3 - Étendre table archon_tasks
**Objectif**: Ajouter relation vers STORY
```sql
-- Ajouter colonne story_id
ALTER TABLE archon_tasks
ADD COLUMN story_id UUID REFERENCES archon_stories(id) ON DELETE CASCADE;

-- Index pour performance
CREATE INDEX idx_archon_tasks_story_id ON archon_tasks(story_id);
```

### Story 1.4 - Créer table archon_subtasks
**Objectif**: Table pour le niveau SUBTASK
```sql
CREATE TABLE archon_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES archon_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status task_status DEFAULT 'todo',
  assignee TEXT DEFAULT 'User',
  task_order INTEGER DEFAULT 0,
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ NULL,
  archived_by TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Story 1.5 - Créer table archon_dependencies
**Objectif**: Gestion des dépendances entre tous niveaux
```sql
CREATE TABLE archon_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_type dependency_type NOT NULL, -- 'epic', 'story', 'task', 'subtask'
  from_id UUID NOT NULL,
  to_type dependency_type NOT NULL,
  to_id UUID NOT NULL,
  dependency_relation relation_type DEFAULT 'depends_on', -- 'blocks', 'depends_on', 'related_to'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_type, from_id, to_type, to_id, dependency_relation)
);
```

### Story 1.6 - Créer types et contraintes
**Objectif**: Types énumérés pour cohérence
```sql
-- Types pour les statuts
CREATE TYPE epic_status AS ENUM ('todo', 'doing', 'review', 'waiting_validation', 'done');
CREATE TYPE story_status AS ENUM ('todo', 'doing', 'review', 'waiting_validation', 'done');
-- task_status existe déjà

-- Types pour les dépendances
CREATE TYPE dependency_type AS ENUM ('epic', 'story', 'task', 'subtask');
CREATE TYPE relation_type AS ENUM ('blocks', 'depends_on', 'related_to');

-- Étendre task_status existant
ALTER TYPE task_status ADD VALUE 'waiting_validation';
```

### Story 1.7 - Scripts migration données existantes
**Objectif**: Migrer sans perte les projets/tâches existants
```sql
-- Script de migration sécurisé
-- 1. Créer EPIC par défaut pour projets existants
-- 2. Créer STORY par défaut par projet
-- 3. Lier toutes tâches existantes aux STORIEs par défaut
-- 4. Valider intégrité référentielle
```

### Story 1.8 - Index et optimisations performance
**Objectif**: S'assurer que les requêtes hiérarchiques restent rapides
```sql
-- Index pour requêtes hiérarchiques
CREATE INDEX idx_archon_epics_project_id ON archon_epics(project_id);
CREATE INDEX idx_archon_stories_epic_id ON archon_stories(epic_id);
CREATE INDEX idx_archon_subtasks_task_id ON archon_subtasks(task_id);

-- Index pour les dépendances
CREATE INDEX idx_archon_dependencies_from ON archon_dependencies(from_type, from_id);
CREATE INDEX idx_archon_dependencies_to ON archon_dependencies(to_type, to_id);

-- Index composites pour filtres fréquents
CREATE INDEX idx_archon_epics_status_priority ON archon_epics(status, priority);
CREATE INDEX idx_archon_stories_status_priority ON archon_stories(status, priority);
```

## ✅ Critères d'Acceptation Epic 1

- [ ] Hiérarchie 4 niveaux fonctionnelle en BDD
- [ ] Relations parent-enfant cohérentes et contraintes respectées
- [ ] Migration des données existantes sans perte
- [ ] Performance maintenue (requêtes < 100ms)
- [ ] Intégrité référentielle validée
- [ ] Support soft delete sur tous niveaux
- [ ] Types énumérés cohérents

## 🔗 Dépendances

**Bloque**: Epic 2 (Services Backend) - ne peut pas commencer sans la BDD
**Prérequis**: Analyse architecture terminée ✅

## 📝 Notes Implémentation

- Conserver `parent_task_id` dans `archon_tasks` pour compatibilité ascendante
- Utiliser même pattern de soft delete (`archived/archived_at/archived_by`)
- Types énumérés PostgreSQL pour validation côté BDD
- Migration progressive avec validation à chaque étape