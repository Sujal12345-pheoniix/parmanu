# SYSTEM ARCHITECTURE
**Stage 4 — Technical Architecture**
*Version 1.0 · 2026-10-14*

---

## 1. Architecture Philosophy

- **API-first, modular monolith** — clear module boundaries within a single deployable backend. Avoid premature microservices until scale demands it.
- **TypeScript everywhere** — strict mode, shared types across frontend and backend via a `packages/` workspace.
- **Provenance-first data model** — every record knows its source. Evidence cannot be lost.
- **Defense in depth** — trust boundaries enforced at every layer, not just at the edge.

---

## 2. System Context Diagram

```mermaid
flowchart TD
    subgraph Users["Users"]
        U1["News Reader\n(Browser / PWA)"]
        U2["Creator\n(Browser)"]
        U3["Editor/Admin\n(Editorial Console)"]
    end

    subgraph Parmanu["Parmanu Platform"]
        WEB["Next.js Web App\n(Vercel)"]
        API["NestJS Backend API\n(Railway)"]
        WORKER["Ingestion Worker\n(NestJS + BullMQ)"]
        DB["PostgreSQL\n(Neon)"]
        CACHE["Redis\n(Upstash)"]
        STORE["Object Storage\n(Cloudflare R2)"]
    end

    subgraph External["External Data Sources"]
        RSS["RSS Feeds\n(15 Indian Publishers)"]
        GNEWS["GNews API"]
        GUARDIAN["Guardian API"]
        PIB["PIB / RBI / SEBI\nOfficial RSS"]
        PRWIRE["PR Newswire\nBusiness Wire India"]
        META["Meta Instagram\nBasic Display API"]
    end

    U1 -->|HTTPS| WEB
    U2 -->|HTTPS| WEB
    U3 -->|HTTPS| WEB
    WEB -->|REST/JSON| API
    API --> DB
    API --> CACHE
    WORKER -->|Poll RSS/API| RSS
    WORKER -->|HTTP| GNEWS
    WORKER -->|HTTP| GUARDIAN
    WORKER -->|HTTP| PIB
    WORKER -->|HTTP| PRWIRE
    WORKER -->|OAuth + REST| META
    WORKER --> DB
    WORKER --> CACHE
    API --> STORE
```

---

## 3. Container / Component Diagram

```mermaid
flowchart TD
    subgraph NextJS["Next.js App (Vercel) — parmanu-web"]
        PAGES["App Router Pages\n/news, /creator, /search, /admin"]
        APIPAGE["Next.js API Routes\n(BFF - thin proxy)"]
        COMP["React Components\n(shadcn/ui + Tailwind)"]
        PAGES --> COMP
        PAGES --> APIPAGE
    end

    subgraph NestJS["NestJS Backend (Railway) — parmanu-api"]
        AUTH["AuthModule\n(JWT + OAuth)"]
        NEWS["NewsModule\n(articles, categories, feeds)"]
        CREATOR["CreatorModule\n(profiles, connections)"]
        COLLAB["CollaborationModule\n(events, evidence)"]
        SEARCH["SearchModule\n(pg_trgm full-text)"]
        ADMIN["AdminModule\n(editorial, roles)"]
        INGEST["IngestionModule\n(source adapters)"]
        JOBS["JobModule\n(BullMQ queues)"]
        PROV["ProvenanceModule\n(evidence engine)"]
    end

    subgraph DB["Data Layer"]
        PG["PostgreSQL (Neon)\nPrimary store"]
        REDIS["Redis (Upstash)\nCache + Job queues"]
    end

    APIPAGE -->|REST| NestJS
    AUTH --- PG
    NEWS --- PG
    CREATOR --- PG
    COLLAB --- PG
    SEARCH --- PG
    ADMIN --- PG
    INGEST --- JOBS
    JOBS --- REDIS
    INGEST --- PG
    PROV --- PG
```

---

## 4. Module Dependency Map

```
parmanu/
├── apps/
│   ├── web/                    # Next.js 14 (App Router)
│   │   ├── app/               # Routes and layouts
│   │   ├── components/        # Shared UI components
│   │   └── lib/               # API client, auth helpers
│   └── api/                    # NestJS backend
│       ├── src/
│       │   ├── auth/          # JWT, OAuth, session
│       │   ├── news/          # Articles, feeds, categories
│       │   ├── creator/       # Creator profiles, Instagram OAuth
│       │   ├── collaboration/ # Events, evidence
│       │   ├── ingestion/     # Provider adapters, scheduling
│       │   ├── provenance/    # Evidence engine, state machine
│       │   ├── search/        # Full-text search
│       │   ├── admin/         # Editorial dashboard API
│       │   ├── jobs/          # BullMQ queue definitions
│       │   └── common/        # Guards, decorators, filters
│       └── prisma/            # Schema, migrations, seed
├── packages/
│   ├── types/                  # Shared TypeScript types
│   ├── config/                 # Shared ESLint, TSConfig
│   └── utils/                  # Shared utility functions
├── docs/
│   └── phase-1/               # Blueprint documents
└── .github/
    └── workflows/             # CI/CD pipelines
```

---

## 5. Deployment Topology

```mermaid
flowchart LR
    subgraph Developer["Developer Machine"]
        LOCAL["Local Dev\nnpm run dev"]
    end

    subgraph GH["GitHub"]
        REPO["parmanu repository\nmain + feature branches"]
        CI["GitHub Actions CI\nlint + typecheck + test"]
    end

    subgraph Staging["Staging Environment"]
        STAGE_WEB["Vercel Preview\n(auto-deployed per PR)"]
        STAGE_API["Railway Staging\n(auto-deployed on merge to staging)"]
        STAGE_DB["Neon Staging Branch\n(isolated from prod)"]
    end

    subgraph Production["Production Environment"]
        PROD_WEB["Vercel Production\n(main branch auto-deploy)"]
        PROD_API["Railway Production\n(manual promote)"]
        PROD_DB["Neon Main Branch\n(production data)"]
        CDN["Cloudflare CDN\n(edge cache)"]
    end

    LOCAL -->|git push| REPO
    REPO --> CI
    CI -->|on PR| STAGE_WEB
    CI -->|on PR| STAGE_API
    STAGE_WEB --> STAGE_DB
    STAGE_API --> STAGE_DB
    CI -->|on merge to main| PROD_WEB
    CI -->|approved release| PROD_API
    PROD_WEB --> CDN
    PROD_API --> PROD_DB
```

---

## 6. Trust Boundaries and Threat Model Summary

*(Full threat model in THREAT_MODEL.md)*

| Boundary | Direction | Controls |
|---|---|---|
| Internet → Next.js | Inbound | Cloudflare WAF, HTTPS, CSP headers, rate limiting |
| Browser → Next.js API Routes | Inbound | CSRF token, auth cookie with HttpOnly + Secure + SameSite=Strict |
| Next.js → NestJS API | Internal | API key or mTLS; NestJS not publicly exposed |
| NestJS → Neon DB | Outbound | SSL required; connection string in env secret; least-privilege DB user |
| NestJS → External APIs | Outbound | Secrets in env; never logged; egress firewall if possible |
| Worker → Instagram API | Outbound | Creator tokens encrypted at rest; refreshed server-side only |
| Admin users | Inbound | Separate role guard; MFA recommended; audit log every action |

---

## 7. Synchronous vs. Asynchronous Workflow Decisions

| Operation | Sync/Async | Rationale |
|---|---|---|
| User-facing news feed | Sync (cached) | Low latency required; Redis cache in front |
| Article search | Sync | pg_trgm full-text search; acceptable latency |
| RSS ingestion | Async (BullMQ) | Background job; failure doesn't block users |
| API provider polling | Async (BullMQ scheduled) | Rate-limited; queue handles throttle |
| Provenance classification | Async | CPU-bound; runs after ingestion |
| Editorial notifications | Async | Email/notification queue |
| Instagram token refresh | Async (cron) | Must complete before 60-day expiry |
| User bookmark / follow | Sync | User expects immediate feedback |

---

## 8. Failure and Recovery Paths

| Scenario | Impact | Recovery |
|---|---|---|
| RSS feed 404 | Missing articles from one outlet | Alert; retry in 30 min; mark source as unhealthy after 5 failures |
| External API rate limit | Ingestion paused for that source | Exponential backoff; resume when rate window resets |
| Neon DB connection failure | API returns 503 | Connection pool retry with 3 attempts; circuit breaker after |
| Redis unavailable | Job queue stops; cache miss | Degrade gracefully; continue serving cached content; alert |
| Vercel deployment failure | Web app unavailable | Automatic rollback to last successful deployment |
| Railway deployment failure | API unavailable | Manual rollback via Railway dashboard |
| Instagram token expired | Creator data stale | Notify creator via email to re-authenticate |
| Bad data ingested | Incorrect article shown | Editorial review queue catches before publishing; rollback with audit entry |

---

## 9. Technology Stack — Final Decision

| Layer | Technology | Version | Reason |
|---|---|---|---|
| Frontend framework | Next.js | 14 (App Router) | Industry standard for React SSR; Vercel native |
| UI components | shadcn/ui + Tailwind CSS | Latest | Accessible, composable, zero runtime overhead |
| Backend framework | NestJS | 10+ | Structured, DI-first, TypeScript-native, modular |
| ORM | Prisma | 5+ | Type-safe, Neon-compatible, excellent migration tooling |
| Database | PostgreSQL (Neon) | 15+ | Relational, full-text search via pg_trgm, ACID |
| Job queue | BullMQ + Upstash Redis | Latest | Durable, Redis-backed, TypeScript-native |
| Auth library | NextAuth.js (web) + Passport (API) | Latest | Industry standard; supports OAuth + credentials |
| Validation | Zod | 3+ | Runtime + compile-time; shared with frontend |
| Testing | Vitest (unit) + Playwright (e2e) | Latest | Fast, modern, Vite-native |
| Linting | ESLint + Prettier | Latest | Enforced in CI |
| Type-checking | TypeScript strict | 5+ | Required; no `any` escapes |
| CI/CD | GitHub Actions | — | Free for public; tight GitHub integration |
| Hosting (web) | Vercel | — | Zero-config Next.js deployment |
| Hosting (API) | Railway | — | Simple Docker-based Node deployment |
| Monitoring | Sentry (errors) + Vercel Analytics | — | Free tiers sufficient for Phase 1 |
| Secret management | Environment variables + GitHub Secrets | — | Never in source code |

---

## 10. Mobile Application Decision

**Decision: Deferred to Phase 3.**

React Native will be evaluated after the web MVP is validated. The responsive Next.js web app (PWA-capable) serves mobile browsers for Phase 1. Android and iOS native apps will be built using React Native with Expo, sharing business logic from `packages/` with the web app.
