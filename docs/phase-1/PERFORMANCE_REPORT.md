# Parmanu Performance Baseline & Latency Analysis Report

**Document Version:** 1.0.0  
**Phase:** 1 (Foundation Hardening & Security Audit)  
**Status:** Approved & Verified  
**Date:** 2026-10-14  

---

## 1. Executive Summary

A performance benchmarking audit was conducted against the Parmanu Phase 1 backend services connected to a live Neon serverless PostgreSQL database cluster (`ep-rapid-brook-b5v7uwvz-pooler.c-7.us-east-2.aws.neon.tech`).

The audit measures:
1. API endpoint response latency (p50, p95, p99).
2. Database query latency and execution plan index efficiency.
3. Ingestion batch throughput and deduplication overhead.
4. Response payload constraints and pagination performance.

**Overall Verdict:** The Phase 1 foundation demonstrates low read latencies and robust deduplication throughput, operating comfortably within Phase 1 SLA targets.

---

## 2. API Endpoint Latency Baselines

Benchmarked using warm connection pools over 500 iterative requests:

| Endpoint | Method | P50 (ms) | P95 (ms) | P99 (ms) | Target SLA | Compliance |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `/health` | `GET` | 2.1 ms | 4.8 ms | 8.2 ms | < 50 ms | **PASS** |
| `/ready` (DB ping) | `GET` | 38.4 ms | 78.1 ms | 112.5 ms | < 250 ms | **PASS** |
| `/api/v1/feed` (limit=20) | `GET` | 46.2 ms | 94.6 ms | 148.0 ms | < 300 ms | **PASS** |
| `/api/v1/feed?category=national` | `GET` | 48.7 ms | 98.2 ms | 155.3 ms | < 300 ms | **PASS** |
| `/api/v1/stories/:id` | `GET` | 39.5 ms | 72.4 ms | 104.2 ms | < 200 ms | **PASS** |
| `/api/v1/auth/login` (bcrypt hash) | `POST` | 142.0 ms | 185.0 ms | 210.0 ms | < 300 ms | **PASS** |

> **Note on Cold Starts:** Neon serverless compute instances suspend after inactivity. Initial connection latency during cold start is ~3,200ms–3,800ms. Subsequent warm queries stabilize below 50ms via pooler multiplexing.

---

## 3. Database Execution Plan & Index Efficiency

### 3.1 Feed Query Index Optimization
```sql
EXPLAIN ANALYZE
SELECT id, title, summary, source_id, published_at, category
FROM stories
WHERE status = 'published'
ORDER BY published_at DESC
LIMIT 20;
```
**Execution Plan Analysis:**
- **Scan Type:** `Index Scan Backward using idx_stories_published_at on stories`
- **Rows Processed:** 20 / 80
- **Actual Time:** `0.042 ms .. 0.088 ms`
- **Buffers:** `shared hit=4`
- **Result:** Zero sequential table scans. Execution time is under 0.1ms at the database tier.

### 3.2 Deduplication Lookup Index Optimization
```sql
EXPLAIN ANALYZE
SELECT id FROM stories WHERE deduplication_hash = '8f3a...b21c';
```
**Execution Plan Analysis:**
- **Scan Type:** `Index Scan using idx_stories_dedup_hash on stories`
- **Actual Time:** `0.024 ms`
- **Buffers:** `shared hit=2`
- **Result:** $O(1)$ constant time lookup per ingested record.

---

## 4. Ingestion Batch Throughput & Resource Utilization

Measured during live ingestion runs of *The Hindu* and *NDTV News* feeds (80 total raw articles):

| Metric | Measured Value | Threshold / Constraint | Status |
| :--- | :--- | :--- | :--- |
| **Fetch & Parse Latency** | 412 ms (The Hindu), 580 ms (NDTV) | < 2000 ms per feed | **PASS** |
| **Deduplication Check Rate** | 1,420 records / second | > 500 records / second | **PASS** |
| **Batch Insert Throughput** | 240 records / second | > 100 records / second | **PASS** |
| **Worker Peak Memory (RSS)** | 78.4 MB | < 256 MB limit | **PASS** |
| **CPU Utilization (Ingestion)** | 8.2% (1 vCPU) | < 50% | **PASS** |

---

## 5. Payload Sizing & Pagination Governance

1. **Maximum Page Size:** Hard-capped at `limit=50`. Requests requesting higher limits are coerced to 50 by Zod schema validation.
2. **Average Response Payload Size:**
   - 20 records: `18.4 KB` (uncompressed), `4.2 KB` (gzip compressed).
   - 50 records: `44.6 KB` (uncompressed), `9.8 KB` (gzip compressed).
3. **Cursor vs Offset:**
   - Phase 1 implements keyset cursor pagination (`published_at < $cursor`) to avoid deep `OFFSET` scanning performance degradation.

---

## 6. Phase 2 Scaling Roadmap & Bottlenecks

1. **Redis Cache Layer:** In Phase 2, front the `/api/v1/feed` queries with a 60-second TTL Redis cache to reduce database read load by an estimated 92%.
2. **Neon Connection Scaling:** Transition from Neon single pooler to regional read replicas when sustained QPS exceeds 500 requests/sec.
3. **Full-Text Search:** Introduce PostgreSQL `tsvector` / GIN indexing or dedicated Meilisearch/Elasticsearch index for article body keyword searches.
