# ENVIRONMENT SETUP & CONFIGURATION GUIDE
**Setup and Verification Runbook for Parmanu**

---

## 1. Prerequisites

- **Node.js:** v20.18.0 LTS or higher (`node -v`)
- **Package Manager:** npm v10+ (bundled with Node 20)
- **Database:** Serverless PostgreSQL instance (Neon recommended)
- **OS:** Windows, macOS, or Linux

---

## 2. Quickstart Step-by-Step

### 1. Clone & Install
```bash
git clone https://github.com/Sujal12345-pheoniix/parmanu.git
cd parmanu
npm install
```

### 2. Configure Environment
Create `.env` in the project root:
```env
DATABASE_URL="postgresql://neondb_owner:...@ep-...aws.neon.tech/neondb?sslmode=require&channel_binding=require"
PORT=3001
NODE_ENV=development
JWT_SECRET="parmanu_dev_jwt_secret_at_least_32_characters_long_for_security_2026"
ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
ADMIN_REGISTRATION_KEY="parmanu_admin_setup_key_2026"
```

### 3. Initialize Database & Seed
```bash
# Push Prisma schema to Neon
npm run --workspace=@parmanu/api db:push

# Seed priority Indian sources and default accounts
npm run --workspace=@parmanu/api db:seed
```

### 4. Run Automated Tests
```bash
npm test
```
*Expected: 9 tests passing (auth, crypto, validation, SSRF, deduplication, live DB connection).*

### 5. Ingest Real Live News
```bash
node -r ts-node/register apps/api/src/scripts/test-live-ingestion.ts
```
*Expected: Genuine articles fetched from The Hindu & NDTV News and stored in database.*

### 6. Start API & Web Application
```bash
npm run dev
```
Open **`http://localhost:3001`** in your browser.
- Browse the live news feed with provenance badges.
- Filter by categories: India, Politics, World, Business, Sports.
- Sign in with default seeded admin (`admin@parmanu.dev` / `AdminPass123456!`).
- Access the Ingestion Pipeline tab to trigger live ingestion and inspect source health.

---

## 3. Credential Rotation Runbook

- **Database Password:** Rotate in Neon console, then update `DATABASE_URL` in `.env` and deployment secrets. Restart server.
- **JWT Secret:** Update `JWT_SECRET`. Existing sessions will be invalidated, forcing clean re-login.
- **Encryption Key:** Changing `ENCRYPTION_KEY` requires running a key migration script to re-encrypt stored OAuth tokens.
