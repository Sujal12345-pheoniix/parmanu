# Parmanu (परमाणु)

**India-first news and creator intelligence platform with verifiable source provenance.**

Real sources → Validated records → Traceable evidence → Original intelligence → Trustworthy user experience.

---

## What is Parmanu?

Parmanu combines multi-category news curation across India, world affairs, business, politics, technology, sports, and entertainment with a purpose-built Instagram creator intelligence engine. Every single piece of content is backed by an immutable provenance trail linking directly to the primary source.

- **Zero Mock Data:** Powered exclusively by genuine publisher syndication feeds and official announcements.
- **Traceable Evidence Engine:** Distinct provenance trust states: `OFFICIAL_CONFIRMED`, `CORROBORATED`, `SINGLE_SOURCE`, `UNVERIFIED`.
- **Collaboration Radar:** Verifiable brand-creator partnership tracking with primary evidence links.
- **Defense in Depth:** Server-side SSRF validation, AES-256-GCM token encryption, bcrypt password hashing, and immutable audit logging.

---

## Architecture & Technology Stack

| Component | Technology | Role |
|---|---|---|
| **Backend API** | Node.js (v20+), Express, TypeScript (Strict) | REST API, role-based authorization, rate limiting |
| **Database** | Neon Serverless PostgreSQL | Relational storage with connection pooling & PITR |
| **ORM** | Prisma 5 | Type-safe queries, migrations, and schema sync |
| **Connector Pipeline** | Fast XML Parser, Fetch API | Resilient polling with retry backoff, jitter & SSRF guard |
| **Security** | Bcrypt (salt 12), JWT (HS256), AES-256-GCM | Auth, session lifecycle, and encrypted secrets at rest |
| **Frontend UI** | Modern Responsive Web (HTML5/CSS3/Vanilla TS) | Feed reader, category filter, provenance badges, admin monitor |
| **Testing** | Node.js Built-in Test Runner (`node:test`, `node:assert`) | Zero-dependency fast unit and integration tests |

---

## Monorepo Layout

```
parmanu/
├── apps/
│   ├── api/          # Express API server, Prisma, connectors, ingestion service
│   │   ├── prisma/   # schema.prisma, seed.ts
│   │   ├── public/   # Production-grade responsive web interface
│   │   └── src/      # Controllers, security, connectors, ingestion, tests
│   └── web/          # Standalone web package scaffold
├── packages/
│   ├── config/       # Shared base tsconfig and lint rules
│   └── types/        # Canonical data contracts, enums, and Zod validation schemas
├── docs/
│   └── phase-1/      # Architecture, ADRs, Threat Model, API Contracts & Runbooks
├── .env.example      # Template for environment configuration
└── .gitignore        # Strict exclusion of .env, credentials, and build artifacts
```

---

## Quickstart

### 1. Prerequisites
- Node.js v20.18.0 LTS+ (`node -v`)
- npm v10+

### 2. Setup & Installation
```bash
# Clone the repository
git clone https://github.com/Sujal12345-pheoniix/parmanu.git
cd parmanu

# Install all workspace dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Neon PostgreSQL connection string and secrets
```

### 3. Database Initialization & Seeding
```bash
# Push schema to Neon PostgreSQL
npm run --workspace=@parmanu/api db:push

# Seed priority sources and default accounts (Admin & Editor)
npm run --workspace=@parmanu/api db:seed
```

### 4. Run Automated Test Suite
```bash
npm test
```
*Executes all 9 automated test suites verifying password security, JWT lifecycle, AES-256-GCM token encryption, Zod validation, SSRF defense, deduplication hashing, RSS parsing, and live Neon PostgreSQL connectivity.*

### 5. Fetch Genuine News Records
```bash
node -r ts-node/register apps/api/src/scripts/test-live-ingestion.ts
```

### 6. Start Application
```bash
npm run dev
```
Open [http://localhost:3001](http://localhost:3001) to explore the live feed, category filters, collaboration radar, and administrative ingestion monitor.

---

## Default Seeded Accounts

| Role | Email | Password |
|---|---|---|
| **Super Administrator** | `admin@parmanu.dev` | `AdminPass123456!` |
| **Editorial Lead** | `editor@parmanu.dev` | `EditorPass123456!` |

---

## Complete Phase 1 Documentation

All Phase 1 blueprint and operational runbooks are located in [`docs/phase-1/`](./docs/phase-1/):

- [IMPLEMENTATION_REPORT.md](./docs/phase-1/IMPLEMENTATION_REPORT.md) — Implementation verification report
- [API_CONTRACTS.md](./docs/phase-1/API_CONTRACTS.md) — Complete REST API specifications
- [DATABASE_OPERATIONS.md](./docs/phase-1/DATABASE_OPERATIONS.md) — Database operations and PITR recovery runbook
- [CONNECTOR_RUNBOOK.md](./docs/phase-1/CONNECTOR_RUNBOOK.md) — Source connector lifecycle and troubleshooting
- [ENVIRONMENT_SETUP.md](./docs/phase-1/ENVIRONMENT_SETUP.md) — Environment setup and credential rotation
- [ENVIRONMENT_AUDIT.md](./docs/phase-1/ENVIRONMENT_AUDIT.md) — Initial workspace and runtime audit
- [PRODUCT_REQUIREMENTS.md](./docs/phase-1/PRODUCT_REQUIREMENTS.md) — Product requirements document (PRD)
- [ARCHITECTURE.md](./docs/phase-1/ARCHITECTURE.md) — System context and container architecture
- [ARCHITECTURE_DECISIONS.md](./docs/phase-1/ARCHITECTURE_DECISIONS.md) — 10 Architecture Decision Records (ADRs)
- [THREAT_MODEL.md](./docs/phase-1/THREAT_MODEL.md) — STRIDE security analysis and controls
- [DATA_MODEL_AND_CONTRACTS.md](./docs/phase-1/DATA_MODEL_AND_CONTRACTS.md) — Prisma schema and canonical contracts
- [DATA_SOURCE_REGISTER.md](./docs/phase-1/DATA_SOURCE_REGISTER.md) — Register of 30+ evaluated data sources
- [INSTAGRAM_FEASIBILITY.md](./docs/phase-1/INSTAGRAM_FEASIBILITY.md) — Meta API feasibility analysis
- [PROVIDER_COSTS_AND_LIMITS.md](./docs/phase-1/PROVIDER_COSTS_AND_LIMITS.md) — Cost projections and API limits
- [FEASIBILITY_DECISIONS.md](./docs/phase-1/FEASIBILITY_DECISIONS.md) — 7 Go/No-Go feasibility decisions
- [SECURITY_AND_OPERATIONS_REQUIREMENTS.md](./docs/phase-1/SECURITY_AND_OPERATIONS_REQUIREMENTS.md) — OWASP ASVS standards
- [IMPLEMENTATION_PLAN.md](./docs/phase-1/IMPLEMENTATION_PLAN.md) — 15-task implementation roadmap

---

## License

Private — All rights reserved.
