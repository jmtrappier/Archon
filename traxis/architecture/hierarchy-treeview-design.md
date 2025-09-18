# Story 4.20 – Hierarchy TreeView Design Plan

## 1. TreeView Foundation

### Option A – `react-dnd-treeview`
- **Pros**: fournit structure hiérarchique + drag & drop natif (hooks compatibles avec `react-dnd` v16 déjà utilisé), support clavier basique, gestion lazy loading via callbacks.
- **Cons**: dépendance supplémentaire (~6 kB gz), styling à redéfinir complètement pour coller au thème glassmorphism.

### Option B – Composant maison (Radix + virtualisation)
- **Pros**: contrôle total UX/UI, aucune dépendance nouvelle, intégration directe avec nos primitives (`Tree`, `Accordion`, `ContextMenu`, `Tooltip`).
- **Cons**: implémenter nous-mêmes le modèle arborescent, la navigation clavier, le drag & drop (à réutiliser via `@dnd-kit` ou `react-dnd`).

### Décision
- **Phase 1 (Story 4.20)** : implémentation maison sans drag & drop, en s’appuyant sur `@tanstack/react-virtual` pour la performance. Cela permet de respecter la charte graphique et de maîtriser le rendu hiérarchique.
- **Phase 2 (Story 4.21)** : ajouter le drag & drop en s’appuyant sur `@dnd-kit` (déjà présent via `HierarchicalDragDrop.tsx`). On évite d’introduire une nouvelle lib et on factorise la logique.

## 2. Architecture UI

```
src/features/projects/hierarchy/
├── components/
│   ├── HierarchyTree.tsx        # rendu récursif + virtualisation
│   ├── HierarchyNode.tsx        # carte individuelle (statut, badges, actions)
│   ├── HierarchyDetailsPanel.tsx
│   ├── HierarchyFilterBar.tsx
│   ├── ViewToggle.tsx           # bascule hiérarchie / dépendances
│   └── EmptyState.tsx
├── hooks/
│   ├── useHierarchyData.ts      # fetch TanStack Query
│   ├── useHierarchyFilters.ts   # state filtres (URL + context)
│   ├── useHierarchySelection.ts # sélection + panneau détails
│   └── useHierarchyLayouts.ts   # gestion persistance expansion
├── services/
│   ├── hierarchyService.ts      # appels API (GET /hierarchy, params depth/mode)
│   └── hierarchyTransforms.ts   # normalisation données → tree nodes
├── types/
│   └── hierarchy.ts             # interfaces (HierarchyNode, NodeMeta, DependencyInfo)
```

- **State management** : stocker filtres/expansions dans un contexte local synchronisé avec l’URL (`?view=tree&mode=dependencies&status=doing`).
- **Virtualisation** : utiliser `useVirtualizer` pour n’afficher que les nœuds visibles (objectif < 5 ms render pour 1000 nodes).
- **Accessibilité** : focus management (flèches ▲▼ pour navigation, ▶ expand, Enter sélection). Radix `Collapsible` + `RovingFocusGroup` pour se conformer aux patterns ARIA tree.

## 3. Expérience Utilisateur

### Vue Hiérarchie
- Liste verticale pliable : chaque niveau affiche code + titre + pastilles statut/ priorité / MVP.
- Icônes minimalistes (Lucide) pour différencier Epic/Story/Task/Subtask.
- Actions rapides dans un menu contextuel (`…`) : créer enfant, éditer, archiver (permissions existantes).
- Panneau latéral droite : détails, dépendances (extrait), boutons « Ouvrir Kanban Stories/Tasks ».

### Vue Dépendances
- Même structure mais tri topologique (parents avant enfants, alertes si cycle).
- Badges rouges « Bloqué par X », orange « Bloque Y ».
- Bannière en haut du panneau détails listant dépendances triées + CTA « Voir dépendance ».

### Filtres
- Barre supérieure : statut (checkbox multi), priorité, assignee, MVP flag, recherche titre/code.
- Mode « masquer » vs « atténuer » (toggle). Les éléments atténués restent interactifs mais à 40% d’opacité.

## 4. Plan de Livraison

1. **Story 4.20 (courant)**
   - Implémenter data fetching + normalisation.
   - Rendu TreeView sans drag & drop.
   - Panneau détails + filtres + toggle dépendances.
   - Tests unitaires (hooks, composants clefs) + integration (navigation) + a11y (axe-core).

2. **Story 4.21**
   - Étendre `HierarchyTree` avec `useHierarchyDragDrop` (à créer) + API reorder.
   - Gérer validations + audit trail.

3. **Story 4.22**
   - Ajouter badges dépendances + panneau enrichi + mode analyse.
   - Cycle detection côté backend + UI.

4. **Story 4.23**
   - Kanbans contextualisés (hook Tree→Kanban, layout commun).

## 5. Tests & Monitoring
- **Unit** : hooks (fetch/filters/selection), `HierarchyNode` (statut, badges).
- **Integration** : interactions clavier, expansion, bascule hiérarchie↔dépendances.
- **Performance** : profiler sur 1 000 nœuds (cible < 16 ms frame).
- **A11y** : axe-core + navigation clavier (flèches, entrée, espace).
- **Observabilité** : log events `hierarchy_load_error`, `hierarchy_partial_data`, `hierarchy_node_select` via Logfire si configuré.

---
_Mise à jour : 2025-09-18_
