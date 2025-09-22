# Guide de Configuration des Dépendances - TRAXIS

## 🎯 Comment Configurer les Relations entre Éléments

### Scénario 1: Story qui dépend de la validation d'une autre

**Exemple :** "Story B - Implémentation" dépend de "Story A - Spécification"

1. **Ouvrir TreeView** avec visualisation des dépendances
2. **Sélectionner "Story B - Implémentation"**
3. **Cliquer "Add" dans le panneau de droite**
4. **Configurer la relation :**
   - **Target**: "Story A - Spécification"
   - **Type**: "depends_on"
   - **Description**: "Besoin des spécifications validées avant implémentation"

**Résultat :** Story B affichera un badge "→1" (bloquée par 1 item) et ne pourra pas démarrer tant que Story A n'est pas "done".

### Scénario 2: Epic Foundation qui bloque d'autres Epics

**Exemple :** "Epic - Infrastructure" bloque "Epic - Features"

1. **Sélectionner "Epic - Infrastructure"**
2. **Cliquer "Add"**
3. **Configurer :**
   - **Target**: "Epic - Features"
   - **Type**: "blocks"
   - **Description**: "L'infrastructure doit être en place avant les features"

**Résultat :** Epic Infrastructure affichera "←1" (bloque 1 item) et Epic Features sera marqué comme dépendant.

### Scénario 3: Task qui attend validation d'une Story

**Exemple :** "Task - Développement API" dépend de "Story - Design API"

1. **Sélectionner "Task - Développement API"**
2. **Ajouter dépendance :**
   - **Target**: "Story - Design API"
   - **Type**: "depends_on"
   - **Description**: "Besoin du design validé avant développement"

### Scénario 4: Subtask qui dépend d'une autre Task

**Exemple :** "Subtask - Tests" dépend de "Task - Code"

1. **Sélectionner "Subtask - Tests"**
2. **Configurer :**
   - **Target**: "Task - Code"
   - **Type**: "depends_on"

## 🔍 Interface de Configuration

### Modal de Création de Dépendance

```
┌─────────────────────────────────────────────┐
│ Add Dependency                              │
├─────────────────────────────────────────────┤
│ From: Story B - Implémentation              │
│                                             │
│ ✨ Suggestions:                             │
│ → Story A - Spécification (depends_on) 85% │
│ → Epic - Foundation (related_to) 72%       │
│                                             │
│ Target: [Search...] Story A - Spec...       │
│                                             │
│ Relationship Type:                          │
│ ○ Depends on (ne peut commencer avant)     │
│ ○ Blocks (empêche la cible)                │
│ ○ Related to (lien informatif)             │
│                                             │
│ Description: (optionnel)                    │
│ Besoin des spécifications validées...      │
│                                             │
│ [Cancel] [Create Dependency]                │
└─────────────────────────────────────────────┘
```

### Panneau de Visualisation

```
┌─────────────────────────────────────────────┐
│ Dependencies - Story B                      │ [Add]
├─────────────────────────────────────────────┤
│                                             │
│ → Incoming (1)                              │
│ ┌─────────────────────────────────────────┐ │
│ │ → depends_on                            │ │
│ │   Epic: Story A - Spécification         │ │
│ │   Status: Active                        │→│
│ └─────────────────────────────────────────┘ │
│                                             │
│ ← Outgoing (0)                              │
│ ┌─────────────────────────────────────────┐ │
│ │ No outgoing dependencies                │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ⚡ 1 total                                  │
└─────────────────────────────────────────────┘
```

## 🎨 Indicateurs Visuels

### Badges sur les Nœuds
- **←2** = Bloque 2 éléments (orange)
- **→3** = Bloqué par 3 éléments (rouge)
- **🔗1** = 1 relation informative (bleu)
- **⚠️** = Conflit détecté (orange)
- **🔄** = Dans un cycle (rouge)

### Mode Analyse
Activez le toggle **"Analysis"** pour :
- **Réorganisation topologique** automatique
- **Détection de cycles** avec alertes
- **Ordre optimal** de traitement

## 📋 Cas d'Usage Typiques

### Gestion de Projet Classique
```
Epic A (Infrastructure) blocks Epic B (Features)
├─ Story A1 (Database) blocks Story B1 (User API)
├─ Story A2 (Auth) blocks Story B2 (User Interface)
└─ Task A1.1 (Schema) depends_on Story A1 (Database)
```

### Validation en Cascade
```
Story Spec depends_on Epic Requirements
├─ Task Design depends_on Story Spec
├─ Task Implementation depends_on Task Design
└─ Task Testing depends_on Task Implementation
```

### Relations Parallèles
```
Epic Frontend related_to Epic Backend
├─ Story UI related_to Story API
└─ Task Components depends_on Task API endpoints
```

## 🚀 Actions Rapides

### Navigation
- **Clic sur une dépendance** → Navigation automatique vers la cible
- **Breadcrumb étendu** → Chemin complet dans la hiérarchie

### Gestion
- **Validation automatique** → Prévention des cycles
- **Suggestions IA** → Relations recommandées
- **Recherche intelligente** → Trouve rapidement les cibles

### Filtres
- **"Blocked"** → Voir seulement les éléments bloqués
- **"Blocking"** → Voir seulement les éléments bloquants
- **"No deps"** → Voir les éléments sans dépendances

## ⚡ Bonnes Pratiques

1. **Utilisez "depends_on"** pour les vraies dépendances de workflow
2. **Utilisez "blocks"** quand un élément empêche activement un autre
3. **Utilisez "related_to"** pour les liens informatifs
4. **Évitez les cycles** - l'outil les détectera automatiquement
5. **Ajoutez des descriptions** pour clarifier le contexte
6. **Vérifiez le mode Analysis** régulièrement pour optimiser l'ordre

## 🔧 APIs pour Intégration

Si vous voulez scripter la création de dépendances :

```typescript
// Créer une dépendance via API
POST /api/dependencies
{
  "from_type": "story",
  "from_id": "story-123",
  "to_type": "story",
  "to_id": "story-456",
  "dependency_type": "depends_on",
  "description": "Story B dépend de la validation de Story A"
}

// Vérifier les cycles
GET /api/projects/{id}/dependencies/circular

// Lister les dépendances d'un projet
GET /api/projects/{id}/dependencies
```