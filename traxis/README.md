# TRAXIS - Task Relations Agents eXecution Independent System

**Version**: 1.0
**Objectif**: Transformer Archon pour supporter la méthodologie BMAD avec hiérarchie PROJET → EPIC → STORY → TASK → SUBTASK + gestion des dépendances
**Approche**: Solo dev, développement itératif, validation IA continue

## 🎯 Vision

TRAXIS étend Archon pour supporter une hiérarchie complète de gestion de projet avec :
- **4 niveaux hiérarchiques** : EPIC → STORY → TASK → SUBTASK
- **Gestion des dépendances** entre tous les niveaux
- **Intégration MCP optimisée** pour usage IA
- **Interface utilisateur fluide** pour navigation hiérarchique
- **Calcul automatique d'avancement** basé sur les sous-éléments

## 📋 EPICs Principales

### Epic 1 - Base de Données Hiérarchique (MVP)
**Objectif**: Créer la structure BDD pour supporter la hiérarchie BMAD
- Nouvelles tables : `archon_epics`, `archon_stories`, `archon_subtasks`
- Extension : `archon_tasks` (ajout `story_id`)
- Dépendances : `archon_dependencies`
- Migration données existantes

### Epic 2 - Services Backend Hiérarchiques (MVP)
**Objectif**: Étendre l'architecture backend pour supporter tous les niveaux BMAD
- Services : EpicService, StoryService, SubtaskService, DependencyService
- APIs REST complètes pour tous niveaux
- Calcul automatique d'avancement
- États étendus (`waiting_validation`)

### Epic 3 - Extension MCP pour Hiérarchie (MVP)
**Objectif**: Permettre aux IA d'utiliser parfaitement la hiérarchie BMAD
- Tools MCP : `find_epics`, `manage_epic`, `find_stories`, `manage_story`, etc.
- Navigation : `get_hierarchy`, `manage_dependencies`
- Optimisations performance maintenues
- Documentation IA complète

### Epic 4 - Interface Utilisateur Hiérarchique (MVP)
**Objectif**: Interface fluide pour gérer la hiérarchie BMAD
- Vues : EpicView, StoryView, SubtaskView
- Navigation : HierarchyBreadcrumb
- Visualisation : DependencyGraph
- Drag & Drop étendu à tous niveaux

### Epic 5 - Intégration & Validation Complète (MVP)
**Objectif**: S'assurer que tout fonctionne ensemble parfaitement
- Tests end-to-end complets
- Validation intégration MCP avec IA
- Documentation utilisateur finale
- Plan de rollback

## 🚀 Approche Solo Dev

- **Durée par EPIC** : Une soirée intensive
- **Validation** : Test avec IA après chaque EPIC
- **Méthode** : Développement itératif, pas de délais farfelus
- **Documentation** : Continue dans ce dossier `traxis/`

## 📁 Structure Documentation

```
traxis/
├── README.md                 # Ce fichier - Vue d'ensemble
├── epics/                    # Détails de chaque EPIC
│   ├── epic-1-database.md
│   ├── epic-2-backend.md
│   ├── epic-3-mcp.md
│   ├── epic-4-frontend.md
│   └── epic-5-integration.md
├── specs/                    # Spécifications techniques
│   ├── database-schema.sql
│   ├── api-endpoints.md
│   └── mcp-tools.md
├── migration/                # Scripts et plans de migration
└── tests/                    # Stratégies de test
```

## 🔧 Architecture Existante (Points Forts)

- ✅ **Backend solide** : TaskService avec réordonnancement automatique
- ✅ **MCP optimisé** : Tools consolidés avec pagination
- ✅ **Frontend moderne** : Vertical slice React/TypeScript + TanStack Query
- ✅ **Base hiérarchique** : `parent_task_id` déjà présent dans `archon_tasks`
- ✅ **Gestion états robuste** : todo/doing/review/done avec validation

## 🎯 Points d'Extension Identifiés

1. **Structure Hiérarchique** : Extension de `parent_task_id` vers vraie hiérarchie
2. **Gestion États** : Ajout `waiting_validation`, validation par niveau
3. **Calcul Avancement** : Automatisation basée sur sous-éléments
4. **Gestion Dépendances** : Support dépendances inter-niveaux
5. **Extension MCP** : Nouveaux tools pour tous les niveaux
6. **Interface Frontend** : Navigation hiérarchique fluide

## 📈 État Actuel

- [x] Analyse architecture Archon complète
- [x] EPICs principaux définis
- [ ] STORIEs détaillées
- [ ] TASKs implémentation
- [ ] Développement itératif

---

*TRAXIS - Task Relations Agents eXecution Independent System*
*Développé dans le cadre de l'évolution d'Archon vers la méthodologie BMAD*