# PARMANU API CONTRACTS (V1)
**Version:** 1.0.0
**Base URL:** `http://localhost:3001/api/v1`

---

## Standard Response Envelope

All API endpoints return JSON conforming to the following structure:

```json
{
  "success": true,
  "data": {},
  "error": null,
  "details": null,
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 80,
    "timestamp": "2026-10-14T06:59:45.749Z",
    "requestId": "req_ea872805a0faac1c"
  }
}
```

---

## 1. System Diagnostics

### `GET /health`
Returns system health, service uptime, and database connection status.
- **Auth:** Public
- **Response 200 (Healthy):**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "uptimeSeconds": 142,
  "timestamp": "2026-10-14T07:00:00.000Z",
  "services": {
    "database": {
      "status": "connected",
      "latencyMs": 420
    },
    "runtime": {
      "nodeVersion": "v20.18.0",
      "memoryUsageMb": 64
    }
  }
}
```

### `GET /readiness`
Readiness probe for container orchestration and load balancers.
- **Auth:** Public
- **Response 200:** `{ "ready": true, "timestamp": "..." }`
- **Response 503:** `{ "ready": false, "reason": "Database connection unavailable" }`

---

## 2. Authentication

### `POST /auth/register`
Creates a new user account.
- **Auth:** Public
- **Request Body:**
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!",
  "name": "Sujal Kumar",
  "adminKey": "optional-key-for-admin-bootstrap"
}
```
- **Response 201:** Returns created user object and JWT bearer token.
- **Response 400:** Input validation failed.
- **Response 409:** User already exists.

### `POST /auth/login`
Authenticates user and issues a JWT token.
- **Auth:** Public
- **Request Body:**
```json
{
  "email": "user@example.com",
  "password": "StrongPassword123!"
}
```
- **Response 200:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "cuid...",
      "email": "user@example.com",
      "name": "Sujal Kumar",
      "role": "READER"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```
- **Response 401:** Generic "Invalid email or password" (anti-enumeration).

### `GET /auth/me`
Retrieves currently authenticated user profile.
- **Auth:** Bearer Token required (`Authorization: Bearer <TOKEN>`)
- **Response 200:** User profile details.

---

## 3. News Feed & Source Items

### `GET /source-items` (or `/news`)
Returns paginated list of verified source items.
- **Auth:** Optional Bearer token (personalizes feed if user has followed categories).
- **Query Parameters:**
  - `category` (string, optional): e.g. `India`, `Politics`, `Business`, `Sports`
  - `provenance` (string, optional): `OFFICIAL_CONFIRMED`, `CORROBORATED`, `SINGLE_SOURCE`, `UNVERIFIED`
  - `state` (string, optional, default: `APPROVED`): `APPROVED`, `PENDING`, `REJECTED`
  - `search` (string, optional): Free-text search in headline and excerpt
  - `page` (number, optional, default: `1`): Page number
  - `limit` (number, optional, default: `20`, max: `100`): Results per page
- **Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "id": "cm2...",
      "sourceId": "cm1...",
      "canonicalUrl": "https://www.thehindu.com/news/...",
      "headline": "Government launches digital initiatives...",
      "excerpt": "The ministry has detailed key milestones...",
      "publishedAt": "2026-10-14T06:41:45.000Z",
      "processingState": "APPROVED",
      "provenanceState": "SINGLE_SOURCE",
      "rightsStatus": "METADATA_ONLY",
      "source": {
        "name": "The Hindu",
        "attributionName": "The Hindu",
        "attributionUrl": "https://www.thehindu.com"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 80,
    "timestamp": "2026-10-14T07:00:00.000Z"
  }
}
```

### `GET /source-items/:id`
Retrieves a single source item including complete evidence chain and provenance metadata.

---

## 4. News Sources Management

### `GET /sources`
Lists all registered syndication news sources with health metrics.
- **Auth:** Bearer Token required (`READER`, `EDITOR`, or `ADMIN`)

### `POST /sources`
Registers a new syndication news source with SSRF validation.
- **Auth:** Bearer Token required (`ADMIN` only)
- **Request Body:**
```json
{
  "name": "Press Information Bureau",
  "slug": "pib-india",
  "type": "GOVERNMENT_FEED",
  "feedUrl": "https://pib.gov.in/RssMain.aspx",
  "category": ["Government", "Policy"],
  "attributionName": "PIB India",
  "attributionUrl": "https://pib.gov.in",
  "pollingIntervalMinutes": 15
}
```

---

## 5. Ingestion Pipeline

### `POST /ingestion/trigger`
Triggers immediate live ingestion of syndication feeds.
- **Auth:** Bearer Token required (`EDITOR` or `ADMIN`)
- **Request Body:** `{ "sourceId": "optional-source-id" }` (omitting ingests all active sources)
- **Response 200:** Ingestion summary with items found, newly stored, and duplicates skipped.

### `GET /ingestion/jobs`
Returns the recent execution history of background ingestion jobs and attempts.
- **Auth:** Bearer Token required (`EDITOR` or `ADMIN`)

---

## 6. Collaboration Radar

### `GET /collaboration/claims`
Lists verified creator-brand partnership claims with supporting evidence references.
- **Auth:** Public / Optional Token

### `POST /collaboration/claims`
Registers an editorially verified collaboration event.
- **Auth:** Bearer Token required (`EDITOR` or `ADMIN`)
- **Request Body:**
```json
{
  "creatorProfileId": "cuid...",
  "brandProfileId": "cuid...",
  "campaignName": "Audio Ambassadorship 2026",
  "claimType": "BRAND_COLLABORATION",
  "provenanceState": "OFFICIAL_CONFIRMED",
  "evidenceSourceItemId": "cuid-of-pr-wire-item",
  "notes": "Verified via official press release"
}
```
