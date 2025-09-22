# TRAXIS E2E Test Suite - Story 5.1

## 🎯 Vue d'ensemble

Suite de tests End-to-End complète pour valider la **Story 5.1 - Tests End-to-End Hiérarchie** du projet TRAXIS. Cette suite couvre l'intégralité de la hiérarchie EPIC→STORY→TASK→SUBTASK avec reporting avancé.

## 📊 Système de Reporting

### Rapports Générés

Le système génère automatiquement plusieurs types de rapports :

1. **📋 Rapport HTML TRAXIS** (`test-results/traxis-test-report.html`)
   - Interface visuelle complète avec graphiques
   - Statut des critères d'acceptation
   - Détails par catégorie et fonctionnalité
   - Recommandations et métriques de performance

2. **📈 Rapport Playwright Standard** (`test-results/html/index.html`)
   - Rapport standard Playwright avec traces
   - Screenshots et vidéos des échecs
   - Timeline détaillée d'exécution

3. **📝 Résumé Archon** (`test-results/archon-story-5.1-report.md`)
   - Format Markdown pour mise à jour dans Archon
   - Statut des critères d'acceptation
   - Recommandations pour prochaines étapes

4. **🔧 Données JSON** (`test-results/traxis-test-report.json`)
   - Données structurées pour intégration CI/CD
   - Métriques détaillées et métadonnées

## 🚀 Exécution des Tests

### Méthode Recommandée (Script Automatique)

```bash
# Exécuter tous les tests avec reporting complet
npm run test:story-5.1
# ou
./scripts/run-story-5-1-tests.sh
```

### 🧹 Nettoyage des Données de Test

```bash
# Nettoyer les données de test après exécution
npm run cleanup:test-data
# ou script simple sans dépendances
./scripts/cleanup-test-data-simple.sh
```

**Important**: Les tests de performance créent de nombreux EPICs/STORIEs/TASKs. Utilisez le script de nettoyage après les tests pour éviter l'accumulation de données test.

### Méthodes Alternatives

```bash
# Tests par catégorie
npm run test:hierarchy      # Tests CRUD hiérarchie
npm run test:navigation     # Tests navigation
npm run test:dependencies   # Tests dépendances
npm run test:performance    # Tests performance
npm run test:mcp           # Tests intégration MCP

# Tests Playwright standard
npm run test               # Tous les tests
npm run test:headed        # Mode visible (debugging)
```

## 📋 Visualisation des Rapports

### Interface Interactive

```bash
# Lancer le visualiseur de rapports
npm run test:reports
# ou
./scripts/view-test-reports.sh
```

Le script interactif permet de :
- ✅ Voir tous les rapports disponibles
- 🌐 Ouvrir les rapports HTML dans le navigateur
- 📋 Afficher le résumé Archon
- 📝 Ouvrir les données JSON
- 🚀 Relancer les tests

### Accès Direct

```bash
# Ouvrir le rapport HTML TRAXIS
npm run report:open

# Ouvrir le rapport Playwright
npm run report:show

# Afficher le résumé Archon
cat test-results/archon-story-5.1-report.md
```

## 📊 Structure des Rapports

### Rapport HTML TRAXIS

```
📊 Métriques Générales
├── Total des tests
├── Tests réussis/échoués
├── Taux de succès
└── Durée d'exécution

✅ Critères d'Acceptation
├── CRUD hiérarchie testé
├── Gestion dépendances validée
├── Tests performance (1000+ items)
├── Intégration MCP fonctionnelle
├── Navigation validée
└── Tests régression passés

📋 Résultats par Catégorie
├── 🏗️ Hierarchy CRUD (29 tests)
│   ├── EPIC Management (9 tests)
│   ├── STORY Management (10 tests)
│   └── TASK & SUBTASK Management (10 tests)
├── 🧭 Navigation (10 tests)
├── 🔗 Dependencies (12 tests)
├── ⚡ Performance (12 tests)
└── 🤖 MCP Integration (14 tests)

📝 Recommandations
└── Actions suggérées basées sur les résultats
```

### Résumé Archon

Le résumé généré pour Archon inclut :
- ✅ Status global de la Story 5.1
- 📊 Taux de réussite par catégorie
- ✅ Validation des critères d'acceptation
- 📝 Recommandations pour la suite
- 🎯 Décision GO/NO-GO pour validation finale

## 🔧 Configuration Avancée

### Variables d'Environnement

```bash
# URL de base de l'application
BASE_URL=http://localhost:3737

# Ports des services
ARCHON_UI_PORT=3737
BACKEND_PORT=8181

# Mode CI/CD
CI=true  # Active retry et configuration CI
```

### Personnalisation des Rapports

Les rapports peuvent être personnalisés en modifiant :
- `tests/reporters/custom-reporter.ts` - Logique de reporting
- `playwright.config.ts` - Configuration des rapports
- Styles CSS intégrés dans le reporter

## 📈 Métriques de Performance

Le système collecte automatiquement :
- ⏱️ **Temps de réponse** : P50, P95, P99
- 🔄 **Caching ETag** : Validation 304 responses
- 💾 **Utilisation mémoire** : Détection de fuites
- 📊 **Load testing** : 100 EPICs, 500 STORIEs, 1000 TASKs
- 🖱️ **UI responsiveness** : Drag & drop, navigation

## 🎯 Critères d'Acceptation Story 5.1

### ✅ Validation Automatique

Le système valide automatiquement :

1. **Tests CRUD Hiérarchie** : 29/29 tests doivent passer
2. **Gestion Dépendances** : 12/12 tests incluant détection cycles
3. **Tests Performance** : Benchmarks respectés (P95<200ms)
4. **Intégration MCP** : Tools AI fonctionnels
5. **Navigation** : Breadcrumb et flows complets
6. **Régression** : Aucun échec critique

### 📊 Seuils de Validation

- **Taux de succès minimum** : 95%
- **Performance P95** : < 200ms
- **Performance P99** : < 500ms
- **Couverture fonctionnelle** : 100% features principales
- **Tests critiques** : 0 échec

## 🚨 Dépannage

### Applications Non Démarrées

```bash
# Vérifier les services
curl http://localhost:3737  # Frontend
curl http://localhost:8181/health  # Backend

# Démarrer si nécessaire
cd archon-ui-main && npm run dev &
cd python && uv run python -m server.main &
```

### Rapports Non Générés

```bash
# Vérifier les permissions
chmod +x scripts/*.sh

# Réinstaller les dépendances
npm install @playwright/test
npx playwright install

# Nettoyer et relancer
rm -rf test-results/
npm run test:story-5.1
```

### Tests qui Échouent

1. **Vérifier les prérequis** : Applications démarrées
2. **Analyser les traces** : Rapport Playwright détaillé
3. **Consulter les logs** : Screenshots et vidéos d'échec
4. **Vérifier la configuration** : Variables d'environnement

## 📚 Documentation Technique

- **Tests Structure** : `tests/TEST-SUMMARY.md`
- **Configuration** : `playwright.config.ts`
- **Fixtures** : `tests/fixtures/test-data.ts`
- **Reporter Custom** : `tests/reporters/custom-reporter.ts`

---

**🎯 Story 5.1 Status** : ✅ TESTS READY FOR EXECUTION

*Suite de tests complète avec reporting avancé. Prête pour validation finale de la Story 5.1.*