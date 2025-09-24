# EPIC-3-MCP Vision Redéfinie - Session Brainstorming 23/09

**Auteur:** Bob (Scrum Master) & User  
**Tags:** EPIC-3-MCP, Brainstorming, AOP, Vision, Redefinition  
**Status:** draft  
**Date:** 2025-09-23

## Session Info
- **Participants:** User, Bob (Scrum Master)
- **Session Type:** Brainstorming Redéfinition EPIC-3-MCP
- **Date:** 2025-09-23

## Contexte
- **Constat:** Le MCP est la raison d'être de TRAXIS, doit être exceptionnel, pas juste fonctionnel
- **Innovation Clé:** Introduction de l'AOP (Agent Operating Prompt) comme cerveau opérationnel
- **Problème Initial:** STORY 3.3 originale trop limitée - simple réalignement post-audit

## AOP Structure

### Role
Planner/Operator pour solo dev

### Contracts
- **Input:** api_version, context, scope, pagination
- **Output:** ok, errors[], meta.cursor, next_links[]
- **Idempotence:** Dry-run obligatoire pour bulk ops
- **Error Handling:** Retry si retriable, abort si conflict

### Objectifs
- Maintenir intégrité du graphe (no cycles)
- Résoudre blockers rapidement
- Maximiser progrès mesurable
- Actions idempotentes et réversibles

### Politiques
- **Iteration:** Mutation → Snapshot → Health check
- **Mutations:** Atomiques, dry-run obligatoire
- **Navigation:** Context-aware avec next_links
- **Diagnostics:** Read-only first avant toute mutation

## Nouvelle Structure EPIC-3

- **Story 3.1:** ✅ COMPLETED - Tools Hiérarchiques
- **Story 3.2:** ✅ COMPLETED - Navigation & Dépendances
- **Story 3.3:** 📝 REDÉFINIE - Context Awareness, Navigation & AOP
- **Story 3.4:** 🔮 FUTURE - Contextual Intelligence (reporté EPIC-6)
- **Story 3.5:** 🆕 CRÉÉE - Workflow Atoms (opérations atomiques safe)
- **Story 3.6:** 🆕 CRÉÉE - Query Intelligence (analytiques read-only)
- **Story 3.7:** 🆕 CRÉÉE - Progress Reporting (minimal mais essentiel)

## Estimations
- **Story 3.3:** 7-9h (AOP + tools)
- **Story 3.5:** 8-10h (4 workflow atoms)
- **Story 3.6:** 7-8h (6 tools analytiques)
- **Story 3.7:** 4-5h (3 tools reporting)
- **Total Epic 3:** ~30h pour version complète

## Decisions Prises

### Ordre Implementation
1. 3.3 avec AOP (fondation)
2. 3.6 Query Intelligence
3. 3.7 Progress Reporting
4. 3.5 Workflow Atoms

## Nouveaux MCP Tools

### Workflow Atoms
- bulk_update() avec dry-run
- apply_template() avec preview
- create_epic_with_stories() atomique
- reorganize_hierarchy() avec validation

### Context Navigation
- get_context() avec next_links
- suggest_next_actions() déterministe
- validate_operation() universel

### Progress Reporting
- get_progress_snapshot()
- get_epic_timeline()
- predict_completion()

### Query Intelligence
- analyze_project_health()
- find_bottlenecks()
- find_orphaned_items()
- find_stale_items()
- find_conflicting_dependencies()
- get_critical_path()

## Impact Attendu

### Pour Projet
MCP devient le vrai cerveau de TRAXIS, pas juste une interface

### Pour Agents IA
Transformation d'API basique en assistant intelligent avec guide opérationnel

### Pour Utilisateurs
Navigation fluide, suggestions pertinentes, opérations sécurisées

## Future Enhancements
- **Conditions:** Après 6 mois de données et EPIC-3 stable
- **Epic 6 Proposé:** MCP Contextual Intelligence avec ML
- **Features Futures:** ML predictions, Pattern recognition, Auto-optimization, Predictive analytics

## Citations Marquantes
- **Bob:** "Le MCP ne devrait pas juste refléter l'interface, il devrait être l'intelligence du système"
- **User:** "We need an Agent Operating Prompt - without it, even an intelligent MCP will be under-used"
- **Consensus:** "L'AOP transforme le MCP d'une simple API en système opérationnel intelligent"

## Prochaines Étapes
1. Implémenter STORY 3.3 avec AOP complet
2. Développer Query Intelligence pour alimenter l'AOP
3. Créer reporting minimal mais essentiel
4. Workflow atoms avec sécurité maximale