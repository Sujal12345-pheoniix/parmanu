# INSTAGRAM FEASIBILITY REPORT
**Stage 3B — Instagram and Creator Intelligence Data Access**
*Version 1.0 · 2026-10-14*

---

> [!IMPORTANT]
> This document reflects the documented capabilities of the **Meta Instagram API** as of October 2025. Instagram's API policies and rate limits change frequently. Verify against official Meta documentation before implementing any integration.
> Official documentation: https://developers.facebook.com/docs/instagram

---

## 1. Executive Summary

Building a comprehensive Instagram creator-intelligence platform using the official Meta API alone is **significantly constrained**. The API does not allow arbitrary monitoring of public accounts without those accounts explicitly granting your app permission. This is a hard architectural constraint that must be accepted upfront.

**Honest capability statement:**

| Desired Capability | API Reality |
|---|---|
| Monitor any public creator's posts | ❌ Not permitted without creator OAuth |
| Get follower counts for any account | ❌ Not available without creator permission |
| Discover brand-deal hashtags at scale | ⚠️ Limited — only for authenticated accounts |
| See collaboration-tagged posts | ⚠️ Only for accounts that granted permission |
| Webhook for new posts | ✅ Available — only for authenticated creator accounts |
| Creator's own media feed | ✅ Available after creator OAuth |
| Business account insights | ✅ Available for Business/Creator accounts after OAuth |

**Conclusion:** The Collaboration Radar and Creator Intelligence features must be built primarily on **publicly announced information** (PR, news, official statements) with Instagram API data used only as a supplemental layer for creators who actively authenticate with Parmanu.

---

## 2. Available Instagram API Products

### 2A. Instagram Basic Display API

| Property | Value |
|---|---|
| Documentation | `https://developers.facebook.com/docs/instagram-basic-display-api` |
| Purpose | Allows users to access their own profile and media |
| Account type | Any Instagram account |
| Authorization | OAuth 2.0 — account holder must authorize |
| What you can get | User profile (id, username, account_type), Media (id, caption, media_type, media_url, timestamp, permalink) |
| What you **cannot** get | Other users' data; follower counts; engagement metrics; collaboration tags |
| Token lifetime | Short-lived (1 hour) → Exchange for long-lived (60 days) → Refresh before expiry |
| Rate limits | 200 calls/hour per user token |
| Storage rules | Media URLs expire; do not cache media bytes long-term without explicit permission |
| Integration status | **UNVERIFIED** — Requires approved Meta App |

### 2B. Instagram Graph API (Business / Creator Accounts)

| Property | Value |
|---|---|
| Documentation | `https://developers.facebook.com/docs/instagram-api` |
| Purpose | Professional analytics for Business and Creator accounts |
| Account type | Must be a Business or Creator account connected to a Facebook Page |
| Authorization | OAuth 2.0 with specific permissions |
| Permissions required | `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, `pages_read_engagement` |
| App review | **Required** — Meta must approve your app for advanced permissions |
| What you can get | Media list, media insights (reach, impressions, likes, comments, saves — for own account), profile metrics, hashtag search (limited) |
| What you **cannot** get | Competitor analysis; other users' private engagement; follower lists of arbitrary accounts |
| Rate limits | 200 calls/hour per user; 4,800 calls/24h app-level for some endpoints |
| Integration status | **UNVERIFIED** — Requires Meta Developer App and approved permissions |

### 2C. Mentions API

| Property | Value |
|---|---|
| Available for | Business accounts where another user @-mentions them |
| Scope required | `instagram_manage_comments` |
| What you get | Media ID, caption, media type, timestamp of posts that mention your account |
| Limitation | Only works for accounts connected to your app; cannot monitor arbitrary mention patterns |
| Integration status | **UNVERIFIED** |

### 2D. Webhooks

| Property | Value |
|---|---|
| Documentation | `https://developers.facebook.com/docs/instagram-api/guides/webhooks` |
| Available events | `mentions` (Business only), `comments`, `live_comments` |
| New post webhook | ❌ **Not available** — no webhook for new posts/Reels from followed accounts |
| Polling for new posts | Must poll `/me/media` for each authenticated creator |
| Rate consideration | 200 calls/hour limit means polling every ~18 seconds at maximum; practical interval: every 15–30 minutes |

---

## 3. Capability Classification

### ✅ Category 1: Available and Verified in Principle

*(Requires Meta App approval and creator OAuth)*

- Read authenticated creator's own media list
- Read authenticated creator's own profile (username, bio, account type)
- Read authenticated creator's own media insights (reach, impressions, likes, comments)
- Receive mention webhooks for Business accounts connected to the app
- Read authenticated creator's comment threads

### ⚠️ Category 2: Available Only with Specific Authorization

*(Requires both Meta App review approval AND individual creator consent)*

- Post-level insights (impressions, reach) — requires `instagram_manage_insights` + creator OAuth
- Business account audience demographics — requires Business account type + page connection
- Content publishing on behalf of creator — requires `instagram_content_publish` permission
- Story viewing — requires specific permissions; stories expire after 24 hours

### 📋 Category 3: Available Through Licensed Third-Party Provider

*(Subject to commercial contract — see PROVIDER_COSTS_AND_LIMITS.md)*

- Historical engagement benchmarks
- Audience quality scores
- Cross-platform analytics
- Competitor monitoring (within their data-rights framework)

Candidate providers: **Modash, Hypeauditor, Phyllo, Sprout Social API, CreatorIQ**

### 📰 Category 4: Discoverable Through Public Announcements

*(Legitimate and recommended for Collaboration Radar MVP)*

- Brand-creator partnership announcements (PR Newswire, Business Wire, brand press releases)
- News coverage of influencer campaigns (from news RSS feeds)
- Creator's own public statements (linked bio, Linktree, official website)
- Sponsored post disclosure (ASCI guidelines require #ad or #sponsored disclosure in India)
- Brand and creator profile pages (public, non-API)
- Official Instagram posts linked in news articles

### ❌ Category 5: Unavailable, Prohibited, or Unverified

- Scraping any Instagram page (violates Meta ToS Section 3.2 — "do not access our Services using automated means")
- Monitoring arbitrary public accounts without their consent
- Accessing DMs or private story content
- Mass follower list extraction
- Real-time post detection for non-authenticated creators
- Historical engagement data for non-authenticated creators
- Accessing content of private accounts

> [!CAUTION]
> Scraping Instagram without authorization violates Meta's Terms of Service and potentially the Computer Fraud and Abuse Act (US) and India's IT Act Section 43. This will not be implemented under any circumstances.

---

## 4. ASCI Compliance and #ad Disclosure as a Data Signal

The Advertising Standards Council of India (ASCI) requires all sponsored/paid content to be disclosed. This disclosure creates a legitimate, publicly available data signal:

- Creators must tag posts with `#ad`, `#sponsored`, `#gifted`, or `#collab` when paid.
- Brand account tagging in collaboration posts is visible in the post's tag structure.
- This public disclosure can be monitored through official post links shared in news/PR.
- Instagram's "Paid partnership with" label is visible in post headers for authorized collaborations.

**Architecture implication:** When creators authenticate with Parmanu, we can read their collaboration-tagged posts to populate the Collaboration Radar. For non-authenticated creators, we rely exclusively on news/PR sources.

---

## 5. Honest Alternative Architecture

Given the API constraints, the Creator Intelligence engine uses this data hierarchy:

```
Priority 1: Authenticated Creator Data (Instagram OAuth)
  └─ Creator connects their account to Parmanu
  └─ We read their media, insights, and mentions
  └─ Highest quality, real-time data

Priority 2: Official Brand/Creator Announcements (PR feeds)
  └─ PR Newswire, Business Wire India RSS
  └─ Brand press releases
  └─ News articles about campaigns
  └─ Reliable but delayed (hours to days after event)

Priority 3: Licensed Data Provider (Phase 2)
  └─ Modash or Phyllo for enriched creator profiles
  └─ Subject to commercial agreement

Priority 4: Manual Editorial Curation (Launch)
  └─ Editors add confirmed collaborations with source links
  └─ No automation without source verification
```

---

## 6. Integration Test Plan (Unverified — Pending Meta App Approval)

**Pre-conditions:**
1. Create Meta Developer account at `developers.facebook.com`.
2. Create an app of type "Consumer" or "Business".
3. Add "Instagram Basic Display" product.
4. Submit for App Review with justification for each permission.
5. Obtain test user credentials (Instagram test accounts can be added without full review).

**Test 1 — Basic Display API (No App Review Needed for Test Users)**
```
GET https://api.instagram.com/oauth/authorize
  ?client_id={app-id}
  &redirect_uri={redirect_uri}
  &scope=user_profile,user_media
  &response_type=code
```
Expected: OAuth redirect with authorization code.
Success criterion: Receive access token and be able to call `/me?fields=id,username`.

**Test 2 — Media List**
```
GET https://graph.instagram.com/me/media
  ?fields=id,caption,media_type,timestamp,permalink
  &access_token={token}
```
Expected: List of up to 20 most recent media items.
Success criterion: Response contains `id`, `caption`, `media_type`, `timestamp`.

**Test 3 — Token Refresh**
```
GET https://graph.instagram.com/refresh_access_token
  ?grant_type=ig_refresh_token
  &access_token={long_lived_token}
```
Success criterion: New token returned with 60-day expiry.

**Integration status: UNVERIFIED** — These tests have not been executed. Meta App has not been created. Execution blocked on obtaining Meta Developer credentials.

---

## 7. Token Lifecycle and Security Requirements

| Requirement | Implementation |
|---|---|
| Short-lived tokens (1h) | Exchange immediately for long-lived token server-side |
| Long-lived tokens (60d) | Stored encrypted in database, never in client |
| Token refresh | Automated job runs at day 50 (10 days before expiry) |
| Token revocation | Delete from DB immediately when creator disconnects |
| Data deletion | Creator data purged within 30 days of access revocation (per Meta policy) |
| Webhook verification | Validate `X-Hub-Signature-256` on every incoming webhook |

---

## 8. Privacy and Legal Compliance

| Regulation | Requirement | Implementation |
|---|---|---|
| Meta Platform Policy | Only access data explicitly permitted; no scraping | Enforced at architecture level |
| India DPDP Act 2023 | Consent before collecting personal data | OAuth consent screen + in-app consent flow |
| GDPR (for EU users) | Right to erasure, data portability | Data deletion endpoint and export function |
| ASCI Guidelines | Disclose AI/automated analysis if used | Label automated insights as "AI-powered" |

---

## 9. Recommendation

**For Phase 1 MVP:**

1. Build the Collaboration Radar entirely from PR/news sources — no Instagram API dependency.
2. Build an "Connect Instagram" opt-in flow for creators who want to see their own analytics on Parmanu.
3. Display only data that comes from authorized API calls or public PR announcements.
4. Label every data point with its source and timestamp.
5. Do not display follower counts or engagement metrics for any creator who has not authenticated.

**For Phase 2:**
- Complete Meta App Review for Graph API advanced permissions.
- Evaluate Phyllo or Modash for enriched creator data under commercial license.
- Build automated PR-signal monitoring to detect new collaboration announcements.
