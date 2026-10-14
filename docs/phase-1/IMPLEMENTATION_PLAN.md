# IMPLEMENTATION PLAN
**Stage 7 — Phase 1 Task Breakdown**
*Version 1.0 · 2026-10-14*

---

## Ordering Principles

Tasks are ordered to:
1. Resolve architectural uncertainty first.
2. Prevent expensive rework.
3. Deliver a working data pipeline before building UI.
4. Keep security non-negotiable at every step.

---

## TASK-000: Repository and Environment Bootstrap

| Property | Value |
|---|---|
| **Objective** | Initialize the Git repository, monorepo structure, base tooling, and push to GitHub |
| **Files/Modules** | `.gitignore`, `package.json`, `turbo.json`, `pnpm-workspace.yaml`, `.env.example`, `README.md`, `.github/workflows/ci.yml` |
| **Prerequisites** | Node.js installed; GitHub repository created at `github.com/Sujal12345-pheoniix/parmanu` |
| **Approach** | `git init` → `git remote add origin` → scaffold with `pnpm` workspaces → push initial commit |
| **Tests** | Verify `pnpm install` succeeds; CI pipeline triggers on push |
| **Acceptance criteria** | Clean push to GitHub; GitHub Actions CI pipeline runs and passes; no secrets in any committed file; `.env.example` present |
| **Security** | `.gitignore` covers all secret files; `gitleaks` installed as pre-commit hook |
| **Rollback** | N/A — first commit; can `git reset` safely |

---

## TASK-001: NestJS API Service Scaffold

| Property | Value |
|---|---|
| **Objective** | Create the NestJS backend with core module structure, global validation pipe, exception filters, and health check |
| **Files/Modules** | `apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/common/filters/`, `apps/api/src/common/pipes/`, `apps/api/src/health/` |
| **Prerequisites** | TASK-000 |
| **Approach** | `nest new api` in `apps/`; configure global `ZodValidationPipe`; add `@nestjs/throttler`; add Sentry; configure `pino` logger |
| **Tests** | Unit test: health check returns 200; integration test: global exception filter returns 400 on invalid input |
| **Acceptance criteria** | `GET /health` returns `{ status: "ok", db: "ok", queue: "ok" }`; malformed request body returns 400 with validation errors |
| **Security** | No stack traces in error responses; exception filter removes internal error details |
| **Rollback** | Delete `apps/api/` directory; no DB changes |

---

## TASK-002: Prisma Schema and Neon Database Migration

| Property | Value |
|---|---|
| **Objective** | Apply the full Phase 1 Prisma schema to Neon PostgreSQL; verify connection; enable required extensions |
| **Files/Modules** | `apps/api/prisma/schema.prisma`, `apps/api/prisma/migrations/`, `apps/api/src/prisma/prisma.service.ts` |
| **Prerequisites** | TASK-001; Neon database created; `DATABASE_URL` in `.env.local` |
| **Approach** | Copy schema from DATA_MODEL_AND_CONTRACTS.md; `prisma migrate dev --name init`; verify with `prisma studio`; enable `pg_trgm` extension via migration |
| **Tests** | Integration test: `PrismaService` can execute `SELECT 1`; verify all tables created; verify indexes created |
| **Acceptance criteria** | `prisma migrate status` shows all migrations applied; `pg_trgm` extension enabled; `PrismaService` injects successfully |
| **Security** | Connection string only in env; DB user has least-privilege grants; SSL required |
| **Rollback** | `prisma migrate resolve --rolled-back <migration_id>`; Neon branch allows safe testing |

---

## TASK-003: Authentication Module (NextAuth.js + Passport)

| Property | Value |
|---|---|
| **Objective** | Implement email/password and Google OAuth authentication; JWT session management; role-based guards |
| **Files/Modules** | `apps/web/app/api/auth/[...nextauth]/route.ts`, `apps/api/src/auth/auth.module.ts`, `apps/api/src/auth/guards/`, `packages/types/src/auth.ts` |
| **Prerequisites** | TASK-002 |
| **Approach** | NextAuth.js v5 with Prisma adapter; custom credentials provider with Argon2id; Google OAuth provider; JWT strategy in NestJS Passport; `@Roles()` guard |
| **Tests** | Unit: password hashing and verification; Integration: login flow returns session; Role guard blocks unauthorized access |
| **Acceptance criteria** | User can register with email/password; User can sign in with Google; Session persists across requests; READER cannot access admin routes (403); Admin requires MFA |
| **Security** | Argon2id hashing; HttpOnly Secure cookies; CSRF token; MFA for admin; session invalidation on logout; rate limit on auth endpoints |
| **Rollback** | Remove auth tables via migration rollback; no data loss (no users yet) |

---

## TASK-004: News Source Configuration Module

| Property | Value |
|---|---|
| **Objective** | Build the admin interface for adding, configuring, and managing news sources (RSS feeds and API providers) |
| **Files/Modules** | `apps/api/src/news/sources/sources.service.ts`, `apps/api/src/news/sources/sources.controller.ts`, `apps/web/app/admin/sources/` |
| **Prerequisites** | TASK-003 |
| **Approach** | CRUD API for `NewsSource` model; seed initial 15 RSS sources; admin UI form to add/edit sources; source health status display |
| **Tests** | Unit: source validation; Integration: admin can create source; non-admin gets 403 |
| **Acceptance criteria** | Admin can add RSS source with URL, name, category, polling interval; source shows health status (last polled, failure count) |
| **Security** | Admin-only routes; audit log entry on every source create/update/delete |
| **Rollback** | Delete seed data; no structural changes |

---

## TASK-005: RSS Ingestion Worker

| Property | Value |
|---|---|
| **Objective** | Build the RSS polling worker that fetches, parses, deduplicates, sanitizes, and stores source items |
| **Files/Modules** | `apps/api/src/ingestion/adapters/rss.adapter.ts`, `apps/api/src/ingestion/ingestion.service.ts`, `apps/api/src/jobs/ingestion.processor.ts` |
| **Prerequisites** | TASK-004; BullMQ + Redis configured |
| **Approach** | BullMQ scheduled job per active source; `rss-parser` library; sanitize with `isomorphic-dompurify`; SHA-256 dedupe hash; store in `source_items` with PENDING state; log attempt in `ingestion_attempts` |
| **Tests** | Unit: RSS adapter parses known feed correctly; deduplication rejects duplicate hash; sanitizer strips `<script>` tags; Integration: end-to-end ingestion of The Hindu RSS |
| **Acceptance criteria** | 10 RSS feeds polled within 15 minutes; duplicate articles not double-stored; `<script>` content stripped; ingestion attempts logged; source `lastPolledAt` updated |
| **Security** | No full article text stored; external URLs not followed recursively; sanitization before any storage |
| **Rollback** | Clear `source_items` and `ingestion_attempts` tables; restart worker |

---

## TASK-006: Editorial Dashboard — Review Queue

| Property | Value |
|---|---|
| **Objective** | Build the editorial review interface for approving/rejecting ingested source items |
| **Files/Modules** | `apps/web/app/admin/queue/`, `apps/api/src/admin/editorial.controller.ts`, `apps/api/src/admin/editorial.service.ts` |
| **Prerequisites** | TASK-005 |
| **Approach** | Admin/Editor dashboard showing PENDING and NORMALIZED items; approve → ProcessingState.APPROVED; reject → ProcessingState.REJECTED with mandatory reason; audit log entry on every action |
| **Tests** | Integration: editor approves item; item state changes to APPROVED; audit log records action; reader cannot access queue (403) |
| **Acceptance criteria** | Editor can see all PENDING items; approve/reject with one click; rejected items require reason; every action appears in audit log; source-item count badge visible |
| **Security** | Audit log write on every approve/reject; reason mandatory for rejection; EDITOR and ADMIN roles only |
| **Rollback** | State changes are tracked in audit log; manual re-review if needed |

---

## TASK-007: Public News Feed API

| Property | Value |
|---|---|
| **Objective** | Build the public-facing API endpoints serving approved news articles by category |
| **Files/Modules** | `apps/api/src/news/news.controller.ts`, `apps/api/src/news/news.service.ts`, `apps/api/src/news/dto/` |
| **Prerequisites** | TASK-006 |
| **Approach** | `GET /news` (paginated, filter by category); `GET /news/:id` (single article with provenance); Redis cache (5-minute TTL) on feed responses; ETag support |
| **Tests** | Unit: service returns only APPROVED items; Integration: category filter works; Redis cache hit tested; unauthenticated request returns 200 on public endpoints |
| **Acceptance criteria** | Feed returns only editor-approved items; category filter works for all 8 categories; response time <200ms (cache hit); provenance state included in every item |
| **Security** | No raw internal IDs exposed in public responses; rate limiting applied |
| **Rollback** | N/A — read-only endpoints |

---

## TASK-008: Next.js Web App Scaffold and News Feed UI

| Property | Value |
|---|---|
| **Objective** | Scaffold the Next.js web app and build the category news feed UI |
| **Files/Modules** | `apps/web/app/layout.tsx`, `apps/web/app/(news)/page.tsx`, `apps/web/app/(news)/[category]/page.tsx`, `apps/web/components/ArticleCard.tsx`, `apps/web/components/ProvenanceBadge.tsx` |
| **Prerequisites** | TASK-007 |
| **Approach** | `create-next-app` with App Router; shadcn/ui + Tailwind; ArticleCard with headline, source, time, provenance badge, category; category sidebar; mobile responsive |
| **Tests** | Playwright: homepage loads and shows articles; provenance badge visible; click through to source URL opens correctly |
| **Acceptance criteria** | All 8 category feeds render; each article card shows provenance badge; clicking source link opens original article in new tab; mobile-responsive layout |
| **Security** | CSP headers configured; no inline scripts; HSTS enabled |
| **Rollback** | Frontend only; no DB impact |

---

## TASK-009: Collaboration Radar — PR Source Integration

| Property | Value |
|---|---|
| **Objective** | Add PR Newswire and Business Wire India RSS adapters; build collaboration claim creation from PR articles |
| **Files/Modules** | `apps/api/src/ingestion/adapters/pr-wire.adapter.ts`, `apps/api/src/collaboration/collaboration.service.ts`, `apps/api/src/collaboration/collaboration.controller.ts` |
| **Prerequisites** | TASK-006 |
| **Approach** | Specialized RSS adapter that extracts brand + creator mentions from PR headlines; creates `CollaborationClaim` with UNVERIFIED state; requires editorial review to upgrade provenance |
| **Tests** | Unit: PR article with brand+creator mention creates claim with UNVERIFIED state; Integration: editor can review and approve claim |
| **Acceptance criteria** | PR wire items ingested; brand-creator mentions extracted and stored as claims; claims displayed with UNVERIFIED badge until editor confirms; evidence link connects claim to source item |
| **Security** | Claims never auto-published; editorial gate required |
| **Rollback** | Delete claims created by test ingestion |

---

## TASK-010: Creator Profile Pages

| Property | Value |
|---|---|
| **Objective** | Build creator and brand profile pages showing collaboration history with evidence |
| **Files/Modules** | `apps/web/app/creator/[handle]/page.tsx`, `apps/web/app/brand/[slug]/page.tsx`, `apps/api/src/creator/creator.controller.ts` |
| **Prerequisites** | TASK-009 |
| **Approach** | Static-ish pages with revalidation every 30 min; show collaboration claims with provenance state and evidence links; no Instagram API data unless creator has authenticated |
| **Tests** | Playwright: creator profile renders with at least one collaboration; evidence link opens source; unverified badge displayed for unconfirmed claims |
| **Acceptance criteria** | Creator profile shows name, category, collaboration history; each collaboration shows provenance badge and links to evidence source |
| **Security** | No private creator data displayed; only data from approved sources |
| **Rollback** | Frontend only |

---

## TASK-011: Search

| Property | Value |
|---|---|
| **Objective** | Implement full-text search using PostgreSQL `pg_trgm` |
| **Files/Modules** | `apps/api/src/search/search.service.ts`, `apps/api/src/search/search.controller.ts`, `apps/web/app/search/page.tsx` |
| **Prerequisites** | TASK-008 |
| **Approach** | `pg_trgm` GIN index on `headline`; `similarity()` function for ranking; search API with pagination; debounced search input in UI |
| **Tests** | Integration: search for "SEBI" returns relevant articles; typo-tolerance test |
| **Acceptance criteria** | Search returns results in <500ms; minimum 5 relevant results for common India news terms; zero results message shown when empty |
| **Security** | Input sanitized; rate limited (10/min per user) |
| **Rollback** | Drop GIN index only if performance issue; feature flag to disable |

---

## TASK-012: User Account, Follows, and Bookmarks

| Property | Value |
|---|---|
| **Objective** | User profile page with category interests, followed entities, and bookmarks |
| **Files/Modules** | `apps/web/app/profile/page.tsx`, `apps/api/src/user/user.controller.ts`, `apps/api/src/user/bookmarks.service.ts` |
| **Prerequisites** | TASK-003, TASK-007 |
| **Approach** | Follow/unfollow creator or brand; bookmark article; personalized feed as merge of followed entities + category interests; all behind authentication |
| **Tests** | Integration: user follows creator; creator appears in feed; bookmark saved and retrieved across sessions |
| **Acceptance criteria** | User can follow/unfollow; bookmarks persist across browser sessions; personalized feed shows content from followed entities |
| **Security** | Ownership checks on all bookmark and follow operations; auth required |
| **Rollback** | Delete follow/bookmark records; no structural impact |

---

## TASK-013: CI/CD Pipeline and Staging Deployment

| Property | Value |
|---|---|
| **Objective** | Complete GitHub Actions CI pipeline; staging environment fully deployed; production deployment with manual gate |
| **Files/Modules** | `.github/workflows/ci.yml`, `.github/workflows/deploy-staging.yml`, `.github/workflows/deploy-production.yml` |
| **Prerequisites** | All previous tasks |
| **Approach** | CI: lint + typecheck + test + build + secret scan + dependency audit; staging: auto-deploy on merge to `main`; production: manual approval required |
| **Tests** | Verify CI fails with a deliberately introduced lint error; verify staging deploys successfully; verify production requires approval |
| **Acceptance criteria** | Every PR runs full CI; staging deployment succeeds; production deployment blocked without approval; no secrets in CI logs |
| **Security** | Secrets in GitHub Secrets only; staging uses staging secrets; production uses production secrets |
| **Rollback** | Pipeline configuration in Git; revert commit |

---

## TASK-014: Integration Tests and RSS Source Verification

| Property | Value |
|---|---|
| **Objective** | Execute all integration tests from FEASIBILITY_DECISIONS.md IT-001 through IT-006 |
| **Files/Modules** | `apps/api/test/integration/rss-sources.spec.ts`, `apps/api/test/integration/db-connection.spec.ts` |
| **Prerequisites** | TASK-005 |
| **Approach** | Programmatic HTTP fetch of each RSS URL; verify non-empty response; parse XML; count articles; verify Neon DB connection; store results in test report |
| **Tests** | All 10 priority sources return ≥5 items; Neon DB `SELECT 1` succeeds |
| **Acceptance criteria** | All 10 tier-1 sources verified; results documented; any failing sources flagged for editorial team |
| **Security** | No credentials used for RSS testing (public feeds); Neon test uses read-only test user |
| **Rollback** | N/A — read-only test |

---

## Phase 1 Definition of Done

Phase 1 is complete when **ALL** of the following are true:

- [ ] TASK-000 through TASK-014 complete with all acceptance criteria met
- [ ] All 10 priority RSS sources ingesting successfully (TASK-014 verified)
- [ ] Editorial dashboard operational; no article visible to users without editor approval
- [ ] All 8 news category feeds render with ≥20 approved articles each
- [ ] Every article card shows provenance badge with source link
- [ ] Collaboration Radar shows ≥5 confirmed collaborations with evidence links
- [ ] Search returns results in <500ms P95
- [ ] Authentication works (email/password + Google OAuth)
- [ ] Admin role gates verified (403 for unauthorized access)
- [ ] CI pipeline passes on every PR (lint, typecheck, tests, secret scan)
- [ ] Staging environment deployed and accessible
- [ ] Production environment deployed with manual gate
- [ ] No secrets committed to Git (gitleaks scan clean)
- [ ] OWASP ASVS Level 1 checklist reviewed; critical items addressed
- [ ] `ENVIRONMENT_AUDIT.md` updated to reflect final state
