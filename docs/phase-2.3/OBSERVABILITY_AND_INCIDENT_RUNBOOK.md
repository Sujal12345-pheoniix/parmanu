# PARMANU OBSERVABILITY & INCIDENT RUNBOOK
## Phase 2.3 — Monitoring, Health Probing & Operational Incident Playbooks

---

### 1. Observability Architecture

Parmanu implements continuous operational observability across every stage of ingestion, story clustering, and publication.

```mermaid
flowchart LR
    A["Client Request / Scheduler"] -->|"x-request-id"| B["Express API Gateway"]
    B -->|"Correlation ID Log"| C["Structured Console Logger"]
    B -->|"Liveness Probe"| D["/api/v1/health"]
    B -->|"Readiness Probe (DB Latency)"| E["/api/v1/readiness"]
    B -->|"Editorial Metrics"| F["/api/v1/editorial/overview"]
    B -->|"Neon PostgreSQL"| G[("Neon DB")]
```

#### 1.1 Correlation IDs & Request Tracing
- Every HTTP request receives an `x-request-id` header (either preserved from incoming gateway or generated as `req_<hex8>`).
- Format:
  `[2026-10-16T10:45:00.000Z] POST /api/v1/clusters/cuid123/publish 200 - 45ms (req_a1b2c3d4e5f6)`
- Correlation IDs are echoed back in the response headers and in every standard JSON error envelope (`meta.requestId`).

#### 1.2 Secret Redaction & Log Sanitization
- `maskSecret()` actively redacts sensitive tokens, API keys, and database passwords before they reach log outputs.
- Database connection strings display only hostname and masked password: `postgresql://neondb_owner:***@ep-rapid-brook-b5v7uwvz-pooler.c-7.us-east-2.aws.neon.tech/neondb`.
- Provider API keys and Instagram OAuth tokens are encrypted at rest using AES-256-GCM.

#### 1.3 Liveness vs. Readiness Probing
- **Liveness (`GET /api/v1/health`)**: Lightweight check returning HTTP 200 verifying that the Node.js process event loop is active and responsive.
- **Readiness (`GET /api/v1/readiness`)**: Deep health probe. Executes a lightweight `SELECT 1` query to Neon PostgreSQL and checks connection latency.
  - HTTP 200: Database connected and query latency $\le 500\text{ms}$.
  - HTTP 503: Database disconnected. Traffic must not be routed to unready containers.

---

### 2. Operational Metrics & Alert Thresholds

| Metric | Source Endpoint | Warning Threshold | Critical Alert Threshold | Recommended Action |
| :--- | :--- | :--- | :--- | :--- |
| **Ingestion Job Failures** | `GET /api/v1/editorial/overview` (`failedJobs24h`) | $> 3$ in 24 hours | $> 10$ in 24 hours | Inspect source health; trigger manual poll |
| **Database Latency** | `GET /api/v1/readiness` (`database.latencyMs`) | $> 250\text{ms}$ | $> 1000\text{ms}$ | Check Neon connection pooler capacity |
| **Review Queue Age** | `GET /api/v1/editorial/queue` | $> 12\text{ hours}$ | $> 48\text{ hours}$ | Reallocate editors to priority triage |
| **Failing Sources** | `GET /api/v1/editorial/overview` (`failingSources`) | $\ge 1$ source | $\ge 3$ sources | Check source provider endpoints & credentials |
| **Rate-Limited Runs** | `GET /api/v1/ingestion/jobs` | 1 occurrence | $\ge 3$ consecutive | Back off polling interval ($\ge 30\text{m}$) |

---

### 3. Incident Response Playbooks

#### Incident 1: Provider Rate-Limit Exhaustion (`HTTP 429`)
- **Symptoms:** Ingestion jobs fail with `ConnectorFailureType.RATE_LIMITED` and `httpStatus: 429`.
- **Immediate Mitigation:**
  1. Inspect the job record via `GET /api/v1/ingestion/jobs/:id`. Check `errorSummary`.
  2. The connector automatically respects the `Retry-After` header when provided.
  3. Increase the source polling interval from 15 minutes to 30 or 60 minutes:
     ```http
     PATCH /api/v1/sources/:id
     { "pollingIntervalMinutes": 60 }
     ```
  4. Never spam manual retries against rate-limited providers.

#### Incident 2: Provider Authentication Expiry
- **Symptoms:** Source returns `AUTH_ERROR` (`httpStatus: 401` or `403`).
- **Immediate Mitigation:**
  1. For Guardian or GNews APIs: Rotate the developer API key in the environment or source `apiConfig`.
  2. For Creator Instagram OAuth: Verify if the long-lived user access token has reached its 60-day expiry.
  3. Update source configuration via `PATCH /api/v1/sources/:id`.
  4. Trigger a test poll: `POST /api/v1/ingestion/trigger` with `{ "sourceId": "<id>" }`.

#### Incident 3: Ingestion Queue Backlog / Spikes
- **Symptoms:** High memory usage; ingestion duration exceeding 30 seconds.
- **Immediate Mitigation:**
  1. Verify the `maxItemsPerPoll` setting on active sources (default: 50).
  2. If a breaking news event floods the RSS feed, set temporary filtering or process sequentially.
  3. The layered deduplication cache discards redundant stories within 2ms per item.

#### Incident 4: Database Connection Pool Starvation
- **Symptoms:** `/api/v1/readiness` returns 503; errors contain `Timed out fetching a new connection from the connection pool`.
- **Immediate Mitigation:**
  1. Verify the Neon PostgreSQL pooling endpoint URL (`-pooler` suffix in hostname).
  2. Ensure connection pooling is enabled on Prisma datasource: `?pgbouncer=true&connection_limit=10`.
  3. Check active connections in Neon console. Restart container instance if pool is deadlocked.

#### Incident 5: Duplicate Processing or Runaway Clustering
- **Symptoms:** Multiple story clusters created for the identical event.
- **Immediate Mitigation:**
  1. Identify primary and secondary cluster IDs.
  2. Execute cluster merge:
     ```http
     POST /api/v1/clusters/merge
     {
       "primaryClusterId": "<primary-id>",
       "secondaryClusterId": "<duplicate-id>",
       "reason": "Automated merge of parallel wire dispatches"
     }
     ```
  3. Inspect `ClusterMergeSplitLog` for audit confirmation.

#### Incident 6: Emergency Retraction of Accidental / False Publication
- **Symptoms:** An unverified or factually false story cluster was published to the public consumer feed.
- **Immediate Mitigation:**
  1. Authorized Admin logs in immediately.
  2. Execute emergency retraction:
     ```http
     POST /api/v1/clusters/:id/retract
     Authorization: Bearer <ADMIN_TOKEN>
     {
       "reason": "RETRACTION: Retracted due to erroneous report issued by external news wire. The event did not occur.",
       "editorialNotes": "Emergency retraction by Admin on call"
     }
     ```
  3. Verification:
     - Check public endpoint `GET /api/v1/news`: the cluster is removed from standard approved feed.
     - Direct URL permalink displays clear `✖ Retracted` notice with the official retraction reason.
     - Historical audit log is preserved in `AuditLog` table.
