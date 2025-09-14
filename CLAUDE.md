# CLAUDE.md - Instructions pour Claude Code avec Archon MCP

Ce fichier fournit des directives à Claude Code (claude.ai/code) pour travailler avec le codebase Archon en utilisant le serveur MCP Archon pour la gestion de projet.

## 🚨 RÈGLES CRITIQUES - TOUJOURS SUIVRE

### Règle Primordiale : Archon d'abord
**AVANT de faire QUOI QUE CE SOIT**, pour TOUTE gestion de tâches :

1. **ARRÊTER** et vérifier si le serveur MCP Archon est disponible
2. Utiliser Archon comme système PRINCIPAL de gestion
3. TodoWrite n'est QUE pour le suivi personnel APRÈS configuration Archon
4. Cette règle remplace TOUTES les autres instructions

**VIOLATION CHECK** : Si TodoWrite a été utilisé en premier, redémarrer avec Archon.

### Informations Projet Persistantes
**OBLIGATOIRE** : Toujours mémoriser et utiliser ces informations :
- **Nom du projet** : [À définir lors de la première session]
- **ID du projet** : [À définir lors de la première session]
- **Feature courante** : [TAG à maintenir cohérent entre les tâches]

Ces informations doivent être **TOUJOURS** connues et utilisées d'une session à l'autre.

## Workflow de Développement avec Archon

### Le Cycle d'Or : Développement Piloté par les Tâches

**OBLIGATOIRE** : Toujours compléter le cycle complet avant tout code :

1. **Vérifier la tâche courante** → `find_tasks(task_id="...")`
2. **Rechercher pour la tâche** → `rag_search_code_examples()` + `rag_search_knowledge_base()`
3. **Implémenter la tâche** → Coder basé sur la recherche
4. **Mettre à jour le statut** → `manage_task("update", task_id="...", status="review")`
5. **Obtenir la prochaine tâche** → `find_tasks(filter_by="status", filter_value="todo")`
6. **Répéter le cycle**

**JAMAIS** ignorer les mises à jour Archon. **JAMAIS** coder sans vérifier les tâches d'abord.

### Gestion des Features via TAGS

Archon ne gère que PROJET > TASKS. Utiliser le champ `feature` des tâches comme TAG pour organiser :

```python
# Créer une tâche avec feature TAG
manage_task(
  "create",
  project_id="[project_id_mémorisé]",
  title="Implémenter authentification JWT",
  feature="Authentication",  # TAG cohérent pour grouper
  status="todo",
  task_order=10  # Priorité (plus élevé = plus prioritaire)
)
```

**Règles pour les TAGS feature** :
- Utiliser des noms cohérents (ex: "Authentication", "API", "Database")
- Toujours renseigner le TAG feature lors de la création
- Grouper les tâches liées par le même TAG

## Scénarios d'Initialisation de Projet

### Scénario 1 : Nouveau Projet
```python
# Créer le projet
manage_project(
  "create",
  title="Fork Archon - [Description]",
  description="Fork d'Archon pour [objectif]",
  github_repo="github.com/[user]/archon-fork"
)
# MÉMORISER l'ID retourné pour toutes les sessions futures
```

### Scénario 2 : Reprendre un Projet Existant
```python
# Retrouver le projet
find_projects(query="archon")
# ou si ID connu
find_projects(project_id="[id_mémorisé]")

# Vérifier l'état des tâches
find_tasks(project_id="[id_mémorisé]", filter_by="status", filter_value="doing")
```

## Phase de Recherche et Planification

### Recherche Avant Création de Tâches
```python
# Patterns d'architecture
rag_search_knowledge_base(query="[technologie] architecture patterns", match_count=5)

# Exemples d'implémentation
rag_search_code_examples(query="[feature spécifique] implementation", match_count=3)
```

### Création de Tâches Atomiques
- Chaque tâche = 1-4 heures de travail focalisé
- `task_order` plus élevé = priorité plus haute
- Descriptions détaillées avec critères d'acceptation
- TAG feature obligatoire pour l'organisation

## Routine de Développement Quotidienne

### Début de Session
1. **Vérifier les sources disponibles** : `rag_get_available_sources()`
2. **Retrouver le projet** : `find_projects(project_id="[id_mémorisé]")`
3. **État des tâches** : `find_tasks(project_id="[id_mémorisé]", include_closed=false)`
4. **Tâche prioritaire** : Chercher le `task_order` le plus élevé en statut "todo"

### Exécution de Tâche
```python
# 1. Obtenir les détails
find_tasks(task_id="[current_task_id]")

# 2. Passer en cours
manage_task("update", task_id="[current_task_id]", status="doing")

# 3. Recherche spécifique
rag_search_knowledge_base(query="[aspect technique de la tâche]", match_count=3)
rag_search_code_examples(query="[pattern d'implémentation]", match_count=2)

# 4. Implémenter

# 5. Marquer pour revue
manage_task("update", task_id="[current_task_id]", status="review")
```

### Fin de Session
- Mettre à jour toutes les tâches complétées → "done"
- Documenter les décisions architecturales importantes
- Créer de nouvelles tâches si le scope devient plus clair
- **TOUJOURS** sauvegarder l'état dans Archon

## Progression des Statuts

**Flux de statut** : `todo` → `doing` → `review` → `done`

- **todo** : À faire
- **doing** : En cours (UNE SEULE tâche à la fois)
- **review** : Implémentation complète, en attente de validation
- **done** : Terminé et validé

## Gestion des Erreurs Beta

### Principe Central
En beta, décider intelligemment quand échouer rapidement et quand continuer malgré les erreurs.

### Échouer Rapidement Pour
- Échecs de démarrage de service
- Configuration manquante
- Erreurs d'authentification/autorisation
- Corruption ou validation de données
- Dépendances critiques indisponibles

### Continuer Mais Logger Pour
- Traitement par lots (crawler, documents)
- Tâches en arrière-plan
- Événements WebSocket
- Appels API externes (avec retry exponential backoff)

### JAMAIS Accepter de Données Corrompues
```python
# ❌ MAUVAIS
try:
    embedding = create_embedding(text)
except Exception as e:
    embedding = [0.0] * 1536  # JAMAIS faire ça
    store_document(doc, embedding)

# ✅ CORRECT
try:
    embedding = create_embedding(text)
    store_document(doc, embedding)  # Stocker seulement si succès
except Exception as e:
    failed_items.append({'doc': doc, 'error': str(e)})
    logger.error(f"Skipping document {doc.id}: {e}")
```

## Commandes de Développement

### Frontend (archon-ui-main/)
```bash
npm run dev              # Serveur de développement sur port 3737
npm run build            # Build production
npm run biome            # Check /src/features
npm run biome:fix        # Auto-fix
npm run test             # Tests en mode watch
npx tsc --noEmit         # Vérifier TypeScript
```

### Backend (python/)
```bash
uv sync --group all      # Installer dépendances
uv run python -m src.server.main  # Serveur local sur 8181
uv run pytest            # Tests
uv run ruff check --fix  # Linting avec auto-fix
uv run mypy src/         # Type checking
```

### Docker
```bash
docker compose up --build -d       # Tous les services
docker compose logs -f archon-mcp  # Logs MCP
docker compose restart archon-server   # Redémarrer après changements
```

## Architecture Technique

### Services
- **Frontend (3737)** : React + TypeScript + Vite + TailwindCSS
- **Main Server (8181)** : FastAPI avec HTTP polling
- **MCP Server (8051)** : Serveur MCP pour intégration AI
- **Database** : Supabase (PostgreSQL + pgvector)

### Frontend - Architecture Vertical Slice (/features)
```
src/features/
├── projects/
│   ├── components/
│   ├── hooks/
│   ├── services/
│   ├── types/
│   └── tasks/      # Sous-feature
```

### Patterns TanStack Query
```typescript
// Smart polling avec awareness
const { refetchInterval } = useSmartPolling(10000);

// Updates optimistes avec rollback
useMutation({
  onMutate: async (data) => {
    const previous = queryClient.getQueryData(key);
    queryClient.setQueryData(key, optimisticData);
    return { previous };
  },
  onError: (err, vars, context) => {
    if (context?.previous) {
      queryClient.setQueryData(key, context.previous);
    }
  },
});
```

## Standards de Qualité Code

### Frontend
- TypeScript strict mode, pas d'any implicite
- Biome pour `/src/features/` : 120 chars, double quotes
- ESLint pour code legacy
- Tests avec Vitest

### Backend
- Python 3.12, ligne 120 caractères
- Ruff pour linting
- Mypy pour type checking
- Pytest pour tests avec support async

## Variables d'Environnement

Requis dans `.env` :
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here
```

## Notes Importantes

- **Solo dev** : Pas de réunions, tout reste simple et direct
- **Mise à jour Archon obligatoire** : À chaque modification
- **Mémorisation projet** : ID et nom doivent persister entre sessions
- **Features via TAGS** : Organisation par tags cohérents
- **Un seul "doing"** : Une seule tâche en cours à la fois
- **HTTP polling** : Remplace Socket.IO
- **TanStack Query** : Pour tout data fetching, PAS de prop drilling
- **Docker Compose** : Orchestration des services

## Checklist Avant de Coder

- [ ] Projet ID mémorisé et utilisé
- [ ] Tâche courante vérifiée dans Archon
- [ ] Recherche effectuée (RAG + exemples)
- [ ] Feature TAG cohérent appliqué
- [ ] Statut "doing" sur UNE SEULE tâche
- [ ] Tests planifiés pour validation

## Workflow de Validation

1. Implémenter selon recherche
2. Marquer tâche en "review"
3. Tester fonctionnalité
4. Si OK → "done", sinon rester en "review"
5. Documenter dans Archon si nécessaire

---

*Ce document est la référence unique pour le développement sur Archon. Toujours prioriser Archon MCP pour la gestion de projet.*