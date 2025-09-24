# Analyse Complète - Points d'Extension BMAD

**Auteur:** AI IDE Agent  
**Tags:** Analysis, Extension, BMAD, Hierarchy  
**Status:** draft  
**Version:** 1.0  
**Type:** design  

## Synthèse Analyse
Analyse complète de l'architecture Archon pour identifier les points d'extension précis pour la hiérarchie BMAD PROJET → EPIC → STORY → TASK → SUBTASK

## Architecture Existante

### Backend
- **Service:** TaskService dans /python/src/server/services/projects/task_service.py
- **APIs REST:**
  - GET /api/projects/{project_id}/tasks
  - POST /api/tasks
  - GET /api/tasks/{task_id}
  - PUT /api/tasks/{task_id}
  - DELETE /api/tasks/{task_id}
- **Table BDD:** archon_tasks avec parent_task_id EXISTANT (ligne 32 du schéma)
- **États Actuels:** todo, doing, review, done
- **Fonctionnalités Robustes:**
  - Réordonnancement automatique (lignes 78-99)
  - Filtres avancés (projet, statut, recherche, archivage)
  - Validation des statuts et assignés
  - Support JSONB pour sources et code_examples
  - Soft delete avec archived/archived_at/archived_by

### Frontend
- **Architecture:** Vertical slice dans /src/features/projects/tasks/
- **Service Frontend:**
  - taskService avec méthodes CRUD complètes
  - Gestion cache ETag pour optimisation
  - Support drag & drop avec updateTaskOrder
  - Validation Zod pour toutes requêtes
- **Types TypeScript:**
  - DatabaseTaskStatus: 'todo' | 'doing' | 'review' | 'done'
  - Assignee: 'User' | 'Archon' | 'AI IDE Agent'
  - Task interface complète avec tous champs BDD
  - Support soft delete et propriétés UI étendues

### MCP Server
- **Communication:** Appels HTTP vers FastAPI avec gestion erreurs MCPErrorFormatter
- **Optimisations:**
  - Troncature descriptions (MAX_DESCRIPTION_LENGTH = 1000)
  - Remplacement arrays par counts (sources_count, code_examples_count)
  - Pagination DEFAULT_PAGE_SIZE = 10
- **Tools Actuels:**
  - find_tasks() - Recherche/listing consolidé avec query, filter, pagination
  - manage_task() - CRUD consolidé avec actions create/update/delete

## Points d'Extension Identifiés

### 1. Structure Hiérarchique
- **Avantage:** parent_task_id existe déjà dans archon_tasks
- **Limitation:** Un seul niveau de hiérarchie actuellement
- **Extension Requise:**
  - **Nouvelles Tables:**
    - archon_epics (id, project_id, title, description, status, priority, mvp_flag, created_at, updated_at)
    - archon_stories (id, epic_id, title, description, status, priority, mvp_flag, created_at, updated_at)
    - archon_subtasks (id, task_id, title, description, status, assignee, task_order, created_at, updated_at)
  - **Nouvelles Relations:**
    - projects → epics (1:N)
    - epics → stories (1:N)
    - stories → tasks (1:N)
    - tasks → subtasks (1:N)
  - **Modification Table Tasks:** Ajouter story_id pour lier TASK → STORY

### 2. Gestion États
- **Avantage:** Système d'états robuste existant
- **Limitation:** États fixes dans VALID_STATUSES
- **Extension Requise:**
  - **Nouvel État:** waiting_validation
  - **États Étendus:** todo | doing | review | waiting_validation | done
  - **Validation par Niveau:** Chaque niveau (EPIC/STORY/TASK/SUBTASK) peut avoir ses propres règles de validation

### 3. Calcul Avancement
- **Manquant:** Calcul automatique basé sur sous-éléments
- **Implementation Requise:**
  - **Déclencheurs:** Mettre à jour automatiquement lors changement statut enfants
  - **Logique Calcul:**
    - Epic progress = moyenne des Stories
    - Story progress = moyenne des Tasks
    - Task progress = moyenne des Subtasks
  - **Méthodes Services:**
    - calculate_epic_progress(epic_id)
    - calculate_story_progress(story_id)
    - calculate_task_progress(task_id)

### 4. Gestion Dépendances
- **Manquant:** Support dépendances entre EPICs, STORIEs, TASKs
- **Implementation Requise:**
  - **API Endpoints:**
    - POST /api/dependencies
    - GET /api/{type}/{id}/dependencies
    - DELETE /api/dependencies/{id}
  - **Types Dépendance:** blocks, depends_on, related_to
  - **Table Dépendances:** archon_dependencies (id, from_type, from_id, to_type, to_id, dependency_type, created_at)

### 5. Extension MCP
- **Nouveaux Tools Requis:**
  - find_epics() - Recherche/listing EPICs
  - manage_epic() - CRUD EPICs
  - find_stories() - Recherche/listing STORIEs
  - manage_story() - CRUD STORIEs
  - find_subtasks() - Recherche/listing SUBTASKs
  - manage_subtask() - CRUD SUBTASKs
  - get_hierarchy() - Navigation hiérarchique complète
  - manage_dependencies() - Gestion dépendances
- **Optimisations Maintenir:**
  - Troncature descriptions
  - Counts au lieu d'arrays
  - Pagination optimisée

### 6. Interface Frontend
- **Services Étendre:**
  - epicService, storyService, subtaskService
  - dependencyService
  - hierarchyService pour navigation
- **Types TypeScript Ajouter:**
  - Epic, Story, Subtask interfaces
  - Dependency interface
  - HierarchyNode interface
- **Nouveaux Composants Requis:**
  - EpicView - Vue EPIC avec navigation vers STORIEs
  - StoryView - Vue STORY avec navigation vers TASKs
  - SubtaskView - Vue SUBTASK intégrée dans TASK
  - HierarchyBreadcrumb - Navigation hiérarchique
  - DependencyGraph - Visualisation dépendances

## Migration Strategy

### Phase 1 - Extension Progressive
- Créer nouvelles tables sans toucher existant
- Implémenter EpicService, StoryService, SubtaskService
- Ajouter nouveaux endpoints API
- Tests avec projets pilotes

### Phase 2 - Migration Données
- Script migration tâches existantes vers STORIEs
- Validation intégrité données
- Plan rollback en cas problème

### Phase 3 - Interface Evolution
- Nouveaux composants React hiérarchiques
- Extension taskService existant
- Mise à jour types TypeScript

### Phase 4 - Extension MCP
- Nouveaux tools MCP pour hiérarchie
- Tests intégration IA
- Documentation usage IA optimisée

## Recommandations Techniques
- **Testing:** Tests end-to-end pour validation cohérence hiérarchique
- **Performance:** Optimiser requêtes avec index appropriés sur relations
- **Preserve Existing:** Maintenir compatibilité ascendante totale
- **MCP AI Optimization:** S'assurer que IA peut naviguer hiérarchie efficacement
- **Progressive Adoption:** Permettre adoption graduelle hiérarchie