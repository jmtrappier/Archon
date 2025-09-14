# Analyse Technique Détaillée - Archon

**Date:** 2024-12-19  
**Analyste:** Business Analyst Mary  
**Objectif:** Comprendre l'architecture actuelle pour la transformation BMAD  

---

## 🏗️ Architecture Générale

### **Architecture Microservices**
- **Backend:** Python FastAPI avec microservices Docker
- **Frontend:** React + TypeScript + Tailwind CSS
- **Base de données:** PostgreSQL (Supabase)
- **Communication:** Socket.IO pour les mises à jour temps réel
- **MCP:** Protocol pour intégration avec assistants IA

### **Services Principaux**
- **Server:** API principale (Port 8181)
- **MCP Server:** Interface pour assistants IA (Port 8051)
- **UI:** Interface web (Port 3737)

---

## 📊 Structure de Base de Données

### **Table Principale: `archon_tasks`**
```sql
CREATE TABLE archon_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES archon_projects(id) ON DELETE CASCADE,
  parent_task_id UUID REFERENCES archon_tasks(id) ON DELETE CASCADE, -- ⚠️ EXISTE DÉJÀ !
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status task_status DEFAULT 'todo',
  assignee TEXT DEFAULT 'User',
  task_order INTEGER DEFAULT 0,
  feature TEXT,
  sources JSONB DEFAULT '[]'::jsonb,
  code_examples JSONB DEFAULT '[]'::jsonb,
  archived BOOLEAN DEFAULT false,
  archived_at TIMESTAMPTZ NULL,
  archived_by TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Points Clés Identifiés:**
✅ **Relation parent-enfant existe déjà** (`parent_task_id`)  
✅ **États définis:** `todo`, `doing`, `review`, `done`  
✅ **Gestion des assignés:** `User`, `Archon`, `AI IDE Agent`  
✅ **Archivage soft:** `archived`, `archived_at`, `archived_by`  
✅ **Ordre des tâches:** `task_order` pour priorisation  

---

## 🔧 Services Backend

### **TaskService** (`python/src/server/services/projects/task_service.py`)

#### **Méthodes Principales:**
- `create_task()` - Création avec réordonnancement automatique
- `list_tasks()` - Filtrage par projet, statut, archivage
- `update_task()` - Mise à jour avec broadcast Socket.IO
- `archive_task()` - Archivage soft avec cascade
- `validate_status()` - Validation des états
- `validate_assignee()` - Validation des assignés

#### **Fonctionnalités Avancées:**
- **Réordonnancement automatique** lors de création
- **Broadcast Socket.IO** pour mises à jour temps réel
- **Filtrage flexible** (projet, statut, archivage)
- **Gestion des champs JSONB** (sources, code_examples)

### **ProjectService** (`python/src/server/services/projects/project_service.py`)
- Gestion CRUD des projets
- Champs JSONB: `docs`, `features`, `data`
- Support GitHub repo
- Gestion des projets épinglés

---

## 🌐 APIs REST

### **Endpoints Tâches** (`python/src/server/api_routes/projects_api.py`)

```typescript
// Endpoints identifiés
GET    /api/projects/{project_id}/tasks     // Tâches d'un projet
POST   /api/tasks                          // Créer une tâche
GET    /api/tasks                          // Lister toutes les tâches
GET    /api/tasks/{task_id}                // Détails d'une tâche
PUT    /api/tasks/{task_id}                // Modifier une tâche
DELETE /api/tasks/{task_id}                // Supprimer une tâche
PUT    /api/mcp/tasks/{task_id}/status     // Mise à jour statut MCP
```

### **Modèles de Données:**
```typescript
interface CreateTaskRequest {
  project_id: string;
  title: string;
  description?: string;
  status?: string; // "todo" | "doing" | "review" | "done"
  assignee?: string; // "User" | "Archon" | "AI IDE Agent"
  task_order?: number;
  feature?: string;
}
```

---

## 🤖 MCP (Model Context Protocol)

### **Task Tools** (`python/src/mcp_server/features/tasks/task_tools.py`)

#### **Outils Disponibles:**
- `create_task()` - Création via MCP
- `list_tasks()` - Listing via MCP
- `update_task()` - Mise à jour via MCP
- `delete_task()` - Suppression via MCP

#### **Assignés Supportés:**
- `"User"` - Tâches manuelles
- `"Archon"` - Tâches IA-driven
- `"AI IDE Agent"` - Implémentation de code
- `"prp-executor"` - Coordination PRP
- `"prp-validator"` - Tests/validation

---

## 🎨 Interface Frontend

### **Composants Principaux**

#### **TasksTab** (`archon-ui-main/src/components/project-tasks/TasksTab.tsx`)
- **Vues:** Table et Board (Kanban)
- **Drag & Drop:** Réordonnancement des tâches
- **États UI:** `backlog`, `in-progress`, `review`, `complete`
- **Mapping:** Conversion UI ↔ Base de données
- **Socket.IO:** Mises à jour temps réel

#### **TaskTableView** (`archon-ui-main/src/components/project-tasks/TaskTableView.tsx`)
- **Édition inline** des tâches
- **Gestion des priorités** (task_order)
- **Couleurs par assigné** et priorité
- **Actions:** Éditer, supprimer, compléter

### **Types TypeScript**
```typescript
interface Task {
  id: string;
  title: string;
  description: string;
  status: 'backlog' | 'in-progress' | 'review' | 'complete';
  assignee: {
    name: 'User' | 'Archon' | 'AI IDE Agent';
    avatar: string;
  };
  feature: string;
  featureColor: string;
  task_order: number;
}
```

---

## 🔄 Communication Temps Réel

### **Socket.IO**
- **Broadcast automatique** lors des modifications
- **Événements:** `task_created`, `task_updated`, `task_archived`
- **Gestion des conflits** avec timestamps serveur
- **Reconnexion automatique** côté client

### **Hooks React**
- `useTaskSocket()` - Gestion des événements Socket.IO
- **Optimisation:** Skip des updates pendant édition
- **Conflict resolution** basé sur timestamps

---

## 🎯 Points d'Extension Identifiés

### **1. Structure Hiérarchique (Priorité #1)**
✅ **Avantage:** `parent_task_id` existe déjà  
⚠️ **Limitation:** Un seul niveau de hiérarchie  
🔄 **Extension nécessaire:** Tables séparées pour EPIC, STORY, SUBTASK  

### **2. Gestion des États**
✅ **Avantage:** Système d'états robuste  
⚠️ **Limitation:** États fixes (todo, doing, review, done)  
🔄 **Extension nécessaire:** Ajout "Waiting for validation"  

### **3. Calcul d'Avancement**
❌ **Manquant:** Calcul automatique basé sur sous-éléments  
🔄 **À implémenter:** Logique de calcul par niveau  

### **4. Validation Utilisateur**
❌ **Manquant:** Workflow de validation obligatoire  
🔄 **À implémenter:** Système d'approbation par niveau  

---

## 🚨 Risques Techniques Identifiés

### **1. Migration des Données**
- **Risque:** Perte de données lors de la restructuration
- **Mitigation:** Scripts de migration avec rollback

### **2. Performance**
- **Risque:** Requêtes complexes avec 4 niveaux
- **Mitigation:** Index appropriés, pagination

### **3. Compatibilité MCP**
- **Risque:** Incompatibilité avec outils MCP existants
- **Mitigation:** Tests d'intégration précoces

### **4. Interface Complexité**
- **Risque:** UX dégradée avec 4 niveaux
- **Mitigation:** Navigation intuitive, breadcrumbs

---

## 📋 Plan de Migration Recommandé

### **Phase 1: Extension Progressive**
1. **Créer les nouvelles tables** sans toucher à l'existant
2. **Implémenter les services** EpicService, StoryService, SubtaskService
3. **Tester avec des projets pilotes**

### **Phase 2: Migration des Données**
1. **Script de migration** des tâches existantes
2. **Validation** de l'intégrité des données
3. **Rollback plan** en cas de problème

### **Phase 3: Interface Utilisateur**
1. **Navigation hiérarchique** dans l'UI
2. **Gestion des états** par niveau
3. **Calcul d'avancement** automatique

### **Phase 4: Intégration MCP**
1. **Extension des outils MCP** pour les nouveaux niveaux
2. **Tests d'intégration** avec assistants IA
3. **Documentation** des nouvelles fonctionnalités

---

## 🎯 Recommandations Techniques

### **1. Architecture de Base de Données**
```sql
-- Tables recommandées
archon_epics (id, project_id, title, description, status, priority, mvp_flag)
archon_stories (id, epic_id, title, description, status, priority, mvp_flag)
archon_tasks (id, story_id, title, description, status, assignee, task_order)
archon_subtasks (id, task_id, title, description, status, assignee, task_order)
```

### **2. États Étendus**
```typescript
type TaskStatus = 'todo' | 'doing' | 'review' | 'waiting_validation' | 'done';
```

### **3. Calcul d'Avancement**
```typescript
interface ProgressCalculation {
  epic_progress: number; // Basé sur stories
  story_progress: number; // Basé sur tasks
  task_progress: number; // Basé sur subtasks
}
```

### **4. Validation Workflow**
```typescript
interface ValidationWorkflow {
  level: 'epic' | 'story' | 'task' | 'subtask';
  requires_validation: boolean;
  validation_status: 'pending' | 'approved' | 'rejected';
  validated_by?: string;
  validated_at?: Date;
}
```

---

## ✅ Conclusion

### **Points Forts de l'Architecture Actuelle:**
- ✅ Structure solide avec microservices
- ✅ Gestion des états robuste
- ✅ Communication temps réel avec Socket.IO
- ✅ Intégration MCP fonctionnelle
- ✅ Interface utilisateur moderne

### **Extensions Nécessaires pour BMAD:**
- 🔄 Tables séparées pour la hiérarchie à 4 niveaux
- 🔄 Calcul automatique de l'avancement
- 🔄 Workflow de validation utilisateur
- 🔄 Navigation hiérarchique dans l'UI

### **Faisabilité:**
- **Technique:** ✅ Très faisable
- **Complexité:** ⚠️ Modérée (gestion de la migration)
- **Risques:** ⚠️ Contrôlables avec approche progressive

**L'architecture actuelle d'Archon fournit une base solide pour l'intégration BMAD. L'approche MVP recommandée permettra une transformation progressive et sécurisée.**

---

*Analyse réalisée dans le cadre de la méthodologie BMAD-METHOD™*

