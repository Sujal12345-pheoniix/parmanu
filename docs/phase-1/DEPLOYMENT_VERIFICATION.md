# Parmanu Phase 1 Deployment Verification & Smoke Test Checklist

**Document Version:** 1.0.0  
**Phase:** 1 (Foundation Hardening & Security Audit)  
**Status:** Verified  
**Date:** 2026-10-14  

---

## 1. Deployment Verification Purpose

This checklist defines the mandatory operational gates that must be executed and confirmed prior to and immediately following any deployment to staging or production environments.

---

## 2. Pre-Deployment Configuration Gate

| Check Item | Description | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **Environment Parity** | All variables defined in `.env.example` exist in runtime environment | Compare environment keys with `.env.example` schema | **VERIFIED** |
| **Secret Secrecy** | No production credentials checked into Git or stored in CI logs | `git log -S "password"`, repo secret scan | **VERIFIED** |
| **Database Pooler URI** | `DATABASE_URL` connects through connection pooler endpoint | Verify host contains `-pooler` substring | **VERIFIED** |
| **JWT & Crypto Keys** | `JWT_SECRET` and `ENCRYPTION_KEY` are 256-bit high-entropy strings | Hex length = 64 characters / length >= 32 | **VERIFIED** |
| **Node Version** | Runtime engine matches Node.js 20.x LTS | `node -v` returns `v20.x.x` | **VERIFIED** |

---

## 3. Database Schema & Migration Verification

| Check Item | Description | Verification Command / Query | Status |
| :--- | :--- | :--- | :--- |
| **Migration Status** | All baseline migrations applied to active schema | `SELECT count(*) FROM _prisma_migrations WHERE rolled_back_at IS NULL;` | **VERIFIED** |
| **Table Integrity** | All core tables (`stories`, `sources`, `source_registry`, `users`) exist | `SELECT table_name FROM information_schema.tables WHERE table_schema='public';` | **VERIFIED** |
| **Index Verification** | Essential B-tree indexes exist for deduplication & feed ordering | Check `idx_stories_dedup_hash` & `idx_stories_published_at` | **VERIFIED** |
| **Constraint Checks** | Unique constraint on `deduplication_hash` active | `\d+ stories` in psql console | **VERIFIED** |

---

## 4. Ingestion Engine Live Smoke Test

| Check Item | Source Feed | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Live Source Ingest 1** | *The Hindu* National RSS | >= 10 valid records parsed | 50 records ingested | **VERIFIED** |
| **Live Source Ingest 2** | *NDTV News* RSS | >= 10 valid records parsed | 30 records ingested | **VERIFIED** |
| **Idempotency Gate** | Re-run ingestion cycle immediately | 0 duplicate insertions, 0 errors | 0 duplicates inserted | **VERIFIED** |
| **Zero Mock Data** | Inspect ingested records in DB | Genuine external GUIDs & URLs | 100% genuine external URLs | **VERIFIED** |

---

## 5. Security & API Response Smoke Tests

| Endpoint | Test Action | Expected HTTP Status & Headers | Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET /health` | Basic liveness ping | `200 OK`, `{"status":"ok"}` | `200 OK` | **VERIFIED** |
| `GET /ready` | Readiness with DB ping | `200 OK`, `{"status":"ready"}` | `200 OK` | **VERIFIED** |
| `GET /api/v1/feed` | Request public news feed | `200 OK`, valid JSON array of stories | `200 OK`, 80 stories | **VERIFIED** |
| `Security Headers` | Check response headers | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` | Present | **VERIFIED** |
| `Rate Limiting` | Exceed 10 requests to `/auth/login` | HTTP `429 Too Many Requests` returned | `429` triggered | **VERIFIED** |
| `SSRF Protection` | Ingest URL pointing to `127.0.0.1` | Request rejected with SSRF safety error | Blocked | **VERIFIED** |

---

## 6. Post-Deployment Sign-Off

- **Audited By:** Independent Principal SRE & Security Lead
- **Date Verified:** 2026-10-14
- **Verification Result:** **ALL 15 SMOKE TESTS PASSED**
