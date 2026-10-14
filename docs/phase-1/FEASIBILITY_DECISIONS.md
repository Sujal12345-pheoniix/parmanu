# FEASIBILITY DECISIONS
**Stage 3 — Go/No-Go and Architecture Decisions**
*Version 1.0 · 2026-10-14*

---

## Decision Framework

Each decision records: the question, the options evaluated, the chosen path, the rationale, the risk, and the evidence basis.

---

## FD-001: Can we build a useful news product with only RSS and free APIs?

**Question:** Is the RSS + free-API combination sufficient for a credible India news product at launch?

**Options evaluated:**
1. RSS only (free, limited to 15 outlets)
2. RSS + GNews paid (\$9/month)
3. RSS + full licensed wire service (PTI license ~\$2,000–5,000/month)

**Decision: Option 2 — RSS + GNews paid at \$9/month.**

**Rationale:**
- Top 15 Indian publisher RSS feeds cover >80% of major India news stories.
- GNews fills gaps and provides structured metadata.
- PTI wire license is appropriate at scale (Phase 3), not MVP.
- Free tier of GNews prohibits production use.

**Risk:** RSS feeds can change or disappear without notice. Mitigated by monitoring HTTP response codes and having multiple feeds per category.

**Evidence basis:** RSS URLs documented in DATA_SOURCE_REGISTER.md; GNews pricing from gnews.io/pricing.

**Status: APPROVED FOR PHASE 1.**

---

## FD-002: Can we build the Collaboration Radar without Instagram API access?

**Question:** Is the Collaboration Radar viable without being able to monitor arbitrary Instagram accounts?

**Options evaluated:**
1. Instagram API only → Requires creator OAuth; can't monitor non-authenticated creators
2. Web scraping → **Prohibited** by Meta ToS and potentially illegal
3. PR/news-based only → Legitimate, covers major brand announcements
4. PR/news + creator-authenticated Instagram data → Best of both

**Decision: Option 4 — PR/news primary, Instagram OAuth supplementary.**

**Rationale:**
- Brand-creator collaborations are announced via PR Newswire, Business Wire, and news outlets. These are legitimate, citable sources.
- ASCI mandates disclosure in India, creating a secondary signal via #ad tags (visible in posts creators share publicly).
- Creators can voluntarily connect their Instagram accounts to surface their own collaboration-tagged posts.
- This architecture is honest, legally defensible, and ships faster.

**Risk:** PR wire coverage has a lag of hours to days after a collaboration begins. Creators may activate partnerships through Instagram posts before making a formal announcement.

**Mitigation:** Label all collaboration data with source and timestamp. Never present as "live" or "real-time" unless source is real-time.

**Evidence basis:** Instagram API documentation confirms arbitrary account monitoring requires account holder authorization. INSTAGRAM_FEASIBILITY.md section 5.

**Status: APPROVED — Build Collaboration Radar on PR/news sources for Phase 1.**

---

## FD-003: Should we use the Instagram Basic Display API or the Graph API for creator connections?

**Question:** Which Meta API should power the creator-connect feature?

**Options evaluated:**
1. Basic Display API — available to all Instagram account types; provides media list and profile
2. Graph API — requires Business/Creator account type + Facebook Page + App Review

**Decision: Start with Basic Display API; upgrade to Graph API in Phase 2.**

**Rationale:**
- Basic Display API requires less onerous app review.
- It provides sufficient data for Phase 1 (media list, captions, timestamps, permalinks).
- Graph API unlocks insights (impressions, reach) but requires lengthy Meta review.
- Most creators Parmanu targets in Phase 1 may not have business accounts.

**Risk:** Meta has signaled intent to deprecate Basic Display API. Must monitor Meta announcements. If deprecated, Graph API with creator accounts becomes mandatory.

**Mitigation:** Design the OAuth flow and token storage to be swappable between API types. Abstract the Instagram data layer behind a provider interface.

**Status: APPROVED — Basic Display API for Phase 1; plan Graph API migration for Phase 2.**

---

## FD-004: Full-text article storage — permitted or not?

**Question:** Can we store full article text from RSS feeds or licensed APIs?

**Options evaluated:**
1. Store full text → Generally violates publisher copyright and API ToS
2. Store metadata only (headline, excerpt, source URL, timestamp) → Safe, standard aggregator practice
3. License content directly → Cost-prohibitive for Phase 1

**Decision: Store metadata only. Never store full article text.**

**Rationale:**
- Nearly every publisher's RSS ToS permits excerpt/headline usage with attribution and a clickable source link.
- Full text republication without a direct license is copyright infringement.
- Our product value is discovery and provenance, not content hosting.
- Users click through to the original article; this drives traffic to publishers (positive relationship).

**Risk:** Without full text, AI summarization features are not possible in Phase 1 (confirmed as intentional deferral per PRD Section 4.8).

**Status: APPROVED — Metadata only. This is enforced at the data model level (no full_text column in source_items table).**

---

## FD-005: Minimum viable source set to launch a useful product

**Question:** What is the absolute minimum set of sources required before we can launch?

**Decision: The following sources are required to launch:**

| Source | Category | Minimum Articles/Day |
|---|---|---|
| The Hindu RSS | National, Politics, World | 50+ |
| NDTV RSS | National, Breaking News | 50+ |
| Economic Times RSS | Business, Finance | 30+ |
| Times of India RSS | National, Entertainment | 50+ |
| Moneycontrol RSS | Business, Markets | 30+ |
| ANI RSS | National, Politics | 30+ |
| PIB RSS | Government, Policy | 10+ |
| ESPN Cricinfo RSS | Sports | 20+ |
| PR Newswire India RSS | Creator Intelligence | 5+ |
| Business Wire India RSS | Creator Intelligence | 5+ |

**Total minimum:** ~280+ articles/day across 8 categories.

**Status: This is the launch gate. All 10 sources must be confirmed ingesting before soft launch.**

---

## FD-006: Does the Neon PostgreSQL free tier support Phase 1?

**Question:** Is Neon's free tier sufficient, or do we need a paid plan?

**Neon free tier:**
- 0.5 GB storage
- 1 compute unit (0.25 vCPU, 1 GB RAM)
- Autoscaling to 0 (cold starts possible)
- 1 project, 1 branch

**Assessment:** Sufficient for development and early launch. Expected Phase 1 data volume:
- ~300 articles/day × 90 days = 27,000 records
- Each record ~2 KB = ~54 MB total
- Well within 0.5 GB free tier.

**Decision: Neon free tier for Phase 1. Upgrade to Neon Launch (\$19/month) when approaching 0.4 GB storage or when cold-start latency becomes user-visible.**

**Status: APPROVED — Free tier sufficient for Phase 1.**

---

## FD-007: Should we pre-build for mobile (React Native) or defer?

**Decision: Defer mobile applications until the web MVP is validated.**

**Rationale:**
- React Native shares business logic but doubles UI surface area for a small team.
- A responsive Next.js web app serves mobile browsers adequately for Phase 1 validation.
- Build once, validate the product; build again (native) once we know what users actually want.

**Status: APPROVED — React Native deferred to Phase 3.**

---

## Integration Test Plan (To Be Executed)

The following tests must be executed before development Sprint 1 begins:

| Test ID | Source | Action | Success Criterion | Blocking? |
|---|---|---|---|---|
| IT-001 | The Hindu RSS | HTTP GET and parse XML | Returns ≥10 articles | Yes |
| IT-002 | NDTV RSS | HTTP GET and parse XML | Returns ≥10 articles | Yes |
| IT-003 | PIB RSS | HTTP GET and parse XML | Returns ≥5 press releases | Yes |
| IT-004 | PR Newswire India RSS | HTTP GET and parse XML | Returns ≥1 item | Yes |
| IT-005 | GNews API | GET with API key | Returns 10 articles for `country=in` | No (paid) |
| IT-006 | Neon DB | Prisma connection test | `SELECT 1` returns without error | Yes |
| IT-007 | Instagram Basic Display | OAuth flow with test user | Access token obtained | No (Phase 1 optional) |

**IT-001 through IT-006 are blocking for Phase 1 Sprint 1 start.**
