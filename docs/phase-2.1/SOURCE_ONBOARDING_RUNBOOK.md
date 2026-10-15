# Source Onboarding & Operations Runbook
## Parmanu Platform — Phase 2.1 Administrator Manual

---

### 1. Overview & Security Prerequisites

All source management operations in Parmanu require the `ADMIN` role. Operational monitoring and manual ingestion triggers require either `EDITOR` or `ADMIN` roles.

API requests must provide an `Authorization: Bearer <JWT_TOKEN>` header.

---

### 2. Supported Source Types

| Type Identifier | Description | Required Configuration Fields |
|---|---|---|
| `RSS` | Standard RSS 2.0 News Syndication Feed | `feedUrl`, `name`, `slug`, `category`, `attributionName`, `attributionUrl` |
| `ATOM` | Atom 1.0 Syndication Feed | `feedUrl`, `name`, `slug`, `category`, `attributionName`, `attributionUrl` |
| `GOVERNMENT_FEED` | Official Indian Government / Statutory Gazette (PIB, RBI, SEBI) | `feedUrl` (must resolve to verified `.gov.in` or `.rbi.org.in` domain) |
| `API_GUARDIAN` | The Guardian Open Platform API | `feedUrl` (optional, defaults to search), `apiConfig: { apiKey: "..." }` or `GUARDIAN_API_KEY` env var |
| `API_GNEWS` | GNews Commercial News API | `feedUrl` (optional, defaults to top-headlines), `apiConfig: { apiKey: "..." }` or `GNEWS_API_KEY` env var |
| `MANUAL_PR` | PR Wire and Corporate Press Releases | `feedUrl`, `name`, `slug`, `category` (collaboration markers automatically tagged) |
| `INSTAGRAM_API` | Meta Instagram Graph API (Voluntary Creator OAuth) | `apiConfig: { accessToken: "..." }` or `accessTokenEncrypted` |

---

### 3. Step-by-Step Source Onboarding Procedures

#### Procedure A: Onboarding an Official Government Feed (e.g. PIB Releases)
```bash
curl -X POST https://api.parmanu.dev/api/v1/sources \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Press Information Bureau - National",
    "slug": "pib-national-releases",
    "type": "GOVERNMENT_FEED",
    "feedUrl": "https://pib.gov.in/PressReleasePage.aspx",
    "category": ["National", "Government"],
    "language": "en",
    "country": "IN",
    "pollingIntervalMinutes": 15,
    "attributionName": "Press Information Bureau, Government of India",
    "attributionUrl": "https://pib.gov.in",
    "isActive": true
  }'
```
*Note: The system performs automated SSRF validation and verified domain checks against `*.gov.in` and `*.rbi.org.in`.*

#### Procedure B: Onboarding The Guardian Open Platform API
```bash
curl -X POST https://api.parmanu.dev/api/v1/sources \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "The Guardian World News",
    "slug": "guardian-world",
    "type": "API_GUARDIAN",
    "feedUrl": "https://content.guardianapis.com/search",
    "apiConfig": {
      "apiKey": "YOUR_GUARDIAN_API_KEY"
    },
    "category": ["World"],
    "language": "en",
    "country": "GB",
    "pollingIntervalMinutes": 30,
    "attributionName": "The Guardian",
    "attributionUrl": "https://www.theguardian.com",
    "isActive": true
  }'
```

#### Procedure C: Onboarding a Voluntary Creator Instagram Account
```bash
# 1. Obtain long-lived user access token via voluntary creator OAuth flow
# 2. Register source in Parmanu
curl -X POST https://api.parmanu.dev/api/v1/sources \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TechGuru Raj Official Portfolio",
    "slug": "creator-techguru-raj",
    "type": "INSTAGRAM_API",
    "feedUrl": "https://graph.instagram.com/me/media",
    "apiConfig": {
      "accessToken": "EAAX...voluntary_creator_long_lived_token"
    },
    "category": ["Technology", "Creator"],
    "language": "en",
    "country": "IN",
    "pollingIntervalMinutes": 60,
    "attributionName": "@techguru_raj",
    "attributionUrl": "https://instagram.com/techguru_raj",
    "isActive": true
  }'
```

---

### 4. Admin Operations & Lifecycle Management

#### 4.1 Updating Source Configuration or Disabling a Source
```bash
# Disable a malfunctioning source immediately
curl -X PATCH https://api.parmanu.dev/api/v1/sources/source_uuid_here \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "isActive": false
  }'

# Update polling interval or feed URL
curl -X PATCH https://api.parmanu.dev/api/v1/sources/source_uuid_here \
  -H "Authorization: Bearer $ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "pollingIntervalMinutes": 30,
    "feedUrl": "https://pib.gov.in/new-rss-endpoint.xml"
  }'
```

#### 4.2 Inspecting Source Health and Probing Live Status
```bash
# Inspect stored metrics and run a live HEAD/probe check
curl -X GET "https://api.parmanu.dev/api/v1/sources/source_uuid_here/health?probe=true" \
  -H "Authorization: Bearer $EDITOR_OR_ADMIN_JWT"
```
**Sample Health Response:**
```json
{
  "success": true,
  "data": {
    "sourceId": "060d47ad-3707-4286-905c-d7ce97e3fc92",
    "name": "Press Information Bureau - National",
    "type": "GOVERNMENT_FEED",
    "healthStatus": "HEALTHY",
    "isActive": true,
    "consecutiveFailures": 0,
    "lastPolledAt": "2026-10-15T05:00:00.000Z",
    "lastSuccessAt": "2026-10-15T05:00:00.000Z",
    "totalItemsCount": 42,
    "totalJobsCount": 8,
    "liveProbe": {
      "isHealthy": true,
      "consecutiveFailures": 0
    }
  }
}
```

#### 4.3 Triggering a Manual Ingestion
```bash
# Ingest a specific source
curl -X POST https://api.parmanu.dev/api/v1/ingestion/trigger \
  -H "Authorization: Bearer $EDITOR_OR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{ "sourceId": "060d47ad-3707-4286-905c-d7ce97e3fc92" }'

# Ingest all active sources
curl -X POST https://api.parmanu.dev/api/v1/ingestion/trigger \
  -H "Authorization: Bearer $EDITOR_OR_ADMIN_JWT" \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### 4.4 Inspecting Ingestion Runs & Retrying Failed Jobs
```bash
# List recent ingestion runs with status
curl -X GET "https://api.parmanu.dev/api/v1/ingestion/jobs?page=1&limit=20" \
  -H "Authorization: Bearer $EDITOR_OR_ADMIN_JWT"

# Retrieve specific job details with sanitized error attempt history
curl -X GET "https://api.parmanu.dev/api/v1/ingestion/jobs/job_uuid_here" \
  -H "Authorization: Bearer $EDITOR_OR_ADMIN_JWT"

# Safely retry an eligible failed job
curl -X POST "https://api.parmanu.dev/api/v1/ingestion/jobs/job_uuid_here/retry" \
  -H "Authorization: Bearer $EDITOR_OR_ADMIN_JWT"
```

---

### 5. Troubleshooting Matrix

| Symptom | Error Category | Root Cause | Remediation Procedure |
|---|---|---|---|
| Ingestion fails with `AUTH_ERROR` (Instagram) | `AUTH_ERROR` | Long-lived OAuth token has expired (60-day limit) or creator revoked permissions | Re-authenticate creator via OAuth flow and update token via `PATCH /sources/:id`. |
| Ingestion fails with `RATE_LIMITED` | `RATE_LIMITED` | Provider hourly quota exhausted (e.g. GNews 100 requests/day free tier) | Check `retryAfterSeconds`. Increase `pollingIntervalMinutes` to 60 or upgrade API tier. |
| Ingestion fails with `SSRF_BLOCKED` | `SSRF_BLOCKED` | `feedUrl` resolves to private IP, localhost, or unsupported protocol | Verify URL is publicly routable and starts with `https://`. |
| Source stuck with status `FAILING` | `HTTP_ERROR` / `NETWORK_TIMEOUT` | Upstream publisher website is down or blocking bot user-agent | Test endpoint with `GET /sources/:id/health?probe=true`. If down, set `isActive: false` until publisher recovers. |
