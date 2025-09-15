# Project Brief: Transformation d'Archon avec Intégration BMAD

**Date:** 2024-12-19  
**Version:** 1.0  
**Statut:** Draft  
**Responsable:** Business Analyst Mary  

---

## 🎯 Objectif du Projet

Transformer Archon pour intégrer la méthodologie BMAD (Business Model Architecture Design) avec sa hiérarchie EPIC → STORY → TASK → SUBTASK, permettant de remplacer les fichiers structurés par une gestion dynamique via MCP et d'enrichir les règles IA avec les pratiques BMAD.

---

## 📋 Scope du Projet

### Inclus dans le Scope

**Phase 1 - MVP (Priorité #1)**
- Structure hiérarchique de base : PROJET → EPIC → STORY → TASK → SUBTASK
- Gestion des états et dépendances entre niveaux
- Interface de navigation hiérarchique
- Calcul automatique de l'avancement basé sur les sous-éléments
- Validation utilisateur obligatoire à chaque niveau

**Phase 2 - Évolutions (Futur)**
- Intégration MCP/IA BMAD complète
- Support LLMs locaux (vLLM, llama.cpp, LiteLLM)
- Personas adaptatifs BMAD + PRP
- Intelligence BMAD intégrée

### Exclu du Scope

- Personas adaptatifs complexes (phase 3)
- Validation automatique intelligente (phase 3)
- Migration automatique des projets existants (à définir)

---

## 🏗️ Architecture Actuelle d'Archon

### Structure de Base de Données
- **Table principale :** `archon_tasks` avec relation parent-enfant (`parent_task_id`)
- **États actuels :** `todo`, `doing`, `review`, `done`
- **Structure :** Projet → Tâches (niveau unique)

### Services Backend
- **TaskService :** Gestion des tâches avec validation d'états
- **ProjectService :** Gestion des projets
- **MCP Service :** Interface pour les assistants IA

### Interface Frontend
- **ProjectPage :** Interface principale de gestion des projets
- **TasksTab :** Gestion des tâches avec drag & drop
- **Architecture :** React + TypeScript + Tailwind CSS

---

## 🎯 Objectifs Spécifiques

### Objectif Principal
Remplacer la gestion actuelle basée sur des fichiers structurés par une gestion dynamique via MCP avec support de la hiérarchie BMAD.

### Objectifs Spécifiques
1. **Hiérarchie à 4 niveaux :** PROJET → EPIC → STORY → TASK → SUBTASK
2. **Gestion des états :** États existants + "Waiting for validation"
3. **Navigation fluide :** Interface permettant de naviguer entre les niveaux
4. **Calcul d'avancement :** Automatique basé sur les sous-éléments
5. **Validation utilisateur :** Obligatoire à chaque niveau
6. **Support LLMs locaux :** Pour optimiser les coûts API

---

## 📊 Contraintes et Hypothèses

### Contraintes Techniques
- **Base de données :** PostgreSQL avec Supabase
- **Architecture existante :** Microservices Docker
- **Interface :** React/TypeScript
- **MCP :** Protocol existant à étendre

### Contraintes Fonctionnelles
- **Validation utilisateur :** Toujours obligatoire
- **Compatibilité :** Maintenir la compatibilité avec l'existant
- **Performance :** Pas de dégradation significative
- **Simplicité :** Éviter la sur-complexité

### Hypothèses
- Les utilisateurs accepteront la migration vers la nouvelle structure
- Les LLMs locaux seront suffisamment performants
- L'approche MVP sera suffisante pour les premiers utilisateurs

---

## 🚀 Livrables

### Phase 1 - MVP
1. **Schéma de base de données étendu**
   - Tables : `archon_epics`, `archon_stories`, `archon_tasks`, `archon_subtasks`
   - Relations parent-enfant claires
   - Gestion des états et dépendances

2. **Services backend mis à jour**
   - EpicService, StoryService, SubtaskService
   - Calcul automatique de l'avancement
   - Gestion des dépendances

3. **Interface utilisateur hiérarchique**
   - Navigation entre niveaux
   - Affichage des relations parent-enfant
   - Gestion des états par niveau

4. **Tests et documentation**
   - Tests unitaires et d'intégration
   - Documentation technique et utilisateur

### Phase 2 - Évolutions
1. **Intégration MCP/IA BMAD**
2. **Support LLMs locaux**
3. **Personas adaptatifs**

---

## ⏱️ Timeline et Jalons

### Phase 1 - MVP (8-10 semaines)

**Semaine 1-2 :** Analyse complète du code Archon
- Analyse de la structure existante
- Identification des points d'extension
- Documentation de l'architecture actuelle

**Semaine 3-4 :** Conception du schéma de base de données
- Design des nouvelles tables
- Migration des données existantes
- Tests de performance

**Semaine 5-7 :** Développement backend
- Services Epic, Story, Subtask
- Gestion des états et dépendances
- Tests unitaires

**Semaine 8-10 :** Développement frontend
- Interface de navigation hiérarchique
- Gestion des états par niveau
- Tests d'intégration

### Phase 2 - Évolutions (À définir)
- Intégration MCP/IA BMAD : 4-6 semaines
- Support LLMs locaux : 2-3 semaines
- Personas adaptatifs : 3-4 semaines

---

## 👥 Équipe et Rôles

### Équipe Technique
- **Architecte technique :** Conception de l'architecture
- **Développeur backend :** Services et base de données
- **Développeur frontend :** Interface utilisateur
- **DevOps :** Déploiement et infrastructure

### Équipe Produit
- **Product Owner :** Définition des priorités
- **Business Analyst :** Analyse des besoins et tests
- **UX Designer :** Conception de l'interface

---

## 💰 Budget et Ressources

### Ressources Techniques
- **Développement :** 8-10 semaines homme
- **Tests :** 2-3 semaines homme
- **Documentation :** 1 semaine homme

### Infrastructure
- **Base de données :** Extension des tables existantes
- **Serveurs :** Utilisation de l'infrastructure existante
- **LLMs locaux :** Serveurs supplémentaires pour vLLM/llama.cpp

---

## 🎯 Critères de Succès

### Critères Fonctionnels
- [ ] Hiérarchie à 4 niveaux fonctionnelle
- [ ] Navigation fluide entre les niveaux
- [ ] Calcul automatique de l'avancement
- [ ] Validation utilisateur obligatoire
- [ ] Gestion des dépendances

### Critères Techniques
- [ ] Performance maintenue ou améliorée
- [ ] Tests de régression passants
- [ ] Documentation complète
- [ ] Migration des données réussie

### Critères Business
- [ ] Remplacement des fichiers structurés
- [ ] Adoption par les utilisateurs existants
- [ ] Réduction des coûts API via LLMs locaux

---

## 🚨 Risques et Mitigations

### Risques Techniques
- **Complexité de la migration :** Analyse approfondie préalable
- **Performance dégradée :** Tests de charge et optimisation
- **Incompatibilité MCP :** Tests d'intégration précoces

### Risques Fonctionnels
- **Rejet par les utilisateurs :** Tests utilisateur précoces
- **Sur-complexité :** Approche MVP stricte
- **Dépendances non gérées :** Validation utilisateur obligatoire

### Risques Business
- **Délais dépassés :** Approche itérative
- **Coûts LLMs :** Support local prioritaire
- **Adoption lente :** Formation et documentation

---

## 📈 Métriques de Succès

### Métriques Techniques
- Temps de réponse de l'interface < 2 secondes
- Taux d'erreur < 1%
- Couverture de tests > 80%

### Métriques Fonctionnelles
- Utilisation de la hiérarchie par 80% des projets
- Réduction de 50% des fichiers structurés
- Satisfaction utilisateur > 4/5

### Métriques Business
- Réduction de 30% des coûts API
- Adoption par 60% des utilisateurs existants
- Temps de création de projet réduit de 40%

---

## 📝 Prochaines Étapes

1. **Validation du brief** par les parties prenantes
2. **Analyse technique détaillée** du code Archon
3. **Conception de l'architecture** détaillée
4. **Planification des sprints** et allocation des ressources
5. **Démarrage du développement** Phase 1

---

*Document créé dans le cadre de la méthodologie BMAD-METHOD™*
