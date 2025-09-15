# Guide des Migrations TRAXIS

## 🚀 Système de Migration Automatique

Le système de migration TRAXIS s'exécute **automatiquement** au démarrage du serveur. Les migrations sont appliquées dans l'ordre et suivies dans la table `archon_migrations`.

## 📋 Comment ça marche

### 1. Migrations Automatiques (Recommandé)

Au démarrage du serveur (via Docker ou local), le système :

1. ✅ Vérifie la table `archon_migrations`
2. ✅ Identifie les migrations non exécutées
3. ✅ Applique les migrations dans l'ordre
4. ✅ Enregistre le succès/échec de chaque migration
5. ✅ Continue le démarrage même si des migrations échouent

```bash
# Démarrage normal avec migrations automatiques
docker compose up -d

# Les logs montreront :
# 🔄 Checking for pending database migrations...
# ✅ Successfully applied 3 new migration(s)
# ✅ All migrations are up to date
```

### 2. Exécution Manuelle

Si besoin, utilisez le script dédié :

```bash
# Migrations dans Docker (par défaut)
./scripts/run-migrations.sh

# Migrations sur Supabase local
./scripts/run-migrations.sh --local

# Voir l'aide
./scripts/run-migrations.sh --help
```

### 3. Vérification du Statut

Pour voir l'état des migrations :

```sql
-- Connectez-vous à votre base de données
SELECT * FROM archon_migration_status;

-- Résultat :
-- migration_name                  | status_icon | executed_at
-- --------------------------------|-------------|--------------------
-- epic_1_3_subtasks_integration   | ✅          | 2025-09-14 19:30:00
-- epic_1_2_extend_tasks_table     | ✅          | 2025-09-14 19:29:30
-- epic_1_1_hierarchical_tables    | ✅          | 2025-09-14 19:29:00
```

## 📁 Structure des Migrations

Les fichiers de migration sont dans `/migration/` :

```
migration/
├── 00_migration_system.sql          # Système de tracking (toujours en premier)
├── epic_1_1_hierarchical_tables.sql # Epic 1 - Tables de base
├── epic_1_2_extend_tasks_table.sql  # Epic 1 - Extension tasks
├── epic_1_3_subtasks_integration.sql# Epic 1 - Support subtasks
└── ...
```

### Convention de Nommage

- `00_` : Migrations système (prioritaires)
- `epic_X_Y_` : Migrations par Epic et Story
- `validate_` : Scripts de validation (ignorés)
- `test_` : Scripts de test (ignorés)

## 🔧 Configuration

### Variables d'Environnement

```bash
# .env
SUPABASE_URL=https://xxxxx.supabase.co  # ou http://localhost:8000
SUPABASE_SERVICE_KEY=your-service-key
```

### Docker Compose

Le volume des migrations est automatiquement monté :

```yaml
volumes:
  - ./migration:/app/migration  # Migrations TRAXIS
```

## 🛠️ Développement

### Créer une Nouvelle Migration

1. Créez le fichier SQL dans `/migration/` :

```sql
-- migration/epic_2_1_nouvelle_feature.sql

-- Vérifier si déjà exécutée
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM archon_migrations
        WHERE migration_name = 'epic_2_1_nouvelle_feature.sql'
    ) THEN
        -- Votre migration ici
        CREATE TABLE ma_nouvelle_table (...);
    END IF;
END $$;
```

2. Redémarrez le serveur ou exécutez manuellement :

```bash
docker compose restart archon-server
# ou
./scripts/run-migrations.sh
```

### Rollback d'une Migration

Les rollbacks doivent être manuels pour éviter la perte de données :

1. Créez un script de rollback :

```sql
-- migration/rollback_epic_2_1.sql
-- Annule les changements de epic_2_1_nouvelle_feature.sql

DROP TABLE IF EXISTS ma_nouvelle_table;

-- Marquer comme rollback
UPDATE archon_migrations
SET status = 'rolled_back'
WHERE migration_name = 'epic_2_1_nouvelle_feature.sql';
```

2. Exécutez manuellement via psql ou un client SQL

## 🐛 Dépannage

### Migration Échouée

Si une migration échoue :

1. **Le serveur démarre quand même** (pas de blocage)
2. Vérifiez les logs : `docker compose logs archon-server`
3. Corrigez le problème dans le fichier SQL
4. Supprimez l'entrée dans `archon_migrations` :
   ```sql
   DELETE FROM archon_migrations
   WHERE migration_name = 'migration_problematique.sql';
   ```
5. Relancez : `./scripts/run-migrations.sh`

### Base de Données Inaccessible

Si la connexion échoue :

1. Vérifiez Supabase : `docker compose ps`
2. Testez la connexion :
   ```bash
   psql -h localhost -p 54322 -U postgres -d postgres
   ```
3. Vérifiez les variables d'environnement

### Table de Migration Corrompue

En dernier recours, réinitialisez :

```sql
-- ⚠️ ATTENTION : Sauvegardez d'abord l'état
SELECT * FROM archon_migrations;

-- Réinitialiser
DROP TABLE archon_migrations CASCADE;

-- Relancer le système
./scripts/run-migrations.sh
```

## 📊 Monitoring

### Requêtes Utiles

```sql
-- Migrations récentes
SELECT * FROM archon_migration_status
ORDER BY executed_at DESC
LIMIT 10;

-- Migrations échouées
SELECT * FROM archon_migrations
WHERE status = 'failed';

-- Temps d'exécution
SELECT
    migration_name,
    execution_time_ms,
    executed_at
FROM archon_migrations
ORDER BY execution_time_ms DESC;
```

## ✅ Checklist de Mise en Production

- [ ] Toutes les migrations testées localement
- [ ] Backup de la base de données effectué
- [ ] Variables d'environnement configurées
- [ ] Docker image reconstruite avec psycopg2
- [ ] Logs configurés pour capturer les migrations
- [ ] Plan de rollback préparé

## 🎯 Avantages du Système

1. **Automatique** : Pas d'intervention manuelle
2. **Idempotent** : Les migrations ne s'exécutent qu'une fois
3. **Traçable** : Historique complet dans `archon_migrations`
4. **Robuste** : Le serveur démarre même si des migrations échouent
5. **Versionné** : Checksum SHA256 pour détecter les modifications

---

*Pour toute question, consultez les logs ou exécutez `./scripts/run-migrations.sh --help`*