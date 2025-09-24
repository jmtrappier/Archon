# Plan Méthodique TRAXIS - Solo Dev

**Auteur:** Claude + User validation  
**Tags:** Planning, Methodology, Solo-Dev  
**Status:** draft  
**Version:** 1.0  
**Type:** guide  

## Principe Directeur
Approche méthodique adaptée solo dev / petite équipe - PAS de réunions, PAS de processus lourds

## Principes Solo Dev
- Pas de réunions - validation directe par implémentation
- Documentation technique au fur et à mesure
- Tests continus - pas de phase séparée
- Itérations courtes avec validation rapide
- Focus sur fonctionnalité plutôt que processus

## Objectif MVP
Structure hiérarchique PROJET → EPIC → STORY → TASK → SUBTASK + gestion des dépendances

## Phases

### Phase 1 - Fondations (2-3 semaines)

#### Étape 1.1 - Analyse Code Archon (1 semaine)
**Focus:**
- Architecture backend (services, APIs, BDD)
- Système MCP actuel (tools, fonctions disponibles)
- Interface frontend (composants, état, navigation)
- Gestion des tâches existante (parent_task_id, états)
- Communication Socket.IO temps réel

**Livrable:** Document technique détaillé avec points d'extension

#### Étape 1.2 - Conception Architecture Hiérarchique (1 semaine)
**Focus:**
- Schéma BDD pour EPICs, STORIEs, SUBTASKs
- Relations et dépendances entre niveaux
- Évolution du MCP pour supporter hiérarchie
- Calcul d'avancement automatique
- Migration données existantes

**Livrable:** Schéma BDD + spécifications MCP étendues

**Objectif:** Comprendre et étendre la base existante

### Phase 2 - Implementation (4-5 semaines)

#### Étape 2.1 - Backend Hiérarchique (2 semaines)
**Focus:**
- Services Epic/Story/Subtask
- APIs REST étendues
- Gestion des dépendances
- Calcul avancement automatique
- Tests backend

**Livrable:** Backend fonctionnel avec hiérarchie

#### Étape 2.2 - MCP Étendu (1 semaine)
**Focus:**
- Tools MCP pour EPICs, STORIEs, SUBTASKs
- Fonctions de navigation hiérarchique
- Gestion dépendances via MCP
- Tests intégration IA

**Livrable:** MCP permettant gestion hiérarchique complète

#### Étape 2.3 - Interface Hiérarchique (2 semaines)
**Focus:**
- Navigation entre niveaux
- Affichage des relations/dépendances
- Drag & drop adapté à la hiérarchie
- Visualisation avancement

**Livrable:** Interface permettant gestion fluide des 4 niveaux

**Objectif:** Implémenter la hiérarchie de base

### Phase 3 - Raffinement (2-3 semaines)

#### Étape 3.1 - Migration & Tests (1 semaine)
**Focus:**
- Migration projets existants
- Tests end-to-end
- Performance avec hiérarchie
- Validation MCP avec IA

#### Étape 3.2 - Documentation & Finition (1 semaine)
**Focus:**
- Documentation utilisateur
- Documentation MCP pour IA
- Guide migration projets
- Optimisations finales

**Objectif:** Finalisation MVP

## Prochaine Étape
Commencer analyse code Archon (Étape 1.1)

## Critères de Validation

### Phase 1
- Compréhension complète architecture existante
- Schéma BDD validé et cohérent
- Spécifications MCP claires et complètes

### Phase 2
- Hiérarchie fonctionnelle à 4 niveaux
- Dépendances gérées correctement
- MCP permettant usage IA optimal
- Interface navigation fluide

### Phase 3
- Migration sans perte de données
- Performance maintenue
- Documentation complète
- IA peut utiliser parfaitement le système