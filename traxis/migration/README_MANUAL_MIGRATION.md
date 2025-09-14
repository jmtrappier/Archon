# 🚀 Migration Manuelle TRAXIS - Structure Hiérarchique

## 📋 Aperçu

Cette migration ajoute la structure hiérarchique BMAD à votre instance Archon :
```
PROJET
├── EPIC (nouvelles fonctionnalités majeures)
│   └── STORY (user stories)
│       └── TASK (tâches d'implémentation)
│           └── SUBTASK (sous-tâches)
```

## ⚡ Instructions d'Exécution (5 minutes)

### Étape 1 : Accéder à Supabase Studio
1. Ouvrez votre navigateur
2. Allez sur `http://localhost:8000` (ou votre URL Supabase)
3. Connectez-vous à votre dashboard Supabase

### Étape 2 : Exécuter la Migration
1. Dans le menu latéral, cliquez sur **"SQL Editor"**
2. Ouvrez le fichier `migration/MANUAL_TRAXIS_MIGRATION.sql`
3. **Copiez TOUT le contenu** du fichier (Ctrl+A puis Ctrl+C)
4. **Collez** dans l'éditeur SQL de Supabase (Ctrl+V)
5. Cliquez sur le bouton **"Run"** (ou Ctrl+Entrée)

### Étape 3 : Redémarrer les Services
```bash
cd /path/to/your/archon
docker-compose restart
```

## ✅ Vérification du Succès

Après l'exécution, vous devriez voir dans les logs de Supabase :
- `CREATE TABLE` pour archon_epics
- `CREATE TABLE` pour archon_stories
- `ALTER TABLE` pour archon_tasks
- Aucune erreur rouge

### Vérification Rapide dans SQL Editor
```sql
-- Vérifier que les nouvelles tables existent
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'archon_%'
ORDER BY table_name;

-- Vérifier les nouvelles colonnes dans archon_tasks
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'archon_tasks'
AND column_name IN ('epic_id', 'story_id', 'parent_task_id');
```

## 🎯 Nouvelles Fonctionnalités Disponibles

### Tables Ajoutées
- **`archon_epics`** - Fonctionnalités majeures (Ex: "API Authentication", "User Dashboard")
- **`archon_stories`** - User stories avec critères d'acceptation
- **`archon_tasks`** - Étendue avec relations hiérarchiques et subtasks

### Colonnes Ajoutées à archon_tasks
- `epic_id` - Lien vers l'epic parent
- `story_id` - Lien vers la story parent
- `parent_task_id` - Pour créer des subtasks
- `task_type` - task, subtask, bug, spike
- `story_points` - Estimation agile
- `time_estimate_hours` / `time_spent_hours` - Suivi temporel
- `acceptance_criteria[]` - Critères d'acceptation
- `dependencies[]` - Dépendances entre tâches

### Vues Disponibles
- **`archon_project_hierarchy`** - Vue complète de la hiérarchie projet
- **`archon_project_summary`** - Statistiques par projet

### Fonctions Utilitaires
- `get_epic_completion_percentage(epic_id)` - Pourcentage de completion
- `get_story_completion_percentage(story_id)` - Pourcentage de completion
- Triggers automatiques pour mise à jour des progressions

## 🏗️ Utilisation Post-Migration

### Créer un Epic
```sql
INSERT INTO archon_epics (project_id, title, description, status, priority)
VALUES ('your-project-id', 'API Authentication', 'Complete user authentication system', 'active', 90);
```

### Créer une Story
```sql
INSERT INTO archon_stories (project_id, epic_id, title, user_story, acceptance_criteria, story_points)
VALUES (
  'your-project-id',
  'your-epic-id',
  'User Login',
  'As a user, I want to log in so that I can access my account',
  ARRAY['Valid credentials allow access', 'Invalid credentials show error'],
  5
);
```

### Lier une Task à une Story
```sql
UPDATE archon_tasks
SET story_id = 'your-story-id', epic_id = 'your-epic-id'
WHERE id = 'your-task-id';
```

### Créer une Subtask
```sql
INSERT INTO archon_tasks (project_id, story_id, title, task_type, parent_task_id)
VALUES (
  'your-project-id',
  'your-story-id',
  'Write unit tests for login',
  'subtask',
  'parent-task-id'
);
```

## 🛠️ En Cas de Problème

### Erreurs Communes
1. **"Table already exists"** - Normal, la migration gère les conflits
2. **"Column already exists"** - Normal, utilise `IF NOT EXISTS`
3. **Timeout** - Le fichier est volumineux, patientez 30-60 secondes

### Rollback (si nécessaire)
```sql
-- ATTENTION: Ceci supprime les nouvelles tables
DROP TABLE IF EXISTS archon_stories CASCADE;
DROP TABLE IF EXISTS archon_epics CASCADE;
-- Les colonnes ajoutées à archon_tasks resteront (pas problématique)
```

### Support
En cas de problème :
1. Vérifiez les logs Supabase pour les erreurs spécifiques
2. Assurez-vous d'avoir les permissions admin sur Supabase
3. Redémarrez Docker si les services ne voient pas les changements

## 🎉 Prochaines Étapes

Après cette migration, vous pourrez :
1. ✅ Utiliser l'API Archon étendue pour les Epics/Stories
2. ✅ Créer des hiérarchies projet complètes
3. ✅ Tracking automatique des progressions
4. ✅ Rapports avec les nouvelles vues SQL
5. ✅ Interface web mise à jour (si disponible)

La migration automatique sera implémentée dans une story future pour simplifier ce processus.