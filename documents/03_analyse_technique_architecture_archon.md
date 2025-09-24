# Analyse Technique - Architecture Archon

**Auteur:** Business Analyst Mary  
**Tags:** Technical, Architecture, Analysis  
**Status:** draft  
**Version:** 1.0  
**Type:** design  

## Faisabilité
- **Technique:** Très faisable
- **Complexité:** Modérée (gestion migration)
- **Risques:** Contrôlables avec approche progressive

## Recommandations

### États Étendus
todo | doing | review | waiting_validation | done

### Plan Migration
- Extension progressive
- Migration données
- Interface UI
- Intégration MCP

### Architecture BDD
- archon_epics (id, project_id, title, description, status, priority, mvp_flag)
- archon_stories (id, epic_id, title, description, status, priority, mvp_flag)
- archon_tasks (id, story_id, title, description, status, assignee, task_order)
- archon_subtasks (id, task_id, title, description, status, assignee, task_order)

## Services Backend

### TaskService
**Méthodes:**
- create_task, list_tasks, update_task, archive_task, validate_status

**Fonctionnalités:**
- Réordonnancement automatique
- Broadcast Socket.IO
- Filtrage flexible

### ProjectService
Gestion CRUD projets, champs JSONB, support GitHub

## Architecture Générale
- **MCP:** Protocol pour intégration assistants IA
- **Frontend:** React + TypeScript + Tailwind CSS
- **Base données:** PostgreSQL (Supabase)
- **Communication:** Socket.IO pour mises à jour temps réel
- **Microservices:** Python FastAPI avec microservices Docker

## Structure BDD Actuelle

### États
- todo, doing, review, done

### Assignés
- User, Archon, AI IDE Agent

### Ordre Tâches
task_order pour priorisation

### Archivage Soft
archived, archived_at, archived_by

### Table Principale
archon_tasks avec parent_task_id (EXISTE DÉJÀ)

## Points d'Extension Identifiés

### 1. Gestion États
- **Avantage:** Système d'états robuste
- **Extension:** Ajout 'Waiting for validation'
- **Limitation:** États fixes

### 2. Calcul Avancement
- **Manquant:** Calcul automatique basé sur sous-éléments
- **À implémenter:** Logique de calcul par niveau

### 3. Structure Hiérarchique
- **Avantage:** parent_task_id existe déjà
- **Extension:** Tables séparées pour EPIC, STORY, SUBTASK
- **Limitation:** Un seul niveau de hiérarchie