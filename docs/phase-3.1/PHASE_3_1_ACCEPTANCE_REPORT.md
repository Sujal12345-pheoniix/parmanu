# Phase 3.1 Acceptance Report: Consumer Platform, News Discovery & Article Experience

## Executive Summary

Phase 3.1 delivers the first complete consumer-facing product experience for **The Tatva / Parmanu**, transforming the Phase 1 ingestion foundation, Phase 2 data pipeline, and Phase 2.3 editorial verification engine into an interactive, real-time news and creator-intelligence platform.

The implementation is **not a static Stitch prototype**; every view, modal, feed, and action is connected to live, type-safe API endpoints backed by Neon PostgreSQL and Prisma ORM.

---

## 1. Architectural Implementation & Deliverables

### A. Centralized Consumer APIs & Schema (`apps/api`)
- **Prisma Schema Enhancement**:
  - Added `storyClusterId String?` and `storyCluster StoryCluster?` relation to `Bookmark` model with composite unique constraint `@@unique([userId, storyClusterId])`.
  - Pushed to Neon PostgreSQL serverless database with zero data loss.
- **Bookmarks Controller (`apps/api/src/controllers/bookmarks.controller.ts`)**:
  - `GET /api/v1/bookmarks`: Paginated, authenticated list of user's saved story clusters and source items, including publisher attribution and provenance status.
  - `POST /api/v1/bookmarks`: Idempotent saving of story clusters and source items with target validation.
  - `DELETE /api/v1/bookmarks/:id`: Authenticated removal of saved bookmarks with strict user isolation.
  - `GET /api/v1/bookmarks/check/:storyClusterId`: Instant status check for client bookmark buttons.
- **Consumer Discovery Controller (`apps/api/src/controllers/consumer.controller.ts`)**:
  - `GET /api/v1/stories/featured`: Selects the highest-corroboration, highest-confidence published story cluster for the Hero Lead section.
  - `GET /api/v1/stories/trending`: Deterministic ranking of published clusters combining corroboration count (`itemCount`), confidence score, and recency, with optional category filtering.
  - `GET /api/v1/categories`: Dynamic aggregation of published story clusters into normalized categories with live counts.
  - `GET /api/v1/search`: Global search indexing published story headlines, summaries, and resolved entities (creators, brands, organizations).

### B. Shared Contracts (`packages/types`)
- Extended `@parmanu/types` with Zod schemas:
  - `CreateBookmarkSchema`
  - `BookmarkQuerySchema`
  - `TrendingStoriesQuerySchema`
  - `ConsumerFeedQuerySchema`
  - `ConsumerSearchQuerySchema`

### C. Consumer Web Client (`apps/web`)
- **Centralized Typed API Client (`apps/web/src/api/client.ts`)**:
  - Centralized, strongly-typed HTTP methods for all consumer endpoints.
  - Automatic JWT bearer authorization token injection from local storage.
  - Clean error handling with fallbacks.
- **Client Interactive Engine (`apps/web/src/main.ts`)**:
  - **Hero Lead Article**: Live binding to `/api/v1/stories/featured` with integrity verdicts and attribution.
  - **Trending Stories**: Live binding to `/api/v1/stories/trending`.
  - **Verified Dispatch Feed**: Live paginated category dispatches from `/api/v1/clusters` with reactive category pills.
  - **Interactive Dossier Modal (`#dossier-main`)**: Detailed breakdown of primary headlines, summaries, corroborating sources, verified factual claims with supporting/contradicting stances, and correction notices.
  - **Global Search Modal**: Debounced search with ⌘K / Ctrl+K keyboard shortcut, instant entity tags, and direct story links.
  - **Bookmarks Drawer**: Saved dossiers list with instant unsave and click-to-open actions.
  - **Deep-linking & URL State**: Preserves `?category=...&story=...` in browser history across refreshes.
  - **Web Share API**: Native device share with clipboard fallback and toast feedback.

---

## 2. Screen-to-API Contract Mapping

| Screen / Component | Functional Action | API Endpoint | HTTP Method | Auth Required | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Global Shell** | User session check | `/api/v1/auth/me` | GET | Optional | Fully Functional |
| **Hero Article** | Load lead featured story | `/api/v1/stories/featured` | GET | Public | Fully Functional |
| **Sidebar Alert** | Load trending stories | `/api/v1/stories/trending` | GET | Public | Fully Functional |
| **Category Bar** | Category listing & counts | `/api/v1/categories` | GET | Public | Fully Functional |
| **Dispatch Feed** | Filtered story stream | `/api/v1/clusters?category=...` | GET | Public | Fully Functional |
| **Story Dossier** | Full dossier details | `/api/v1/clusters/:id` | GET | Public | Fully Functional |
| **Global Search** | Cross-cutting search | `/api/v1/search?q=...` | GET | Public | Fully Functional |
| **Bookmark Save** | Save cluster/item | `/api/v1/bookmarks` | POST | Required (Bearer) | Fully Functional |
| **Bookmark Check** | Check saved status | `/api/v1/bookmarks/check/:id`| GET | Optional | Fully Functional |
| **Bookmark List** | View saved dossiers | `/api/v1/bookmarks` | GET | Required (Bearer) | Fully Functional |
| **Bookmark Delete**| Unsave dossier | `/api/v1/bookmarks/:id` | DELETE | Required (Bearer) | Fully Functional |

---

## 3. Data Integrity & Security Standards

1. **Zero Fabrication**:
   - The consumer platform never generates placeholder article bodies, fabricated follower counts, or simulated engagement metrics.
   - All source attribution links point to authentic canonical URLs with real timestamps.
2. **Strict Privacy Redaction**:
   - Internal newsroom fields (`reviewNotes`, `assignedTo`) are stripped at the API boundary before delivering payloads to consumer requests.
   - Draft, rejected, or unverified clusters (`status: 'UNDER_REVIEW'`, `'DETECTED'`, `'REJECTED'`) are inaccessible via consumer feeds.
3. **User Isolation**:
   - Bookmarks are strictly scoped by `userId` extracted from the cryptographically verified JWT token. Users cannot access or mutate bookmarks belonging to other accounts.
4. **Resilient Fallback**:
   - When offline or during cold boots, graceful empty states and retry buttons prevent layout breaking.

---

## 4. Automated Test Verification

All 59 automated unit, integration, and end-to-end tests pass cleanly across all workspaces:

```
✔ Security & Validation: Password hashing and verification (901ms)
✔ Security: JWT signing, claims encoding, and verification (10ms)
✔ Security: AES-256-GCM symmetric encryption of tokens at rest (3ms)
✔ Validation: RegisterUserSchema password strength and email constraints (0.8ms)
✔ SSRF Defense: Blocks internal networks and dangerous schemes (1.3ms)
✔ Deduplication: Computes consistent, collision-resistant SHA-256 hashes (0.9ms)
✔ RSS Connector: Parses XML feed fixture and normalizes to CanonicalSourceItem (3.5ms)
✔ Database Integration: Neon PostgreSQL live connection and query latency (0.3ms)
✔ Database Integration: Verified Indian News Sources present in Neon DB (0.2ms)
✔ XSS Defense: Content sanitization strips executable markup from feed text (0.3ms)
✔ Authorization: Server-side role separation blocks privilege escalation (0.2ms)
✔ Rate Limiter: Correctly throttles requests when threshold is exceeded (0.1ms)
✔ E2E Scenario 1: Approved connector retrieves and normalizes valid records with full provenance (84ms)
✔ E2E Scenario 2: Record is persisted with deterministic SHA-256 dedupe hash and provenance (1.4ms)
✔ E2E Scenario 3: Repeated fetch is identified as exact duplicate and prevented from duplicate insertion (0.6ms)
✔ E2E Scenario 4: Intelligence pipeline clusters multi-source event coverage into unified story cluster (1.9ms)
✔ E2E Scenario 5: Clustered story enters editorial review queue with priority indicators (0.2ms)
✔ E2E Scenario 6: Editor inspects atomic claims and attached evidence stances (0.2ms)
✔ E2E Scenario 7: State machine enforces valid approval transitions from CLUSTERED to VERIFIED_FOR_PUBLICATION (0.2ms)
✔ E2E Scenario 8: Authorized publisher publishes verified cluster and sets publishedAt timestamp (0.1ms)
✔ E2E Scenario 9: Public response includes attribution and provenance while strictly redacting private reviewer notes (0.2ms)
✔ E2E Scenario 10: RBAC blocks unauthenticated/READER users from approving, publishing, or inspecting unapproved stories (1.3ms)
✔ E2E Scenario 11: Correction and retraction are recorded with mandatory public notice and preserve historical record (0.5ms)
✔ E2E Scenario 12: Provider outage produces typed ConnectorError, increments failure metrics, and never invents content (0.1ms)
✔ E2E Scenario 13: Optimistic concurrency control rejects stale editorial updates (0.1ms)
✔ E2E Scenario 14: Complete Phase 2 lifecycle states and transitions integrity check (0.1ms)
✔ Phase 2.1: RSS Connector correctly parses fixture into canonical items (45ms)
✔ Phase 2.1: Government Feed Connector validates official domains and sets high trust (2.6ms)
✔ Phase 2.1: Guardian API Connector normalizes licensed excerpts with attribution (1.3ms)
✔ Phase 2.1: GNews API Connector handles commercial news payload (1.1ms)
✔ Phase 2.1: PR Wire Connector flags brand/creator collaboration markers (1.7ms)
✔ Phase 2.1: Instagram API Connector ingests voluntary creator posts and detects sponsorships (2.5ms)
✔ Phase 2.1: Empty successful provider response returns zero items cleanly (1.3ms)
✔ Phase 2.1: Connector correctly handles provider timeout with typed error (3140ms)
✔ Phase 2.1: Rate limiting extracts Retry-After and maps to RATE_LIMITED (16021ms)
✔ Phase 2.1: Malformed JSON or XML throws PARSE_ERROR (12ms)
✔ Phase 2.1: Authentication failure (missing / invalid key) throws AUTH_ERROR (0.3ms)
✔ Phase 2.1: Deduplication hash determinism and Unicode normalization (2.7ms)
✔ Phase 2.1: Retry exhaustion after max attempts with backoff (45ms)
✔ Phase 2.1: AdapterRegistry correctly resolves and manages all source types (0.6ms)
✔ Phase 2.1: Secret Redaction guarantees no API keys or tokens in logs or error messages (0.5ms)
✔ Phase 2.1: IngestionService skips disabled sources safely (0.4ms)
✔ Phase 2.1: RBAC authorization enforces admin-only privileges on source mutations (0.9ms)
✔ Phase 2.2: URL Canonicalization safely strips marketing tracking parameters (2.4ms)
✔ Phase 2.2: Normalization detects prompt injection in untrusted text (27ms)
✔ Phase 2.2: Layered Deduplication distinguishes exact item duplicates from syndicated wire copies (4.5ms)
✔ Phase 2.2: Distinguishes same event coverage from same entity involved in different events (1.0ms)
✔ Phase 2.2: Detects explicit Story Updates and Corrections (1.0ms)
✔ Phase 2.2: Story Cluster Lifecycle enforces valid state transitions (0.1ms)
✔ Phase 2.2: Evidence verification rules: Syndicated copies do NOT equal independent corroboration (0.8ms)
✔ Phase 2.2: Entity Resolution and Relationship Graph rules (1.6ms)
✔ Phase 2.2: AI Service Anti-Hallucination Gate drops ungrounded cited IDs (0.9ms)
✔ Phase 2.2: Editorial RBAC blocks unauthorized cluster merges and splits (1.4ms)
✔ Phase 3.1: Consumer Query Schemas correctly validate input boundaries (6ms)
✔ Phase 3.1: Bookmark schemas enforce target requirement and user isolation (0.7ms)
✔ Phase 3.1: Trending stories ranking algorithm accurately weights corroboration, confidence, and recency (0.8ms)
✔ Phase 3.1: Category distribution aggregation normalizes tags and handles duplicates (0.3ms)
✔ Phase 3.1: Consumer endpoints strip internal editorial notes and unapproved statuses (0.7ms)
✔ Phase 3.1: Consumer query filter strictly forbids DETECTED and UNDER_REVIEW clusters (0.1ms)

Total tests: 59 | Passed: 59 | Failed: 0 | Duration: 19.6s
```

---

## 5. Build and Typecheck Verification

- `@parmanu/types`: Clean compilation (`tsc`).
- `@parmanu/api`: Zero TypeScript errors (`tsc --noEmit`).
- `@parmanu/web`: Clean compilation and production asset generation (`tsc && vite build`).
- Monorepo root check: `npm run typecheck` passes with exit code 0.
