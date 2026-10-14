# PRODUCT REQUIREMENTS DOCUMENT
**Parmanu — News & Creator Intelligence Platform**
*Stage 2 · Version 1.0 · 2026-10-14*

---

## 1. Vision Statement

Parmanu is an India-first, trust-first news and creator-intelligence platform. It delivers personalized news across every major category while surfacing verifiable creator activity—collaborations, brand partnerships, and emerging trends—with full source provenance. Every claim is traceable to a real source.

**Central principle:** REAL SOURCES → VALIDATED RECORDS → TRACEABLE EVIDENCE → ORIGINAL INTELLIGENCE → TRUSTWORTHY USER EXPERIENCE.

---

## 2. Target Users

| Segment | Problem | Value Proposition |
|---|---|---|
| India-based news readers (18–40) | Overwhelming, low-trust news feeds | Curated, categorized, source-attributed news |
| Creator-economy followers | No reliable tracker for brand deals | Verified collaboration radar |
| Journalists & researchers | Hard to trace provenance | Full evidence chain with source links |
| Brand/marketing teams | Manual influencer monitoring | Structured creator & brand intelligence |

---

## 3. Launch Scope — India First

**Phase 1 (MVP) launches with:**
- India, world affairs, business, politics, technology, sports, entertainment, science categories
- Top 200 Indian English and Hindi RSS sources
- Creator intelligence for top 500 Indian Instagram creators (public disclosures only)
- Web app (responsive) — Android/iOS deferred to Phase 2
- English language — Hindi transliteration deferred to Phase 2

---

## 4. Feature Definitions

### 4.1 Core News Experience

**User value:** Personalized, reliable news across curated categories with source attribution.

| Sub-feature | MVP Priority | Acceptance Criteria |
|---|---|---|
| Category feeds (India, World, Business, Politics, Tech, Sports, Entertainment, Science) | P0 | User can browse 8 category feeds, each showing ≥20 fresh articles |
| Article card (headline, source, timestamp, category, provenance badge) | P0 | Every card shows source name, publication time, provenance state |
| Article detail view (summary, key points, source link, evidence chain) | P0 | User can view full provenance chain and open original source URL |
| Personalized feed (based on followed categories and creators) | P1 | Logged-in users see a merged feed weighted by interests |
| Breaking news alerts (email/push) | P2 | Deferred to Phase 2 |

**Data dependencies:** RSS feeds, licensed news APIs
**Backend dependencies:** Ingestion service, normalization pipeline, PostgreSQL
**Privacy/legal:** No full article text republication without license; summaries only; attribution required
**Phase dependency:** Requires Phase 1 data ingestion infrastructure

---

### 4.2 Instagram Pulse

**User value:** Verified view of creator activity using only legitimate, authorized data.

| Sub-feature | MVP Priority | Acceptance Criteria |
|---|---|---|
| Creator profile page (name, bio, follower range, category) | P0 | Profiles populated from official announcements and public APIs |
| Recent activity feed (official announcements, PR articles) | P0 | Only data from authorized sources shown |
| Engagement trend indicators | P1 | Available only where Instagram API explicitly permits |
| New post/Reel visibility | P2 | Available only for creators who authenticate via Instagram OAuth |

**Data dependencies:** Instagram Basic Display API (authenticated creators only), official PR, news sources
**Privacy/legal:** No scraping; no display of non-public data; GDPR/DPDP Act compliance required
**Phase dependency:** OAuth integration required before P1/P2 features

---

### 4.3 Collaboration Radar

**User value:** Track confirmed brand-creator collaborations from official disclosures.

| Sub-feature | MVP Priority | Acceptance Criteria |
|---|---|---|
| Collaboration event cards | P0 | Every card links to ≥1 primary evidence source |
| Brand ↔ Creator association graph | P1 | Visible after ≥3 confirmed events per entity |
| Campaign timeline view | P1 | Chronological view of all events for a brand or creator |
| Unverified claim flagging | P0 | Claims without official confirmation show "Unverified" badge |

**Data dependencies:** PR wire services (PR Newswire, Business Wire India), brand press releases, news articles
**Privacy/legal:** Only publicly announced partnerships; no inference of undisclosed relationships
**Phase dependency:** Evidence engine (Stage 5) required

---

### 4.4 Creator and Brand Profiles

| Sub-feature | MVP Priority | Acceptance Criteria |
|---|---|---|
| Creator profile with category, bio, official links | P0 | Populated from public PR and authorized API data |
| Brand profile with sector, description, official links | P0 | Created from news and PR mentions |
| Creator–brand collaboration history | P1 | Shows confirmed events with evidence links |
| Verified badge (official Instagram account holder authenticated) | P1 | Only displayed when creator completes OAuth flow |

**Data dependencies:** Public profiles, news, PR wires
**Privacy/legal:** No PII beyond what is publicly declared by the creator themselves; DPDP Act 2023 applicable

---

### 4.5 Search, Following, Bookmarks, and Alerts

| Sub-feature | MVP Priority | Acceptance Criteria |
|---|---|---|
| Full-text search across news articles and creator profiles | P1 | Returns results in <500ms for common queries |
| Follow creator or brand | P1 | Followed entities appear in personalized feed |
| Bookmark article | P1 | Bookmarks persist across sessions, visible in profile |
| Email digest alert (daily) | P2 | Deferred to Phase 2 |
| Push notification alerts | P2 | Deferred to Phase 2 |

---

### 4.6 Source Provenance and Evidence States

Every piece of content is assigned an evidence state. This is a core product differentiator.

| State | Label | Meaning | Badge Color |
|---|---|---|---|
| `OFFICIAL_CONFIRMED` | Official | Direct statement from entity or official channel | Green |
| `CORROBORATED` | Verified | Confirmed by ≥2 independent credible sources | Blue |
| `SINGLE_SOURCE` | Single Source | Reported by one credible outlet | Yellow |
| `UNVERIFIED` | Unverified | Claimed but not yet confirmed | Orange |
| `DISPUTED` | Disputed | Actively contradicted by another source | Red |
| `INFERRED` | Inferred | Derived from multiple signals, not directly reported | Grey |

**Acceptance criteria:** Every article, collaboration event, and creator claim displays its provenance badge. The evidence chain (source URLs, timestamps) is accessible to any user.

---

### 4.7 Editorial and Admin Capabilities

| Feature | MVP Priority | Notes |
|---|---|---|
| Editorial dashboard (review ingested items, approve/reject) | P0 | Required before any content is shown to users |
| Source management (add/remove RSS feeds, API providers) | P0 | Admins configure trusted sources |
| Provenance override (editor can upgrade/downgrade evidence state) | P0 | With mandatory reason and audit log entry |
| Creator profile management | P1 | Admins can merge duplicate profiles, add official links |
| Content moderation queue | P1 | Flag inappropriate or potentially defamatory items |
| Role management (super-admin, editor, reviewer) | P0 | RBAC enforced at API level |

---

### 4.8 AI Features — Deferred to Phase 2 and Beyond

| Feature | Target Phase |
|---|---|
| AI-generated article summaries | Phase 2 |
| Event timeline construction | Phase 2 |
| Semantic search | Phase 2 |
| Personalization model (collaborative filtering) | Phase 2 |
| Trend detection and alerts | Phase 3 |
| Creator sentiment analysis | Phase 3 |
| Automated provenance classification | Phase 3 |

> [!IMPORTANT]
> No AI-generated content may be presented to users in Phase 1 without explicit editorial review. The "AI summary" feature is explicitly blocked at the data model level until Phase 2.

---

### 4.9 Community and Monetization — Explicitly Deferred

The following features are acknowledged but deliberately excluded from Phase 1 and Phase 2 planning to prevent scope creep:

- Comments and community discussion
- Creator-led newsletters or posts
- Subscription tiers or paywalls
- Brand advertising integration
- Affiliate partnership tracking
- Creator marketplace

---

## 5. Phase 1 Definition of Done

Phase 1 is complete when:

- [ ] All P0 features pass their acceptance criteria
- [ ] All content displays a provenance badge with at least one source link
- [ ] The editorial dashboard allows review and approval of all ingested content
- [ ] No article is published to end users without editor approval
- [ ] All secrets are managed outside source code
- [ ] CI passes on every PR with lint, type-check, and unit tests
- [ ] The application deploys successfully to a staging environment
- [ ] The database schema is migrated cleanly on Neon
- [ ] OWASP ASVS Level 1 requirements are met

---

## 6. Out-of-Scope for Phase 1

- Mobile native applications (Android, iOS)
- Hindi-language interface
- User-generated content
- Payments or subscriptions
- Real-time websocket features
- AI-generated editorial content
- Full-text article republication
