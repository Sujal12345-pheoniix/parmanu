# CONNECTOR RUNBOOK
**Source Ingestion Architecture & Operational Guide**

---

## 1. Supported Connector Types

| Connector | Status | Authentication | Capabilities | Rate Limit |
|---|---|---|---|---|
| `RssSourceConnector` | ✅ Verified Live | None (Public feeds) | RSS 2.0, Atom feeds, Enclosure media | 1 req / 10 min |
| `MetaInstagramConnector` | ⚠️ Pending App Review | OAuth 2.0 Bearer | Creator media list, Insights | 200 req / hour |
| `GNewsConnector` | 📋 Phase 2 Ready | API Key Header | Query search, Top headlines | Per subscription |

---

## 2. Ingestion Lifecycle

```
[Scheduled Poll / Manual Trigger]
               │
               ▼
   [SSRF Defense Validation]
   - Rejects localhost, 127.0.0.1, RFC 1918 subnets
               │
               ▼
    [HTTP GET with Backoff & Jitter]
    - Timeout: 12 seconds
    - Bounded retries: 3 attempts with ±20% jitter
               │
               ▼
    [Fast XML Parser & Sanitization]
    - Strips malicious HTML tags
    - Extracts publication date, author, headline, URL
               │
               ▼
    [SHA-256 Deduplication Hash]
    - Computes hash(sourceId + normalized_headline)
               │
               ▼
    [Idempotent Upsert to Neon PostgreSQL]
    - If new: creates record with PENDING/APPROVED state
    - If duplicate: updates lastCheckedAt timestamp
               │
               ▼
    [Record IngestionJob & IngestionAttempt]
```

---

## 3. Operational Troubleshooting

### Error: `SSRF_BLOCKED`
- **Cause:** The registered source feed URL targets an internal IP or private hostname.
- **Action:** Ensure the URL is a publicly resolvable hostname using standard `http://` or `https://`.

### Error: `NETWORK_TIMEOUT`
- **Cause:** Publisher's server took longer than 12 seconds to respond.
- **Action:** Connector automatically retries up to 3 times with exponential backoff. If persistent, verify publisher uptime.

### Error: `PARSE_ERROR`
- **Cause:** The returned payload was not valid XML or HTML error page was returned with status 200.
- **Action:** Inspect `IngestionAttempt.errorMessage` in database. Verify feed URL in browser.
