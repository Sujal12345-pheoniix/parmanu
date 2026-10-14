# SECURITY AND OPERATIONS REQUIREMENTS
**Stage 6 — Security, Quality, and Operational Standards**
*Version 1.0 · 2026-10-14 · Based on OWASP ASVS 4.0 Level 1 and OWASP API Security Top 10 2023*

---

## 1. Authentication and Session Management (ASVS Chapter 3)

| ID | Requirement | Implementation | Priority |
|---|---|---|---|
| AUTH-001 | Passwords hashed with Argon2id (min memory: 64MB, iterations: 3, parallelism: 4) | `@node-rs/argon2` package | P0 |
| AUTH-002 | Minimum password length: 12 characters | Zod schema validation | P0 |
| AUTH-003 | Session token entropy: minimum 128 bits | NextAuth.js default | P0 |
| AUTH-004 | Session cookie attributes: `HttpOnly; Secure; SameSite=Strict` | NextAuth.js + custom middleware | P0 |
| AUTH-005 | Session invalidated on logout (server-side session delete) | NextAuth.js signOut + DB session delete | P0 |
| AUTH-006 | Session rotated on privilege change (e.g., role upgrade) | Custom NextAuth.js session callback | P0 |
| AUTH-007 | JWT expiry: 15 minutes access token; 7-day refresh token | NextAuth.js configuration | P0 |
| AUTH-008 | Email verification required before account activation | NextAuth.js email provider | P0 |
| AUTH-009 | Failed login attempts rate-limited (10/minute per IP) | NestJS ThrottlerModule + Redis | P0 |
| AUTH-010 | Admin accounts require MFA (TOTP) | NextAuth.js TOTP plugin | P0 |
| AUTH-011 | OAuth state parameter verified on callback | NextAuth.js default | P0 |
| AUTH-012 | Redirect URIs validated against allowlist | NextAuth.js allowedCallbackUrls | P0 |

---

## 2. Server-Side Authorization (ASVS Chapter 4)

| ID | Requirement | Implementation | Priority |
|---|---|---|---|
| AUTHZ-001 | All API endpoints require authentication except public feeds | NestJS `@UseGuards(JwtAuthGuard)` on all controllers | P0 |
| AUTHZ-002 | Role-based access enforced server-side (not just UI) | NestJS `@Roles()` guard with JWT role claim | P0 |
| AUTHZ-003 | Ownership check on all user-specific resources | `WHERE id = ? AND user_id = ?` in every query | P0 |
| AUTHZ-004 | Admin endpoints inaccessible to Editor/Reader roles | Separate `AdminGuard` | P0 |
| AUTHZ-005 | Creator OAuth tokens never returned in API responses | Excluded from serialization; server-side only | P0 |
| AUTHZ-006 | Horizontal privilege escalation prevented (IDOR) | Ownership enforcement in service layer | P0 |

---

## 3. Input Validation and Safe Output

| ID | Requirement | Implementation | Priority |
|---|---|---|---|
| INPUT-001 | All API input validated with Zod schemas | NestJS `ZodValidationPipe` globally applied | P0 |
| INPUT-002 | RSS content sanitized before storage | `isomorphic-dompurify` on server | P0 |
| INPUT-003 | No `dangerouslySetInnerHTML` without explicit sanitization | ESLint rule + code review | P0 |
| INPUT-004 | Content Security Policy header on all responses | Next.js middleware | P0 |
| INPUT-005 | X-Frame-Options: DENY on all pages | Next.js headers config | P0 |
| INPUT-006 | X-Content-Type-Options: nosniff | Next.js headers config | P0 |
| INPUT-007 | HSTS header (max-age=31536000; includeSubDomains) | Next.js headers config | P0 |
| INPUT-008 | SQL injection prevented (Prisma parameterized queries) | Prisma ORM; no raw string concatenation | P0 |
| INPUT-009 | File upload validation (type, size, content inspection) | Not in Phase 1 scope; deferred | P2 |

---

## 4. Rate Limiting and Abuse Prevention

| ID | Requirement | Limit | Implementation |
|---|---|---|---|
| RATE-001 | Global per-IP rate limit | 100 req/min | NestJS ThrottlerModule + Redis store |
| RATE-002 | Authentication endpoints | 10 req/min per IP | Custom throttle decorator |
| RATE-003 | Search endpoint | 10 req/min per user | Per-user throttle |
| RATE-004 | Public feed endpoints | 60 req/min per IP | Standard throttle |
| RATE-005 | Admin endpoints | 30 req/min per user | Admin throttle |
| RATE-006 | External API egress throttling | Per-provider quota tracking | BullMQ + Redis counter |
| RATE-007 | Return HTTP 429 with Retry-After header | Standard ThrottlerModule response | P0 |

---

## 5. OAuth Token Protection

| ID | Requirement | Implementation | Priority |
|---|---|---|---|
| OAUTH-001 | Creator access tokens encrypted at rest (AES-256-GCM) | Custom encryption service; key in env secret | P0 |
| OAUTH-002 | Tokens never logged (error handlers redact token fields) | Custom logging interceptor | P0 |
| OAUTH-003 | Token refresh automated at day 50 (10 days before 60-day expiry) | BullMQ scheduled job | P0 |
| OAUTH-004 | Immediate token deletion on creator disconnect | Service method + deletion job | P0 |
| OAUTH-005 | Token exchange (short→long-lived) occurs server-side only | NestJS callback handler; never in browser | P0 |
| OAUTH-006 | Instagram webhook signatures verified with HMAC-SHA256 | Custom webhook guard | P0 |

---

## 6. Secret Management

| ID | Requirement | Implementation | Priority |
|---|---|---|---|
| SEC-001 | No secrets in source code or Git history | Pre-commit hook (gitleaks) | P0 |
| SEC-002 | `.env` and `.env.local` in `.gitignore` | Enforced from first commit | P0 |
| SEC-003 | `.env.example` with placeholder values committed | Documented | P0 |
| SEC-004 | Production secrets in GitHub Secrets / Railway env | Never in repository | P0 |
| SEC-005 | Separate secrets per environment (staging ≠ production) | Separate Railway/Vercel environments | P0 |
| SEC-006 | Secret rotation documented; no hardcoded rotation schedule in code | Operations runbook | P1 |
| SEC-007 | Database connection string uses environment variable only | `DATABASE_URL` env var | P0 |

---

## 7. Dependency and Secret Scanning

| ID | Tool | Frequency | Gate |
|---|---|---|---|
| DEP-001 | `pnpm audit` | Every PR | CI blocks on critical severity |
| DEP-002 | `gitleaks` | Every push + PR | Pre-push hook + CI blocks |
| DEP-003 | GitHub Dependabot | Weekly | Auto-PR for dependency updates |
| DEP-004 | ESLint security plugin (`eslint-plugin-security`) | Every PR | CI required |
| DEP-005 | `npm-check-updates` | Monthly | Manual review; not blocking |

---

## 8. Audit Logging Requirements

| Action | Must Be Logged | Data Logged |
|---|---|---|
| User login (success) | ✅ | userId, IP, timestamp, provider |
| User login (failure) | ✅ | email/username attempted, IP, timestamp |
| Admin role assignment | ✅ | actorId, targetId, newRole, reason |
| Source item approval | ✅ | editorId, itemId, timestamp |
| Source item rejection | ✅ | editorId, itemId, reason, timestamp |
| Provenance state change | ✅ | editorId, itemId, oldState, newState, reason |
| Creator connection | ✅ | creatorId, provider, timestamp, scopes |
| Creator disconnection | ✅ | creatorId, provider, timestamp |
| Collaboration claim creation | ✅ | actorId, claimId, sources |
| Admin console access | ✅ | adminId, endpoint, timestamp |
| Data deletion request | ✅ | userId, requestedAt, processedAt |

**Audit log must be:**
- INSERT-only (no UPDATE or DELETE via application code)
- Stored in `audit_logs` table with database-level write protection
- Retained for minimum 2 years
- Never contain secrets, tokens, or full PII beyond what is necessary

---

## 9. Privacy-Conscious Analytics

| ID | Requirement | Implementation |
|---|---|---|
| PRIV-001 | No PII in analytics events | User ID replaced with anonymized hash |
| PRIV-002 | IP addresses not stored in analytics | Vercel Analytics (aggregated only) |
| PRIV-003 | Consent obtained before tracking | Cookie consent banner (India DPDP + EU GDPR) |
| PRIV-004 | Analytics provider: Vercel Analytics (privacy-first) | Vercel Analytics — no third-party cookies |
| PRIV-005 | No fingerprinting | CSP blocks fingerprinting scripts |
| PRIV-006 | Right to erasure honored within 30 days | Data deletion job + confirmation email |

---

## 10. Database Migrations and Backup

| ID | Requirement | Implementation |
|---|---|---|
| DB-001 | All schema changes via Prisma migrations | `prisma migrate dev` → `prisma migrate deploy` |
| DB-002 | Migrations tested in staging before production | CI migration step on staging |
| DB-003 | Migrations backward-compatible (expand-contract pattern) | Code review requirement |
| DB-004 | Neon PITR (point-in-time recovery) enabled | Neon default for paid plans; verify on free |
| DB-005 | Manual backup before each major migration | `pg_dump` to Cloudflare R2 before deploying |
| DB-006 | Migration rollback tested in staging | Staging-specific rollback drill before launch |

---

## 11. CI Quality Gates

Every PR must pass all of the following before merge:

| Gate | Tool | Failure Action |
|---|---|---|
| TypeScript type check | `tsc --noEmit` | Block merge |
| Lint | ESLint (+ security plugin) | Block merge |
| Format check | Prettier | Block merge |
| Unit tests | Vitest | Block merge; coverage ≥80% on modified files |
| Secret scan | gitleaks | Block merge |
| Dependency audit | pnpm audit | Block merge on critical |
| Build | `pnpm build` | Block merge |
| Migration check | `prisma migrate diff` | Block merge if uncommitted changes |

---

## 12. Staging and Production Separation

| Requirement | Implementation |
|---|---|
| Staging uses separate Neon branch | Neon branching feature |
| Staging uses separate API keys (not production keys) | Separate GitHub Secrets |
| Production deployments require manual approval | GitHub Actions `environment: production` with required reviewer |
| No direct database access from developer machines to production | Production DB access via Neon console only; no shared connection strings |
| Staging data seeded from anonymized snapshot | Seed script with synthetic data |

---

## 13. Error Handling and Observability

| ID | Requirement | Implementation |
|---|---|---|
| OBS-001 | Structured logging (JSON) in production | `pino` logger | 
| OBS-002 | Error tracking | Sentry (free tier) |
| OBS-003 | No stack traces in production API responses | NestJS exception filters return generic messages |
| OBS-004 | Health check endpoint | `GET /health` returns 200 + DB/Redis status |
| OBS-005 | Ingestion job metrics | BullMQ metrics exposed via admin endpoint |
| OBS-006 | Alerting on ingestion failures | Sentry alerts → email |
| OBS-007 | Uptime monitoring | Better Uptime or UptimeRobot (free) |

---

## 14. Incident Response Runbook (Summary)

| Severity | Trigger | First Action | Escalation |
|---|---|---|---|
| P0 | Active breach / credentials exposed | Rotate all affected secrets immediately; disable affected services | CTO notified within 15 min |
| P0 | Database corruption | Stop writes; initiate PITR restore | CTO + Engineering lead |
| P1 | API completely down | Check Railway logs; rollback if recent deployment | Engineering lead notified 1h |
| P1 | OAuth token breach suspected | Revoke all Instagram connections; notify affected creators | Privacy officer + Engineering |
| P2 | Ingestion stopped for >2 hours | Check BullMQ queue; verify external API status | On-call engineer |
| P3 | Single source failure | Mark source as unhealthy; continue with remaining sources | Next business day |

**Rollback procedure:**
1. Railway: One-click rollback to previous deployment.
2. Vercel: Instant rollback to previous Git SHA.
3. Database: `prisma migrate deploy` with previous migration; if destructive, Neon PITR.
