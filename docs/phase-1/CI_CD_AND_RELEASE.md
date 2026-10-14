# Parmanu CI/CD Pipeline & Release Engineering Specification

**Document Version:** 1.0.0  
**Phase:** 1 (Foundation Hardening & Security Audit)  
**Status:** Approved & Implemented  
**Date:** 2026-10-14  

---

## 1. Overview & Objectives

The Parmanu Continuous Integration and Continuous Deployment (CI/CD) pipeline guarantees that every change proposed or merged into the codebase meets strict thresholds of code formatting, static type correctness, linter hygiene, automated test coverage, and reproducible build artifacts.

### Guiding Principles
1. **Deterministic Builds:** No reliance on undeclared global state or dynamic dependency drift. All builds run against locked dependencies (`package-lock.json`).
2. **Shift-Left Security:** Linting, static analysis, type checking, and security tests execute before any code reaches mainline branches.
3. **Hermetic Test Environments:** Tests requiring databases run with dedicated test schema isolating integration runs, and mock network calls using strict contract stubs.
4. **Zero Secret Leakage:** No production database URLs, service accounts, or private API keys exist in GitHub Actions repository secrets or CI logs.

---

## 2. GitHub Actions Pipeline Specification

The CI workflow is defined in `.github/workflows/ci.yml`.

### 2.1 Workflow Triggers
- **Pull Requests:** Targeting `main` or `release/*`.
- **Branch Pushes:** Direct pushes to `main`.
- **Manual Dispatch:** `workflow_dispatch` enabled for maintenance runs.

### 2.2 Execution Matrix & Pipeline Stages

```mermaid
flowchart LR
    A[Git Trigger] --> B[Environment Setup<br/>Node 20 LTS + Cache]
    B --> C[Stage 1: Dependencies<br/>npm ci]
    C --> D[Stage 2: Formatting & Linting<br/>npm run lint]
    C --> E[Stage 3: Type Safety<br/>npm run typecheck]
    D & E --> F[Stage 4: Automated Testing<br/>npm run test]
    F --> G[Stage 5: Production Build<br/>npm run build]
    G --> H[Artifact Verification<br/>Dist / Bundle validation]
```

### 2.3 Detailed Step Verification

| Stage | Command Executed | Fail Condition | SLA / Timeout |
| :--- | :--- | :--- | :--- |
| **Setup** | `actions/setup-node@v4` (Node 20, `cache: 'npm'`) | Node download failure or cache mismatch | 2 min |
| **Install** | `npm ci` | Lockfile mismatch, network failure | 3 min |
| **Lint** | `npm run lint` | Any ESLint error or warning exceeding threshold | 1 min |
| **Typecheck** | `npm run typecheck` | Any TypeScript compiler error (`tsc --noEmit`) | 2 min |
| **Unit & Integration** | `npm run test` | Any test failure or unhandled exception | 3 min |
| **Build** | `npm run build` | Vite build failure or TS build error in API/Web | 3 min |

---

## 3. Environment & Secret Hygiene

### 3.1 CI Secret Handling
- CI jobs run with sanitized dummy environment variables when testing crypto, JWT, and schema validations:
  - `NODE_ENV=test`
  - `JWT_SECRET=ci-test-jwt-secret-min-32-characters-long-key-for-testing`
  - `ENCRYPTION_KEY=ci-test-aes-256-gcm-hex-key-0123456789abcdef0123456789abcdef`
  - `DATABASE_URL=postgresql://test:test@localhost:5432/parmanu_test` (or test Neon instance)
- **Production Secrets Rule:** GitHub Actions secrets must NEVER contain production database write credentials or production third-party API keys (e.g. Meta Graph API, GNews production key).

---

## 4. Release Strategy & Environment Promotion

Parmanu follows a 3-tier environment promotion model:

```
[Local Workspaces] 
        ↓ PR Merge
[Mainline Branch (GitHub)]
        ↓ Automated CI Pass
[Staging Environment (Vercel + Neon Dev)]
        ↓ Manual QA & Smoke Tests
[Production Environment (Vercel + Neon Prod)]
```

### 4.1 Branching Strategy (GitHub Flow)
- `main`: Canonical, always deployable mainline.
- Feature branches (`feat/feature-name`, `fix/issue-description`): Short-lived branches submitted via PR.
- Mandatory PR Checks:
  - Branch protection requiring green status for `build-and-test`.
  - Linear Git history required (Squash & Merge or Rebase).
  - Minimum 1 engineering peer review.

---

## 5. Rollback Procedures

### 5.1 Application Code Rollbacks
- **Frontend (Web):** Deployed on edge/CDN (e.g., Vercel / Cloudflare). Rollback is instantaneous via deployment hash reversion in the CDN control plane.
- **Backend API:** Containerized / Serverless runtime. Rollback initiates by deploying the previous verified Git SHA release image or instant alias point-back.

### 5.2 Database Migration Rollback Strategy
All database migrations in Parmanu must adhere to the **Expand and Contract** pattern:
1. **Never drop columns or tables in the same release as application code changes.**
2. Schema changes must be backward-compatible with the currently running application version.
3. If a rollback is needed:
   - Rollback application code to previous SHA.
   - The database remains backward-compatible with the previous application code.
   - Run corrective down migrations only after verifying traffic has drained from the failed release.
