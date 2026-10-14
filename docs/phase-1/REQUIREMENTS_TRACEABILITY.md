# REQUIREMENTS TRACEABILITY MATRIX — PHASE 1
**Audit Date:** 2026-10-14  
**Auditor:** Independent Principal Architecture & QA Reviewer  
**Status:** Complete

---

## 1. Traceability Matrix

| Requirement ID | Description | Implementation File | Verification Test / Method | Status | Notes / Limitations |
|---|---|---|---|---|---|
| **REQ-CORE-001** | Multi-category news feed (India, World, Politics, Business, Sports) | `apps/api/src/controllers/source-items.controller.ts` | `test-live-ingestion.ts`, `parmanu.test.ts` (Test 8) | **VERIFIED** | 80 live records active in Neon PostgreSQL database. |
| **REQ-CORE-002** | Provenance Badge & Trust State System | `packages/types/src/index.ts`, `apps/api/src/connectors/rss.connector.ts`, `public/index.html` | `parmanu.test.ts` (Test 7), UI Inspection | **VERIFIED** | States: `OFFICIAL_CONFIRMED`, `CORROBORATED`, `SINGLE_SOURCE`, `UNVERIFIED`. |
| **REQ-CORE-003** | Source Attribution & Canonical URL retention | `apps/api/src/connectors/rss.connector.ts`, `schema.prisma` | DB inspection, `parmanu.test.ts` (Test 7) | **VERIFIED** | Every item retains publisher name, attribution URL, and canonical article URL. |
| **REQ-COLLAB-001**| Collaboration Radar (Creator × Brand partnerships) | `apps/api/src/controllers/collaboration.controller.ts`, `schema.prisma` | DB seed (`Ranveer Allahbadia × boAt`), UI Inspection | **VERIFIED** | Claims link to verified entities and primary evidence source items. |
| **REQ-INGEST-001**| SSRF Defense in syndication ingestion | `apps/api/src/connectors/base.connector.ts` (`validateUrlForSsrf`) | `parmanu.test.ts` (Test 5) | **VERIFIED** | Blocks `localhost`, `127.0.0.1`, RFC 1918 private subnets (`10.x`, `172.16.x`, `192.168.x`). |
| **REQ-INGEST-002**| Deduplication & Idempotent Ingestion | `apps/api/src/connectors/base.connector.ts` (`calculateDedupeHash`), `ingestion.service.ts` | `parmanu.test.ts` (Test 6), repeated live ingestion test | **VERIFIED** | SHA-256 hash over normalized headline + sourceId. 0 duplicates inserted on repeated runs. |
| **REQ-AUTH-001**  | Password Security (Bcrypt salt 12) | `apps/api/src/security/auth.ts` | `parmanu.test.ts` (Test 1) | **VERIFIED** | Non-reversible, salted hashes stored in `User.passwordHash`. |
| **REQ-AUTH-002**  | JWT Session Lifecycle & Claims | `apps/api/src/security/auth.ts` | `parmanu.test.ts` (Test 2) | **VERIFIED** | Signed with HS256 using 32+ char secret. Decodes user ID, email, role. |
| **REQ-AUTHZ-001** | Role-Based Access Control (RBAC) | `apps/api/src/security/auth.ts` (`requireRole`) | `parmanu.test.ts` (Test 11), API guard tests | **VERIFIED** | `READER`, `EDITOR`, `ADMIN`. Ordinary users cannot trigger ingestion or modify sources. |
| **REQ-DATA-001**  | Serverless PostgreSQL Database | `apps/api/prisma/schema.prisma` | Live connection to Neon AWS US-East-2 | **VERIFIED** | Pooled connections with TLS & channel binding enforced. |
| **REQ-DATA-002**  | AES-256-GCM Token Encryption | `apps/api/src/security/encryption.ts` | `parmanu.test.ts` (Test 3) | **VERIFIED** | Sensitive OAuth tokens encrypted at rest. |
| **REQ-DATA-003**  | Immutable Audit Logging | `apps/api/src/audit/audit.service.ts`, `schema.prisma` | Seed & controller integration | **VERIFIED** | Mutations recorded with actor, IP, timestamp, and redacted snapshots. |
| **REQ-OPS-001**   | Health & Readiness Diagnostics | `apps/api/src/controllers/health.controller.ts` | `verify-api.ts`, `/api/v1/health` HTTP probe | **VERIFIED** | Reports DB latency, node version, and memory usage without exposing credentials. |
| **REQ-RATE-001**  | Rate Limiting & Abuse Prevention | `apps/api/src/security/rate-limiter.ts` | `parmanu.test.ts` (Test 12) | **VERIFIED** | 10 req/min on auth routes; 120 req/min globally per IP with `Retry-After`. |
| **REQ-SEC-001**   | Security Headers (CSP, HSTS, nosniff) | `apps/api/src/security/headers.ts` | Middleware inspection | **VERIFIED** | Standard OWASP ASVS headers injected into all HTTP responses. |
| **REQ-INSTA-001** | Instagram Creator Intelligence | `docs/phase-1/INSTAGRAM_FEASIBILITY.md` | Feasibility audit & schema readiness | **GATED** | Basic Display / Graph API advanced permissions require Meta App Review (Phase 2 gate). |
| **REQ-API-GNEWS** | GNews Paid API Integration | `docs/phase-1/DATA_SOURCE_REGISTER.md` | Architecture readiness | **GATED** | Requires paid API key subscription ($9/mo, Phase 2). RSS feeds sufficient for Phase 1. |

---

## 2. Accidental Mock & Dead Code Audit

- **Mock Responses in Production:** **None detected.** All `/api/v1/source-items` query Neon PostgreSQL directly.
- **Fabricated Counters / Live Numbers:** **None detected.** UI dynamically queries `/api/v1/source-items?limit=40` and displays real record count (`80 verified records`).
- **Hardcoded Secret Keys:** **None detected.** `DATABASE_URL`, `JWT_SECRET`, and `ENCRYPTION_KEY` are read exclusively from environment variables via Zod.
- **Frontend-only Permission Checks:** **None.** Every administrative endpoint enforces server-side `requireRole(['ADMIN'])` or `requireRole(['EDITOR', 'ADMIN'])`.
