# STORIES Epic 1 - Base de Données Hiérarchique

**Epic**: 1-BDD - Base de Données Hiérarchique
**Priorité**: MVP #1 (Fondation)
**Validation**: Utilisateur final obligatoire

## 📋 **STORY 1.1 - Créer Tables Hiérarchiques de Base**

**Objectif**: Créer les tables `archon_epics` et `archon_stories` pour les nouveaux niveaux
**Tag Archon**: `STORY-Epic1-Tables`

### Critères d'Acceptation :
- [ ] Table `archon_epics` créée avec relations vers `archon_projects`
- [ ] Table `archon_stories` créée avec relations vers `archon_epics`
- [ ] Types énumérés pour statuts (`epic_status`, `story_status`)
- [ ] Soft delete cohérent sur tous niveaux (`archived/archived_at/archived_by`)
- [ ] Index de performance sur clés étrangères
- [ ] Contraintes d'intégrité référentielle fonctionnelles

### Dépendances :
- **Bloqué par** : Aucune (peut commencer)
- **Bloque** : Toutes les autres STORIES

---

## 📋 **STORY 1.2 - Étendre Table Tasks Existante**

**Objectif**: Ajouter `story_id` à `archon_tasks` en conservant `parent_task_id`
**Tag Archon**: `STORY-Epic1-TasksExtension`

### Critères d'Acceptation :
- [ ] Colonne `story_id` ajoutée avec contrainte vers `archon_stories`
- [ ] `parent_task_id` CONSERVÉ pour rétrocompatibilité et SUBTASKs futures
- [ ] Index sur `story_id` pour performance
- [ ] Type `task_status` étendu avec `waiting_validation`
- [ ] Migration testée sans casser l'existant

### Dépendances :
- **Bloqué par** : STORY 1.1 (besoin table archon_stories)
- **Bloque** : STORY 1.4 (migration)

---

## 📋 **STORY 1.3 - Créer Table Subtasks**

**Objectif**: Table `archon_subtasks` utilisant `parent_task_id` existant
**Tag Archon**: `STORY-Epic1-Subtasks`

### Critères d'Acceptation :
- [ ] Table `archon_subtasks` avec relation vers `archon_tasks`
- [ ] Même structure que `archon_tasks` (assignee, task_order, etc.)
- [ ] Réutilise le système `parent_task_id` éprouvé
- [ ] Soft delete cohérent
- [ ] Index de performance sur `task_id`

### Dépendances :
- **Bloqué par** : STORY 1.2 (confirmation structure tasks)
- **Bloque** : STORY 1.6 (dépendances)

---

## 📋 **STORY 1.4 - Migration Conservatrice Automatique**

**Objectif**: Migrer projets existants avec EPIC/STORY par défaut
**Tag Archon**: `STORY-Epic1-Migration`

### Approche Décidée :
**Migration simple** : 1 EPIC par défaut + 1 STORY par défaut par projet existant

### Critères d'Acceptation :
- [ ] Script de migration sécurisé avec rollback
- [ ] Pour chaque projet existant :
  - [ ] Créer EPIC "Projet Principal" (statut `doing`)
  - [ ] Créer STORY "Fonctionnalités Principales" (statut `doing`)
  - [ ] Lier TOUTES les tâches existantes à cette STORY
- [ ] Validation intégrité référentielle post-migration
- [ ] Log détaillé de la migration pour debug
- [ ] **L'utilisateur pourra demander à l'IA de réorganiser APRÈS**

### Dépendances :
- **Bloqué par** : STORY 1.1, 1.2 (tables prêtes)
- **Bloque** : STORY 1.7 (tests)

---

## 📋 **STORY 1.5 - Table Dépendances Légère**

**Objectif**: Gestion dépendances avec références ID uniquement
**Tag Archon**: `STORY-Epic1-Dependencies`

### Approche Optimisée :
**Stockage minimal** : seulement les IDs, pas les détails des objets

### Critères d'Acceptation :
- [ ] Table `archon_dependencies` avec colonnes minimales :
  - `from_type` ('epic', 'story', 'task', 'subtask')
  - `from_id` (UUID seulement)
  - `to_type`, `to_id` (UUID seulement)
  - `relation_type` ('blocks', 'depends_on', 'related_to')
- [ ] Index composite sur `(from_type, from_id)` et `(to_type, to_id)`
- [ ] Contrainte unicité sur relations
- [ ] **Pas de détails d'objet stockés** - optimisation performance

### Dépendances :
- **Bloqué par** : STORY 1.3 (besoin de tous les types)
- **Bloque** : STORY 1.6 (API dépendances)

---

## 📋 **STORY 1.6 - API Requêtes Hiérarchiques Optimisées**

**Objectif**: Requêtes SQL efficaces pour navigation hiérarchique
**Tag Archon**: `STORY-Epic1-QueriesAPI`

### Critères d'Acceptation :
- [ ] Requêtes CTE (Common Table Expressions) pour hiérarchie complète
- [ ] Fonction `get_project_hierarchy(project_id)` retournant JSON structuré
- [ ] Fonction `get_dependencies_light(type, id)` retournant seulement IDs
- [ ] Index optimisés pour requêtes fréquentes
- [ ] **Performance < 100ms** même avec 1000+ éléments par niveau
- [ ] Pagination native sur tous les niveaux

### Dépendances :
- **Bloqué par** : STORY 1.5 (table dépendances)
- **Bloque** : STORY 1.7 (tests performance)

---

## 📋 **STORY 1.7 - Tests et Validation Utilisateur**

**Objectif**: Validation complète par utilisateur sur interface
**Tag Archon**: `STORY-Epic1-UserValidation`

### Critères d'Acceptation :
- [ ] Interface de test simple pour créer hiérarchie complète
- [ ] Validation utilisateur sur :
  - [ ] Création EPIC → STORY → TASK → SUBTASK
  - [ ] Navigation fluide entre niveaux
  - [ ] Dépendances fonctionnelles
  - [ ] Performance acceptable
- [ ] Tests automatisés pour intégrité référentielle
- [ ] **Utilisateur valide que tout fonctionne avant Epic 2**

### Dépendances :
- **Bloqué par** : Toutes les STORIES précédentes
- **Bloque** : Epic 2-Backend

---

## 🎯 **Ordre d'Exécution Recommandé**

1. **STORY 1.1** → Tables de base (épics, stories)
2. **STORY 1.2** → Extension tasks (+ story_id)
3. **STORY 1.3** → Table subtasks
4. **STORY 1.4** → Migration conservatrice
5. **STORY 1.5** → Table dépendances légère
6. **STORY 1.6** → API requêtes optimisées
7. **STORY 1.7** → Tests et validation utilisateur

## ⚠️ **Points Critiques**

- **Migration conservatrice** : pas de réorganisation automatique "intelligente"
- **Performance** : dépendances stockent seulement IDs
- **Rétrocompatibilité** : `parent_task_id` conservé
- **Validation utilisateur** : obligatoire avant Epic 2

---

**État Epic 1** : Stories définies ✅ - Prêt pour implémentation une fois validé