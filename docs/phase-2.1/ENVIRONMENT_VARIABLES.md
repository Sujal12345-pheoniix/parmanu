# Environment Variables Specification
## Parmanu Platform — Phase 2.1 Configuration Reference

All environment variables used across the Parmanu API and connectors are documented below with safe placeholders. Never commit actual production secrets to source control.

---

### Core Platform Configuration

| Variable | Required | Type | Default | Description & Constraint |
|---|---|---|---|---|
| `NODE_ENV` | Optional | Enum | `development` | Environment mode (`development`, `staging`, `production`, `test`). |
| `PORT` | Optional | Number | `3001` | HTTP port on which the Express API server listens. |
| `DATABASE_URL` | **Required** | URL | *(none)* | PostgreSQL connection string (e.g. Neon serverless endpoint). Format: `postgresql://user:password@host/dbname?sslmode=require`. |
| `JWT_SECRET` | **Required** | String | *(none)* | Secret key used to sign and verify user authentication tokens. **Minimum 32 characters**. |
| `JWT_EXPIRATION` | Optional | String | `7d` | Lifespan of generated JWT tokens (e.g. `24h`, `7d`). |
| `CORS_ORIGIN` | Optional | String | `*` | Allowed CORS origins. In production, configure to explicit frontend domains (e.g. `https://parmanu.dev`). |
| `ENCRYPTION_KEY` | **Required** | Hex String | *(none)* | 32-byte (64 hex characters) symmetric key used for AES-256-GCM token and credential encryption at rest. |
| `ADMIN_REGISTRATION_KEY`| **Required** | String | *(none)* | Pre-shared key required to bootstrap an `ADMIN` role account via `POST /api/v1/auth/register`. Minimum 8 characters. |
| `LOG_LEVEL` | Optional | Enum | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`). |

---

### Ingestion Source & Provider Credentials

| Variable | Required | Default | Description & Safe Placeholder |
|---|---|---|---|
| `GNEWS_API_KEY` | Optional | *(none)* | API key for commercial news indexing via GNews API. Placeholder: `your_gnews_api_key_here` |
| `GUARDIAN_API_KEY` | Optional | *(none)* | Developer or commercial API key for The Guardian Open Platform. Placeholder: `your_guardian_api_key_here` |
| `INSTAGRAM_APP_ID` | Optional | *(none)* | Meta App ID for creator OAuth onboarding. Placeholder: `your_meta_app_id_placeholder` |
| `INSTAGRAM_APP_SECRET` | Optional | *(none)* | Meta App Secret for creator OAuth token exchange. Placeholder: `your_meta_app_secret_placeholder` |

---

### Sample Configuration Template (`.env.example`)

```dotenv
# ─── CORE SERVER & DATABASE ──────────────────────────────
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://parmanu_user:your_secure_password@ep-sample-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
CORS_ORIGIN=http://localhost:3000

# ─── SECURITY CREDENTIALS (MINIMUM 32 CHARS) ─────────────
JWT_SECRET=your_jwt_secret_at_least_32_characters_long_placeholder
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
ADMIN_REGISTRATION_KEY=parmanu_admin_setup_key_production_grade_placeholder

# ─── LICENSED SOURCE PROVIDERS ───────────────────────────
GNEWS_API_KEY=gnews_api_key_placeholder
GUARDIAN_API_KEY=guardian_api_key_placeholder

# ─── META / INSTAGRAM GRAPH API (VOLUNTARY CREATOR OAUTH) ─
INSTAGRAM_APP_ID=meta_app_id_placeholder
INSTAGRAM_APP_SECRET=meta_app_secret_placeholder

# ─── OBSERVABILITY ────────────────────────────────────────
LOG_LEVEL=info
```
