# ARCHITECTURE DECISIONS
**Stage 4 — Architecture Decision Records (ADRs)**
*Version 1.0 · 2026-10-14*

---

## ADR-001: Monorepo Structure with Turborepo

**Status:** ACCEPTED

**Context:** We need to manage a Next.js web app, a NestJS backend, and shared TypeScript packages. These could live in separate repositories or a monorepo.

**Decision:** Use a monorepo managed with **pnpm workspaces + Turborepo**.

**Consequences:**
- ✅ Shared TypeScript types between frontend and backend prevent contract drift
- ✅ Atomic commits across frontend and backend
- ✅ Single CI pipeline, unified versioning
- ⚠️ Slightly more complex initial setup
- ⚠️ Turborepo caching requires configuration

**Alternatives rejected:**
- Separate repos: Type drift risk, coordination overhead, complex CI
- Nx: More powerful but significantly more complex for a small team

---

## ADR-002: NestJS for Backend over Express or Fastify

**Status:** ACCEPTED

**Context:** The backend needs to handle REST APIs, job scheduling, dependency injection, and modular organization.

**Decision:** Use **NestJS** with the Express adapter.

**Consequences:**
- ✅ Built-in DI container prevents tangled dependencies
- ✅ Module system enforces boundaries (NewsModule cannot accidentally import IngestionModule internals)
- ✅ First-class TypeScript support
- ✅ Excellent Prisma integration
- ⚠️ More boilerplate than Express
- ⚠️ Learning curve for team members unfamiliar with Angular-style architecture

**Alternatives rejected:**
- Plain Express: No structure, grows into chaos
- Fastify: Faster but less ecosystem support for NestJS-style DI
- Hono: Modern and fast but immature for large applications

---

## ADR-003: Prisma over TypeORM or Drizzle

**Status:** ACCEPTED

**Context:** We need a TypeScript-native ORM that works with Neon PostgreSQL, supports migrations, and provides good DX.

**Decision:** Use **Prisma 5**.

**Consequences:**
- ✅ Schema-first approach with auto-generated types
- ✅ Excellent Neon (serverless PG) support via `@prisma/adapter-neon`
- ✅ Migration system is reliable and auditable
- ✅ Prisma Studio for development inspection
- ⚠️ Prisma's query builder is less flexible than raw SQL for complex joins; use `$queryRaw` when needed
- ⚠️ Bundle size larger than Drizzle

**Alternatives rejected:**
- TypeORM: Decorator-heavy, harder to reason about; less reliable migration system
- Drizzle: Excellent DX but newer; less mature ecosystem; schema-first approach similar but less tooling

---

## ADR-004: BullMQ over Agenda or node-cron for Job Queue

**Status:** ACCEPTED

**Context:** Ingestion jobs must be reliable, retryable, observable, and distributed. A simple `setInterval` is not sufficient.

**Decision:** Use **BullMQ** with **Upstash Redis**.

**Consequences:**
- ✅ Durable — jobs survive server restarts
- ✅ Built-in retry with exponential backoff
- ✅ Job event listeners for observability
- ✅ Scheduled (cron) and delayed job support
- ✅ Upstash Redis is serverless and compatible with Vercel/Railway
- ⚠️ Requires Redis instance (Upstash free tier sufficient for Phase 1)
- ⚠️ More complex than simple timers

**Alternatives rejected:**
- node-cron: No persistence, no retry, not production-grade
- Agenda (MongoDB): Requires MongoDB; wrong DB choice for this project
- Temporal: Excellent but significant operational complexity

---

## ADR-005: NextAuth.js for Web Authentication

**Status:** ACCEPTED

**Context:** The web app needs authentication with support for email/password, Google OAuth, and potentially Instagram OAuth (for creators).

**Decision:** Use **NextAuth.js v5 (Auth.js)**.

**Consequences:**
- ✅ Next.js native; handles session management, CSRF, and token rotation
- ✅ Supports 50+ OAuth providers including Google and Instagram
- ✅ Adapter for Prisma (sessions stored in PostgreSQL)
- ⚠️ v5 (Auth.js) is still maturing; some breaking changes possible
- ⚠️ Instagram provider may require custom configuration for Basic Display API

**Alternatives rejected:**
- Clerk: Excellent DX but external SaaS for auth; vendor dependency for core security
- Supabase Auth: Would require Supabase DB which conflicts with our Neon choice
- Custom JWT: Significant security risk without extensive expertise

---

## ADR-006: Zod for Runtime Validation

**Status:** ACCEPTED

**Context:** Input validation must be enforced at runtime (not just TypeScript compile-time). The same schemas should be usable in both frontend forms and backend validation.

**Decision:** Use **Zod** throughout; share schemas via `packages/types`.

**Consequences:**
- ✅ Single source of truth for data contracts
- ✅ Integrates with React Hook Form (frontend) and NestJS pipes (backend)
- ✅ Excellent TypeScript inference
- ⚠️ Slightly larger bundle than io-ts; acceptable for this use case

---

## ADR-007: pg_trgm for Full-Text Search (Phase 1)

**Status:** ACCEPTED — REVIEW AT 100K ARTICLES

**Context:** Users need to search articles and creator profiles. Options include external search services (Elasticsearch, Algolia, Typesense) or PostgreSQL's built-in capabilities.

**Decision:** Use **PostgreSQL `pg_trgm` extension** with GIN indexes for Phase 1 full-text search.

**Consequences:**
- ✅ Zero additional infrastructure cost
- ✅ Sufficient for < 1 million records
- ✅ Supports trigram similarity and Hindi text
- ⚠️ Not as powerful as dedicated search engine (no stemming, limited faceting)
- ⚠️ Will need migration to Typesense or Algolia at scale

**Review trigger:** Evaluate Typesense when article count exceeds 100,000 or search response time exceeds 200ms P95.

---

## ADR-008: Content Security Policy and No Inline Scripts

**Status:** ACCEPTED

**Context:** A news platform embedding external content is a high-value XSS target.

**Decision:** Enforce strict Content Security Policy with `script-src 'self'`; no inline scripts; nonce-based exceptions for Next.js runtime only.

**Consequences:**
- ✅ XSS attacks significantly mitigated
- ⚠️ Third-party scripts (analytics, embeds) must be carefully allowlisted
- ⚠️ Requires Next.js middleware to inject per-request nonces

---

## ADR-009: No Full Article Text Storage

**Status:** ACCEPTED — ARCHITECTURAL CONSTRAINT

**Context:** Storing full article text from publisher RSS feeds or licensed APIs would constitute copyright infringement without explicit license agreements.

**Decision:** The `source_items` table has no `full_text` column. Metadata (headline, excerpt, URL, timestamp, author, source) only. A future `content_license` table will gate full-text access when licensed.

**Consequences:**
- ✅ No copyright liability
- ✅ Drives traffic to publishers (positive publisher relationship)
- ⚠️ AI summarization features are impossible without licensed content (confirmed deferral per PRD)

---

## ADR-010: Separate Staging and Production Environments

**Status:** ACCEPTED — NON-NEGOTIABLE

**Context:** Any deployment pipeline that touches production directly from a development branch is dangerous.

**Decision:** Maintain three environments: Local → Staging → Production. No code reaches production without passing CI and staging review. Production deployments require a manual approval step in GitHub Actions.

**Consequences:**
- ✅ Prevents accidental production data corruption
- ✅ Allows testing ingestion logic against real external sources in a safe environment
- ⚠️ Doubles environment management overhead (acceptable cost)
