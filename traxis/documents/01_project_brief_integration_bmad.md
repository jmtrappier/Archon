# Project Brief - Intégration BMAD

**Auteur:** Business Analyst Mary  
**Tags:** BMAD, Architecture, MVP  
**Status:** draft  
**Version:** 1.0  
**Type:** spec  

## Objectif

Transformer Archon pour intégrer la méthodologie BMAD avec hiérarchie EPIC → STORY → TASK → SUBTASK

## Scope

### Phase 1 MVP
- Structure hiérarchique de base : PROJET → EPIC → STORY → TASK → SUBTASK
- Gestion des états et dépendances entre niveaux
- Interface de navigation hiérarchique
- Calcul automatique de l'avancement basé sur les sous-éléments
- Validation utilisateur obligatoire à chaque niveau

### Phase 2 Evolutions
- Intégration MCP/IA BMAD complète
- Support LLMs locaux (vLLM, llama.cpp, LiteLLM)
- Personas adaptatifs BMAD + PRP
- Intelligence BMAD intégrée

## Critères de Succès
- Hiérarchie à 4 niveaux fonctionnelle
- Navigation fluide entre les niveaux
- Calcul automatique de l'avancement
- Validation utilisateur obligatoire
- Gestion des dépendances

## Timeline Phase 1
8-10 semaines

## Risques Identifiés
- Complexité de la migration
- Performance dégradée
- Incompatibilité MCP
- Rejet par les utilisateurs

## Architecture Actuelle
- **Frontend:** React + TypeScript + Tailwind CSS
- **Services:** TaskService, ProjectService, MCP Service
- **Communication:** Socket.IO temps réel
- **Structure BDD:** Table archon_tasks avec parent_task_id existant