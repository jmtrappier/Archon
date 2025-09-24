# EPICs TRAXIS - Structure BMAD

**Auteur:** AI IDE Agent  
**Tags:** EPICs, BMAD, Structure, Planning  
**Status:** draft  
**Version:** 1.0  
**Type:** spec  

## Vision Projet
Transformer Archon pour supporter hiérarchie PROJET → EPIC → STORY → TASK → SUBTASK avec gestion des dépendances

## Approche Solo Dev
- **Principe:** Développement itératif par EPIC, validation immédiate
- **Validation:** Test avec IA après chaque EPIC terminé
- **Durée Estimée EPIC:** Une soirée intensive par EPIC

## Ordre Priorité
1. Epic 1 - BDD (fondation)
2. Epic 2 - Backend (logique métier)
3. Epic 3 - MCP (usage IA)
4. Epic 4 - Frontend (interface utilisateur)
5. Epic 5 - Validation (intégration finale)

## EPICs Principaux

### EPIC 1 - Base de Données Hiérarchique
**MVP:** ✅ true  
**Titre:** Base de Données Hiérarchique  
**Objectif:** Créer la structure BDD pour supporter la hiérarchie BMAD  

**Stories Estimées:**
- Créer table archon_epics
- Créer table archon_stories
- Créer table archon_subtasks
- Étendre table archon_tasks (ajout story_id)
- Créer table archon_dependencies
- Scripts de migration des données existantes
- Index et contraintes pour performance

**Critères Acceptation:**
- Hiérarchie 4 niveaux fonctionnelle
- Relations parent-enfant cohérentes
- Migration sans perte de données
- Performance maintenue

### EPIC 2 - Services Backend Hiérarchiques
**MVP:** ✅ true  
**Titre:** Services Backend Hiérarchiques  
**Objectif:** Étendre l'architecture backend pour supporter tous les niveaux BMAD  

**Stories Estimées:**
- EpicService avec CRUD complet
- StoryService avec CRUD complet
- SubtaskService avec CRUD complet
- Extension TaskService pour story_id
- DependencyService pour gestion dépendances
- ProgressCalculationService pour avancement automatique
- APIs REST pour tous les niveaux
- Gestion états étendus (waiting_validation)

**Critères Acceptation:**
- CRUD fonctionnel sur tous niveaux
- Calcul avancement automatique
- Gestion dépendances opérationnelle
- APIs cohérentes avec existant

### EPIC 3 - Extension MCP pour Hiérarchie
**MVP:** ✅ true  
**Titre:** Extension MCP pour Hiérarchie  
**Objectif:** Permettre aux IA d'utiliser parfaitement la hiérarchie BMAD  

**Stories Estimées:**
- find_epics() et manage_epic() tools
- find_stories() et manage_story() tools
- find_subtasks() et manage_subtask() tools
- get_hierarchy() pour navigation complète
- manage_dependencies() pour dépendances
- Extension find_tasks() pour intégration
- Optimisations performance (troncature, pagination)
- Documentation IA pour usage optimal

**Critères Acceptation:**
- IA peut naviguer toute la hiérarchie
- Performance MCP maintenue
- Tools cohérents avec pattern existant
- Documentation claire pour IA

### EPIC 4 - Interface Utilisateur Hiérarchique
**MVP:** ✅ true  
**Titre:** Interface Utilisateur Hiérarchique  
**Objectif:** Interface fluide pour gérer la hiérarchie BMAD  

**Stories Estimées:**
- EpicView et composants Epic
- StoryView et composants Story
- SubtaskView intégré dans TaskView
- HierarchyBreadcrumb pour navigation
- DependencyVisualization pour dépendances
- Extension Drag&Drop pour tous niveaux
- Services frontend (epicService, storyService, etc.)
- Types TypeScript pour nouveaux niveaux

**Critères Acceptation:**
- Navigation fluide entre niveaux
- Drag&drop fonctionnel sur hiérarchie
- Visualisation claire des dépendances
- Performance UI maintenue

### EPIC 5 - Intégration & Validation Complète
**MVP:** ✅ true  
**Titre:** Intégration & Validation Complète  
**Objectif:** S'assurer que tout fonctionne ensemble parfaitement  

**Stories Estimées:**
- Tests end-to-end hiérarchie complète
- Validation intégration MCP avec IA
- Tests performance avec gros volumes
- Validation migration projets existants
- Documentation utilisateur finale
- Guide d'adoption progressive
- Rollback plan si problèmes

**Critères Acceptation:**
- Tous les tests passent
- IA utilise parfaitement le système
- Migration réussie sans perte
- Documentation complète