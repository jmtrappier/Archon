# Codex Instructions — Source of Truth

Ce fichier est **l’unique référence** pour Codex dans ce repo.  
Toute directive contradictoire ailleurs (y compris `AGENTS.md`) est **supplantée** par ce document.

---

## RÈGLE CRITIQUE : ARCHON-FIRST
- Toute création, modification ou suivi de **projects, tasks, docs** doit passer par **MCP Archon**.  
- Interdiction de stocker ou maintenir des fichiers locaux de planification (stories, tasks, docs) dans le dépôt.  
- `/traxis` peut contenir des documents de support technique, jamais de planification.  

---

## MCP Obligatoires
- **archon** → gestion projet/tâches/docs (*primary authority*).  
- **serena** → mémoire projet / recherche codebase.  
- **playwright** → tests visuels UI (même si les scripts passent).  

### Politique réseau (Docker-only)
- Ne jamais coder/configurer d’URL en `localhost` ou `127.0.0.1`.  
- Les endpoints MCP et API **doivent** venir de variables d’environnement et cibler des **noms de services Docker**.  
- Si Codex tourne hors conteneur, exposer via reverse-proxy/Traefik et utiliser `${MCP_URL_*}`.  

---

## Configuration Codex (MCP)

```json
{
  "mcpServers": {
    "archon":     { "transport": "sse", "url": "${MCP_URL_ARCHON}" },
    "serena":     { "transport": "sse", "url": "${MCP_URL_SERENA}" },
    "playwright": { "transport": "sse", "url": "${MCP_URL_PLAYWRIGHT}" }
  }
}
```

### Variables d’environnement

```bash
# .env.example
MCP_URL_ARCHON=http://archon-mcp:8051/sse
MCP_URL_SERENA=http://serena-mcp:8061/sse
MCP_URL_PLAYWRIGHT=http://playwright-mcp:8071/sse
```

---

## Politique d’exécution Docker
- Toute exécution et tout test passent **uniquement via Docker**.  
- Jamais d’URL codée en dur (`localhost`/`127.0.0.1`).  
- Utiliser les services Docker (`archon-mcp`, `serena-mcp`, `playwright-mcp`) et les variables `${MCP_URL_*}`.  

---

## Flux de travail Codex

1. **Démarrage**  
   - Vérifier l’existence d’un projet via `archon.project.list`.  
   - Si aucun projet, créer via `archon.project.create`.  
   - Mémoriser `PROJECT_ID`.  

2. **Gestion**  
   - `archon.task.*` pour stories/tasks.  
   - `archon.doc.*` pour docs techniques.  
   - Toujours `list → get(fields)` avant `update`.  
   - **Jamais** de création/édition de fichiers locaux de planification.  

3. **Recherche codebase**  
   - Utiliser **Serena** (`serena.search`, `serena.symbols`).  

4. **Validation UI**  
   - Utiliser **Playwright** (`playwright.run`, `playwright.snapshot`).  

5. **Contextes longs**  
   - Si besoin, appeler `archon.context.summarize` pour résumer sans saturer le contexte.  

---

## Discipline agent
- **Toujours** passer par Archon → Serena → Playwright.  
- **Jamais** injecter de gros blocs de contexte ; utiliser `context.summarize`.  
- Utiliser `fields`/`range` pour limiter les réponses.  
- Pas d’ID inventés : `list/get` avant toute création ou mise à jour.  
- Chaque action doit rapprocher du livrable, en étapes courtes et vérifiables.  

---

## Exemple Compose (réseau MCP)

```yaml
networks:
  mcp:
    name: mcp_net

services:
  archon-mcp:
    image: your/archon-mcp:latest
    networks: [mcp]
    ports: ["8051:8051"]

  serena-mcp:
    image: your/serena-mcp:latest
    networks: [mcp]
    ports: ["8061:8061"]

  playwright-mcp:
    image: your/playwright-mcp:latest
    networks: [mcp]
    ports: ["8071:8071"]
```

---

## Style de sortie (hérité BMAD)
- Toujours structurer les réponses en étapes courtes.  
- **Clarifier l’objectif** (1–2 phrases) avant de proposer des actions.  
- **Lister les tool calls précis** nécessaires.  
- **Proposer les Next Best Actions** (≤3) puis s’arrêter.  
- Éviter la verbosité : résumer, pointer vers IDs, pas de copier-coller massif.  
