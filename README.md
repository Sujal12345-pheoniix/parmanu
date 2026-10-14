# Parmanu

**India-first news and creator intelligence platform.**

Real sources → Validated records → Traceable evidence → Original intelligence → Trustworthy user experience.

---

## What is Parmanu?

Parmanu delivers personalized news across India, world, business, politics, technology, sports, entertainment, and science — with full source provenance on every article. It also surfaces verified creator-brand collaborations through a purpose-built Instagram intelligence engine that relies exclusively on authorized data.

Every piece of content shows its evidence state: Official, Verified, Single Source, Unverified, or Disputed.

---

## Project Structure

```
parmanu/
├── apps/
│   ├── web/          # Next.js 14 (App Router) — user-facing web app
│   └── api/          # NestJS — backend API + ingestion workers
├── packages/
│   ├── types/        # Shared TypeScript types
│   ├── config/       # Shared ESLint, TSConfig
│   └── utils/        # Shared utility functions
└── docs/
    └── phase-1/      # Blueprint and architecture documents
```

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), shadcn/ui, Tailwind CSS |
| Backend | NestJS, Prisma, PostgreSQL (Neon) |
| Job Queue | BullMQ + Upstash Redis |
| Auth | NextAuth.js v5, Passport.js |
| Validation | Zod |
| Testing | Vitest, Playwright |
| CI/CD | GitHub Actions, Vercel, Railway |

---

## Getting Started

### Prerequisites

- Node.js v20+
- pnpm v8+
- A Neon PostgreSQL database
- An Upstash Redis instance

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/Sujal12345-pheoniix/parmanu.git
cd parmanu

# 2. Install dependencies
pnpm install

# 3. Configure environment
cp .env.example .env.local
# Edit .env.local with your real credentials — DO NOT commit this file

# 4. Run database migrations
pnpm --filter api prisma migrate dev

# 5. Start development servers
pnpm dev
```

---

## Documentation

All Phase 1 blueprint documents are in [`docs/phase-1/`](./docs/phase-1/):

- [Environment Audit](./docs/phase-1/ENVIRONMENT_AUDIT.md)
- [Product Requirements](./docs/phase-1/PRODUCT_REQUIREMENTS.md)
- [Architecture](./docs/phase-1/ARCHITECTURE.md)
- [Architecture Decisions](./docs/phase-1/ARCHITECTURE_DECISIONS.md)
- [Threat Model](./docs/phase-1/THREAT_MODEL.md)
- [Data Model and Contracts](./docs/phase-1/DATA_MODEL_AND_CONTRACTS.md)
- [Data Source Register](./docs/phase-1/DATA_SOURCE_REGISTER.md)
- [Instagram Feasibility](./docs/phase-1/INSTAGRAM_FEASIBILITY.md)
- [Provider Costs and Limits](./docs/phase-1/PROVIDER_COSTS_AND_LIMITS.md)
- [Feasibility Decisions](./docs/phase-1/FEASIBILITY_DECISIONS.md)
- [Security and Operations Requirements](./docs/phase-1/SECURITY_AND_OPERATIONS_REQUIREMENTS.md)
- [Implementation Plan](./docs/phase-1/IMPLEMENTATION_PLAN.md)

---

## Contributing

- All PRs must pass CI (lint, typecheck, tests, secret scan).
- No secrets, tokens, or connection strings in any committed file.
- Every content record must have a provenance state and source reference.

---

## License

Private — All rights reserved. Not open source.
