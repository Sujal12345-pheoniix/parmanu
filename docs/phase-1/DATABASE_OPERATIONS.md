# DATABASE OPERATIONS & BACKUP RUNBOOK
**Database Platform:** Neon Serverless PostgreSQL
**Engine Version:** PostgreSQL 16+

---

## 1. Reproducible Schema Initialization

The schema is maintained in `apps/api/prisma/schema.prisma`.

### Initializing a Clean Database
To initialize a fresh database environment:

```bash
# 1. Ensure DATABASE_URL is defined in .env
# 2. Push schema to the database (creates tables, constraints, enums, indexes)
npm run --workspace=@parmanu/api db:push

# 3. Seed default admin, editor, and priority news sources
npm run --workspace=@parmanu/api db:seed
```

---

## 2. Migration Workflow

All future production schema changes must follow version-controlled migrations:

```bash
# For development changes
npx prisma migrate dev --name <migration_name>

# For production deployment
npx prisma migrate deploy
```

> [!IMPORTANT]
> Always test migrations against an isolated Neon database branch before deploying to production.

---

## 3. Backups and Recovery Strategy

Neon provides built-in enterprise-grade storage branching and Point-in-Time Recovery (PITR).

### A. Point-in-Time Recovery (PITR)
- Neon continuously records Write-Ahead Logs (WAL) allowing instant restoration to any second within the retention window (up to 30 days on paid tiers).
- To restore from an accidental data corruption:
  1. Open the Neon Web Console.
  2. Navigate to **Branches** > **Create Branch**.
  3. Select **Time in past** and pick the exact UTC timestamp prior to the incident.
  4. Point `DATABASE_URL` to the newly restored branch.

### B. Manual Logical Snapshot (`pg_dump`)
For off-site compliance archiving:

```bash
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges -f parmanu_backup_$(date +%Y%m%d_%H%M%S).dump
```

To restore from a dump file:

```bash
pg_restore --clean --if-exists --no-owner -d "$DATABASE_URL" parmanu_backup_YYYYMMDD_HHMMSS.dump
```

---

## 4. Connection Pooling and Timeouts

- Parmanu connects via the Neon Connection Pooler endpoint (`-pooler` in hostname) to support high concurrency and serverless autoscaling.
- Enforce `sslmode=require&channel_binding=require` on all connection strings.
- Graceful shutdown handles SIGINT/SIGTERM by draining connections via `prisma.$disconnect()`.
