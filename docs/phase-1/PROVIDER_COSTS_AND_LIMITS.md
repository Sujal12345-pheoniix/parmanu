# PROVIDER COSTS AND LIMITS
**Stage 3 — External Provider Cost and Rate-Limit Register**
*Version 1.0 · 2026-10-14*

---

## Scope

This document records the known and estimated costs, rate limits, and contractual constraints for every external provider considered for Parmanu Phase 1 and Phase 2. All pricing is indicative and must be verified at contract time.

> [!WARNING]
> Pricing for API providers changes frequently. All figures below reflect publicly documented tiers as of October 2025. Verify before signing contracts or budgeting.

---

## 1. News and Content APIs

| Provider | Free Tier | Paid Entry | Paid Scale | Rate Limit | Production Eligible | Recommendation |
|---|---|---|---|---|---|---|
| **RSS Feeds** | Free | N/A | N/A | Polite crawl (1 req/10 min per feed) | ✅ Yes | **Tier 1 — Use for launch** |
| **GNews API** | 100 req/day, 10 articles/req | \$9/month (300 req/day) | \$49/month (1,000 req/day) | Varies by plan | ✅ Yes (paid) | Tier 2 — good supplementary source |
| **NewsData.io** | 200 req/day, 10 articles/req | \$49/month | \$149/month | 200/day free; higher on paid | ✅ Yes | Tier 2 — good for Hindi support |
| **NewsAPI.org** | 100 req/day (dev only) | \$449/month | \$749/month+ | 100/day free | ❌ Free tier prohibits production | Excluded from Phase 1 |
| **The Guardian Open API** | Free (non-commercial + small commercial) | Free with approval | Custom enterprise | 5,000 req/day | ✅ Yes | Useful for world news supplement |
| **GDELT** | Free (BigQuery) | Free + BigQuery costs | BigQuery standard pricing | No explicit limit | ✅ Yes | Deferred to Phase 2 |

### Phase 1 Estimated Monthly News API Cost

| Item | Monthly Cost |
|---|---|
| RSS feeds (self-hosted poller) | \$0 |
| GNews API (Starter) | \$9 |
| The Guardian API | \$0 |
| Compute for ingestion service | ~\$10–30 (Railway/Render hobby) |
| **Total estimated Phase 1 news data cost** | **\$19–39/month** |

---

## 2. Instagram / Creator Intelligence Providers

### 2A. Meta Instagram API (Official)

| Property | Value |
|---|---|
| Cost | Free (no per-call charge) |
| Rate limit | 200 API calls/hour per user token; 4,800/24h app-level |
| App Review | Required for advanced permissions (no cost but 1–4 week review process) |
| Webhook | Free for approved apps |
| Storage | Creator data must be deleted within 90 days of access revocation |
| Contract | Meta Platform Policy — binding, no negotiation |

### 2B. Phyllo (Creator Data API)

| Property | Value |
|---|---|
| URL | `https://www.getphyllo.com/` |
| Model | Creator-connected OAuth — user connects their accounts |
| Pricing | Custom — starts ~\$499/month for startup plans |
| Data available | Connected account insights, historical posts, engagement, follower counts |
| Instagram support | Yes — via creator-authorized OAuth (not scraping) |
| Legal model | Compliant — requires creator consent |
| Recommendation | **Phase 2** — evaluate after MVP validation |

### 2C. Modash

| Property | Value |
|---|---|
| URL | `https://www.modash.io/` |
| Model | B2B influencer intelligence platform |
| Pricing | From \$299/month; API access on Enterprise plan |
| Data available | Creator profiles, engagement rates, audience demographics, brand affiliation |
| Instagram support | Yes — public-profile data within their licensed dataset |
| Legal model | Operates within Meta's developer policies and their own data agreements |
| Recommendation | **Phase 2** — evaluate for brand-facing features |

### 2D. HypeAuditor

| Property | Value |
|---|---|
| URL | `https://hypeauditor.com/` |
| Model | Influencer analytics — B2B |
| Pricing | From \$299/month; API on custom plans |
| Data | Creator reports, audience authenticity, engagement analysis |
| Recommendation | **Phase 3** — brand analytics use case |

### 2E. Sprout Social API

| Property | Value |
|---|---|
| Pricing | Enterprise only — custom pricing |
| Recommendation | Out of scope for Phase 1 and Phase 2 |

### Phase 1 Instagram Cost

| Item | Cost |
|---|---|
| Meta Instagram API | \$0 |
| Third-party creator data provider | \$0 (deferred to Phase 2) |
| **Total Phase 1 Instagram data cost** | **\$0** |

---

## 3. Infrastructure

| Service | Use Case | Free Tier | Estimated Phase 1 Cost |
|---|---|---|---|
| **Neon PostgreSQL** | Primary database | Free (0.5 GB storage, 1 compute unit) | \$0 (free tier sufficient for launch) |
| **Vercel** | Next.js web app hosting | Free (Hobby) | \$0 (Hobby) or \$20/month (Pro) |
| **Railway** | NestJS backend | \$5/month (Starter) | \$5–20/month |
| **Upstash Redis** | Job queue, caching | Free (10k commands/day) | \$0 or \$10/month |
| **Cloudflare R2** | Object storage (permitted media) | Free (10 GB) | \$0 |
| **Cloudflare CDN** | Edge caching | Free | \$0 |
| **Sentry** | Error tracking | Free (5k errors/month) | \$0 |
| **GitHub Actions** | CI/CD | Free (2,000 min/month public) | \$0 |
| **Resend or SendGrid** | Transactional email | Free (100/day) | \$0 |

### Phase 1 Total Estimated Monthly Infrastructure Cost

| Tier | Cost |
|---|---|
| **Minimum (all free tiers)** | \$0–5/month |
| **Recommended (stable, paid essentials)** | \$35–60/month |
| **With GNews + NewsData paid tiers** | \$80–120/month |

---

## 4. Rate Limit Management Strategy

### RSS Feeds
- Stagger polling intervals per source to avoid thundering herd.
- Respect `Cache-Control` and `ETag` headers to minimize redundant requests.
- Maximum: 1 request per feed per 10 minutes.

### Licensed APIs
- Implement token-bucket rate limiting in the ingestion service.
- Store remaining quota in Redis; pause requests when near limit.
- Alert operations when >80% of daily quota is consumed.

### Instagram API
- 200 calls/hour per user token = ~3.3 calls/minute maximum.
- Use webhook-first approach (when available) to avoid polling.
- Distribute polling across time windows for multiple connected creators.
- Implement exponential backoff on 429 responses.

---

## 5. Cost Scaling Projections

| Milestone | Monthly Data Cost | Infrastructure | Total |
|---|---|---|---|
| MVP Launch (1–10k users) | \$9–49 | \$35–60 | **\$44–109** |
| Early Growth (10–100k users) | \$49–149 | \$100–300 | **\$149–449** |
| Scale (100k–1M users) | Custom licensing | \$500–2,000+ | Custom negotiation needed |

> [!NOTE]
> At scale, direct licensing agreements with news publishers (e.g., PTI wire license, HT Media licensing) become cost-effective alternatives to per-API pricing. Budget \$2,000–10,000/month for wire service licenses at the 100k+ user tier.
