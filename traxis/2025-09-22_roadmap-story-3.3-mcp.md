# Roadmap STORY 3.3 - Redéfinition MCP Functions Post-Audit

**Date** : 22 septembre 2025
**Session** : Point de départ pour développement Story 3.3
**Objectif** : Réalignement MCP avec corrections UX critiques

---

## 📊 État Actuel du Projet

### ✅ **Accomplissements Session du 22/09**
- **STORY 5.1 TERMINÉE** - Infrastructure E2E complète avec nettoyage automatique
- **67 tests E2E** opérationnels avec reporting avancé
- **Corrections critiques** suite feedback utilisateur (nettoyage données test)
- **Commit** `ffce4dc` - Branche `traxis` à jour

### 🎯 **Prochaine Priorité Identifiée**
**STORY 3.3** - Redéfinition MCP Functions post-audit (`task_order: 95`)

---

## 🔍 Plan d'Investigation Requis

### **Phase 1 : Analyse des Corrections UX (Stories 4.8-4.9)**

**Objectif** : Comprendre exactement quelles corrections UX ont été apportées

**Actions** :
1. **Rechercher Stories 4.8-4.9** dans Archon
   ```bash
   mcp__archon__find_tasks(query="STORY 4.8")
   mcp__archon__find_tasks(query="STORY 4.9")
   ```

2. **Analyser les changements interface**
   - Identifier modifications Kanban/EPICs
   - Comprendre "interface unifiée" mentionnée
   - Documenter nouvelles patterns UX

3. **Audit score 6.65/10**
   - Identifier les patterns problématiques spécifiques
   - Comprendre les critères d'évaluation
   - Localiser l'audit James référencé

### **Phase 2 : État Actuel du MCP**

**Objectif** : Cartographier les fonctions MCP existantes et identifier l'obsolescence

**Actions** :
1. **Inventaire des fonctions MCP**
   ```bash
   # Localiser les fichiers MCP dans le projet
   find . -name "*mcp*" -type f
   grep -r "mcp" archon-ui-main/src --include="*.ts" --include="*.tsx"
   ```

2. **Analyser les descriptions d'outils**
   - Fonctions de navigation EPICs ↔ Kanban
   - Descriptions workflows obsolètes
   - Context-awareness actuel

3. **Tester intégration actuelle**
   - Vérifier fonctionnement avec interface corrigée
   - Identifier les guidances erronées

### **Phase 3 : Spécification Technique Détaillée**

**Objectif** : Définir précisément les modifications à apporter

**Livrables à produire** :
1. **Mapping obsolescence**
   - Fonctions MCP → Status (OK/Obsolète/À modifier)
   - Descriptions à mettre à jour
   - Nouveaux workflows requis

2. **Plan de correction technique**
   - Fichiers à modifier
   - Nouvelles descriptions d'outils
   - Tests d'intégration requis

3. **Critères d'acceptation détaillés**
   - Métriques d'amélioration UX
   - Validation avec Stories 4.8-4.9
   - Tests de non-régression

---

## 📋 Structure Investigation Recommandée

### **Session Suivante - Ordre d'Exécution**

1. **30 min** - Investigation Stories 4.8-4.9
2. **45 min** - Audit état actuel MCP
3. **30 min** - Rédaction spécification technique détaillée
4. **15 min** - Mise à jour Story 3.3 dans Archon avec plan précis

### **Sessions Implémentation**

**Session 1** : Corrections descriptions MCP (1-2h)
**Session 2** : Tests intégration + validation (1h)
**Session 3** : Documentation finale + livraison

---

## 🎯 Questions Clés à Résoudre

### **Interface & UX**
- Qu'est-ce que "l'interface Kanban/EPICs unifiée" exactement ?
- Quels sont les patterns UX problématiques identifiés ?
- Comment la navigation EPICs ↔ Kanban a-t-elle été corrigée ?

### **MCP Technique**
- Quelles fonctions MCP guident actuellement mal les utilisateurs ?
- Quelles descriptions d'outils sont obsolètes ?
- Comment améliorer le context-awareness ?

### **Validation**
- Comment mesurer l'amélioration du score UX ?
- Quels tests valident l'intégration avec Stories 4.8-4.9 ?
- Comment prévenir la régression future ?

---

## 📁 Ressources à Investiguer

### **Dans Archon**
- Stories 4.8, 4.9 (corrections UX)
- Audit James (score 6.65/10)
- Documentation MCP existante

### **Dans le Code**
- Fichiers MCP actuels
- Interface Kanban récente
- Tests d'intégration existants

### **Documentation**
- `/traxis/` - Historique des décisions
- Mémoires Serena sur MCP
- Commits récents interface

---

## ✅ **Point de Reprise Session Suivante**

**Commencer par** : `mcp__archon__find_tasks(query="STORY 4.8")` pour comprendre les corrections UX qui nécessitent la mise à jour MCP.

**Objectif session** : Transformer cette investigation en spécification technique précise pour Story 3.3.

---

*Roadmap créé le 22/09/2025 - Session de préparation Story 3.3*