# CLAUDE.md - Instructions Unifiées Archon + BMAD

Ce fichier fournit les directives pour Claude Code lors du travail sur le projet Archon avec intégration de la méthodologie BMAD.

## RÈGLE CRITIQUE ARCHON-FIRST
**AVANT** toute autre action, pour TOUT scénario de gestion de tâches :

1. **VÉRIFIER** la disponibilité du serveur MCP Archon
2. **UTILISER** Archon comme système de gestion principal
3. **TodoWrite** uniquement pour suivi personnel APRÈS configuration Archon
4. **RETENIR** systématiquement le nom et l'ID du projet pour éviter les erreurs entre sessions

**VIOLATION** : Si vous utilisez TodoWrite en premier, vous violez cette règle. Arrêtez et recommencez avec Archon.

## Identification du Projet Archon

### Variables Critiques à Maintenir
```
PROJECT_NAME: "Archon - TRAXIS"
PROJECT_ID: a37b53ff-e647-44a4-998b-e920582ed376
GITHUB_REPO: "https://github.com/jmtrappier/Archon"
BRANCH="traxis"
```

**IMPÉRATIF** : Ces informations doivent être connues et utilisées dans CHAQUE session.

### Vérification d'Identité du Projet
```bash
# Toujours commencer par vérifier le projet actuel
archon:find_projects(project_id="[PROJECT_ID]")

# Ou rechercher par nom si ID inconnu
archon:find_projects(query="Archon BMAD Integration")
```

## Workflow BMAD-Archon Intégré

### Phase 1: Initialisation Projet
```bash
# 1. Créer ou identifier le projet Archon
archon:manage_project(
  action="create",
  title="Archon - TRAXIS",
  description="Fork d'Archon pour implémenter la hiérarchie PROJET > EPIC > STORY > TASK > SUBTASK",
  github_repo="https://github.com/jmtrappier/Archon.git",
  branch="traxis"
)

# 2. Sauvegarder PROJECT_ID pour usage futur
# Noter l'ID retourné dans vos règles internes
```

### Phase 2: Gestion des Features via Tags
**Règle de Tagging BMAD-Archon** :
- Format tag : `EPIC-[N]-[NOM]` (ex: "EPIC-1-BDD", "EPIC-2-API")
- Chaque STORY devient une task avec tag EPIC
- Granularité : STORY = TASK Archon
- Hiérarchie simulée via tags cohérents

```bash
# Création d'une task STORY avec tag EPIC
archon:manage_task(
  action="create",
  project_id="[PROJECT_ID]",
  title="[STORY_TITLE]",
  description="[STORY_DESCRIPTION avec critères acceptation]",
  feature="EPIC-1-BDD",  # TAG OBLIGATOIRE
  task_order=80,  # Priorité haute pour Epic 1
  status="todo"
)
```

### Phase 3: Mise à Jour Obligatoire Archon
**IMPÉRATIF** après chaque modification :

```bash
# Mise à jour statut task
archon:manage_task(
  action="update",
  task_id="[TASK_ID]",
  status="doing|review|done"
)

# Vérification état projet
archon:find_tasks(
  project_id="[PROJECT_ID]",
  filter_by="status",
  filter_value="doing"
)
```

## Méthodologie BMAD Adaptée

### Structure Hiérarchique Cible
```
PROJET: Archon BMAD Integration
├── EPIC-1-BDD: Base de Données Hiérarchique
│   ├── STORY: Migration schema existant
│   ├── STORY: Tables hiérarchiques EPIC/STORY
│   └── STORY: Interface API CRUD
├── EPIC-2-API: Extension API REST
│   └── [Stories à définir]
└── EPIC-3-UI: Interface Utilisateur
    └── [Stories à définir]
```

### Cycle de Développement BMAD-Archon

#### 1. Début de Session
```bash
# OBLIGATOIRE : Vérifier projet et tâches
archon:find_projects(project_id="[PROJECT_ID]")
archon:find_tasks(
  project_id="[PROJECT_ID]",
  filter_by="status",
  filter_value="todo",
  include_closed=false
)
```

#### 2. Recherche et Planification
```bash
# Recherche patterns architecturaux
archon:rag_search_knowledge_base(
  query="database hierarchical structure PostgreSQL",
  match_count=5
)

# Exemples de code spécifiques
archon:rag_search_code_examples(
  query="PostgreSQL parent child relationships",
  match_count=3
)
```

#### 3. Définition des Stories (Epic 1 Focus)

**Questions BMAD pour Epic 1-BDD** :
- Comment migrer les données existantes sans perte ?
- Quelle structure pour la compatibilité ascendante ?
- Comment gérer les relations parent-enfant existantes ?

**Stories Epic 1** :
1. **STORY-1.1** : Analyse schema actuel et plan migration
2. **STORY-1.2** : Création tables EPIC et STORY avec relations
3. **STORY-1.3** : Migration données existantes vers nouvelle hiérarchie
4. **STORY-1.4** : Tests intégrité référentielle
5. **STORY-1.5** : API CRUD pour nouvelles entités

#### 4. Exécution Task-Driven
```bash
# Avant chaque implémentation
archon:manage_task(
  action="update",
  task_id="[CURRENT_TASK_ID]",
  status="doing"
)

# Recherche spécifique à la tâche
archon:rag_search_code_examples(
  query="[specific implementation pattern]",
  match_count=3
)

# Après implémentation
archon:manage_task(
  action="update",
  task_id="[CURRENT_TASK_ID]",
  status="review"  # Pour validation utilisateur
)
```

## Principes de Développement Beta

### Règles Fondamentales
- **Déploiement local uniquement** - chaque utilisateur son instance
- **Pas de compatibilité ascendante** - suppression immédiate du code déprécié
- **Erreurs détaillées plutôt que échecs gracieux** - identifier et corriger rapidement
- **Casser pour améliorer** - itération rapide en beta

### Gestion des Erreurs

#### Échec Rapide et Bruyant
Ces erreurs doivent arrêter l'exécution immédiatement :
- Échecs de démarrage des services
- Configuration manquante
- Échecs de connexion base de données
- Erreurs d'authentification/autorisation
- Corruption ou erreurs de validation des données

#### Continuer avec Journalisation Détaillée
Ces opérations doivent continuer mais signaler les échecs :
- Traitement par lots
- Tâches en arrière-plan
- Événements WebSocket
- Fonctionnalités optionnelles

## Architecture du Projet

### Services
- **Frontend (port 3737)** : React + TypeScript + Vite + TailwindCSS
- **Serveur Principal (port 8181)** : FastAPI avec polling HTTP
- **Serveur MCP (port 8051)** : Serveur protocole MCP léger
- **Service Agents (port 8052)** : Agents PydanticAI
- **Base de Données** : Supabase (PostgreSQL + pgvector)

### Architecture Frontend Verticale (/features)
```
src/features/
├── ui/primitives/     # Composants Radix UI
├── projects/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   ├── types/
│   ├── tasks/         # Sous-feature tasks
│   └── documents/     # Sous-feature documents
```

## Commandes de Développement

### Frontend (archon-ui-main/)
```bash
npm run dev              # Serveur développement port 3737
npm run build            # Build production
npm run biome            # Vérifier répertoire features
npm run biome:fix        # Auto-correction
npm run test             # Tests en mode watch
```

### Backend (python/)
```bash
uv sync --group all      # Installer dépendances
uv run python -m src.server.main  # Serveur local 8181
uv run pytest           # Tous les tests
uv run ruff check --fix  # Auto-correction linting
```

### Workflows Rapides
```bash
make dev                 # Développement hybride
make dev-docker          # Mode Docker complet
make lint               # Linters frontend + backend
make test               # Tous les tests
```

## Outils MCP Disponibles

### Gestion des Connaissances
- `rag_search_knowledge_base` - Recherche dans la base de connaissances
- `rag_search_code_examples` - Trouver extraits de code
- `rag_get_available_sources` - Lister sources disponibles

### Gestion de Projet
- `find_projects` - Trouver projets (avec project_id pour spécifique)
- `manage_project` - Gérer projets (actions: "create", "update", "delete")

### Gestion des Tâches
- `find_tasks` - Trouver tâches (avec task_id pour spécifique)
- `manage_task` - Gérer tâches (actions: "create", "update", "delete")

### Gestion Documents
- `find_documents` - Trouver documents
- `manage_document` - Gérer documents

## Variables d'Environnement

Requis dans `.env` :
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here
```

Optionnel :
```bash
LOGFIRE_TOKEN=your-logfire-token
LOG_LEVEL=INFO
ARCHON_SERVER_PORT=8181
ARCHON_MCP_PORT=8051
ARCHON_UI_PORT=3737
```

## Standards de Qualité

### Frontend
- **TypeScript** : Mode strict, pas de implicit any
- **Biome** pour `/src/features/` : 120 caractères, guillemets doubles
- **ESLint** pour code legacy
- **Tests** : Vitest avec React Testing Library

### Backend
- **Python 3.12** avec longueur ligne 120 caractères
- **Ruff** pour linting
- **Mypy** pour vérification types
- **Pytest** pour tests avec support async

## Règles de Développement Solo

### Session de Travail Type
1. **Démarrage** : Vérifier projet et tâches Archon
2. **Recherche** : Patterns et exemples pour la tâche courante
3. **Implémentation** : Code basé sur recherche
4. **Mise à jour** : Statut tâche dans Archon
5. **Validation** : Tests et review

### Critères de Qualité Task
Chaque tâche doit respecter avant "done" :
- [ ] Implémentation suit les bonnes pratiques recherchées
- [ ] Code suit les guidelines du projet
- [ ] Considérations sécurité adressées
- [ ] Fonctionnalité de base testée
- [ ] Mise à jour Archon effectuée

### Notes Importantes
- Fonctionnalité projets optionnelle - toggle dans Settings UI
- Communication services via HTTP uniquement
- Polling HTTP gère toutes les mises à jour
- TanStack Query pour récupération données - PAS DE PROP DRILLING
- Architecture verticale dans `/features`

---
**RAPPEL CRITIQUE** : Toujours maintenir PROJECT_NAME et PROJECT_ID. Mise à jour obligatoire d'Archon après chaque modification. Focus Epic 1-BDD en priorité avec structure de tags cohérente.