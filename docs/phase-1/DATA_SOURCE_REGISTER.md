# DATA SOURCE REGISTER
**Stage 3A — News Source Feasibility**
*Version 1.0 · 2026-10-14*

---

## Overview

This register records every candidate news and content data source evaluated for Parmanu Phase 1. Each source is assessed for legal access, data quality, freshness, cost, and technical integration complexity.

**Evaluation methodology:**
1. Review official documentation.
2. Assess terms of service and attribution requirements.
3. Estimate data quality and freshness.
4. Record failure modes and fallback options.
5. Mark integration status honestly (verified / unverified).

---

## Source Category 1 — RSS Feeds (India Publishers)

### ACCESS STATUS: ✅ Available and Verified (Legally Permitted with Attribution)

RSS is designed for syndication. The majority of Indian news publishers expose RSS feeds. Use requires attribution and a link to the original article. Full-text republication without a license is generally prohibited.

| Publisher | RSS URL | Auth | Fields Available | Freshness | Rate Limit | Attribution Required | Republication | Cost |
|---|---|---|---|---|---|---|---|---|
| The Hindu | `https://www.thehindu.com/feeder/default.rss` | None | title, link, description (excerpt), pubDate, author | 15–30 min | None documented | Yes — "Source: The Hindu" | Excerpts only | Free |
| NDTV | `https://feeds.feedburner.com/ndtvnews-top-stories` | None | title, link, summary, pubDate | 10–20 min | None documented | Yes | Excerpts only | Free |
| Times of India | `https://timesofindia.indiatimes.com/rssfeedstopstories.cms` | None | title, link, description, pubDate | 15 min | None documented | Yes | Excerpts only | Free |
| Indian Express | `https://indianexpress.com/feed/` | None | title, link, description, pubDate | 20 min | None documented | Yes | Excerpts only | Free |
| Hindustan Times | `https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml` | None | title, link, description, pubDate | 15 min | None documented | Yes | Excerpts only | Free |
| LiveMint | `https://www.livemint.com/rss/news` | None | title, link, excerpt, pubDate | 20 min | None documented | Yes | Excerpts only | Free |
| Economic Times | `https://economictimes.indiatimes.com/rssfeedsdefault.cms` | None | title, link, description, pubDate | 15 min | None documented | Yes | Excerpts only | Free |
| ANI News | `https://www.aninews.in/rss/` | None | title, link, description, pubDate | 5–10 min | None documented | Yes | Excerpts only | Free |
| PTI (via outlets) | Available through outlet feeds | None | title, link, pubDate | 5–10 min | None documented | Yes | Excerpts only | Free |
| Moneycontrol | `https://www.moneycontrol.com/rss/latestnews.xml` | None | title, link, description, pubDate | 10 min | None documented | Yes | Excerpts only | Free |
| CNBC TV18 | `https://www.cnbctv18.com/rssfeeds/` | None | title, link, description, pubDate | 10 min | None documented | Yes | Excerpts only | Free |
| ESPN Cricinfo | `https://www.espncricinfo.com/rss/content/story/feeds/0.xml` | None | title, link, description, pubDate | 15 min | None documented | Yes | Excerpts only | Free |

**Integration status:** UNVERIFIED — RSS URLs documented; programmatic fetch not yet executed. Fetch test plan in FEASIBILITY_DECISIONS.md.

**Failure modes:**
- RSS URL changes without notice (monitor 404 response).
- Feed goes stale (implement last-modified check).
- Duplicate articles across outlets (dedup by canonical URL and content hash).

**Legal considerations:**
- Full article text may not be stored or displayed.
- Thumbnail images may have separate copyright; use text-only excerpts unless explicitly licensed.
- Attribution with a clickable source link is mandatory on every card.

---

## Source Category 2 — Licensed News APIs

### 2A. GNews API

| Property | Value |
|---|---|
| Documentation | `https://gnews.io/docs/v4` |
| Auth | API key (header) |
| Plan | Free: 100 req/day, 10 articles/request. Paid: from \$9/month |
| Fields | title, description, content (truncated), url, image, publishedAt, source.name, source.url |
| Freshness | Near real-time |
| Rate limit | Free: 100/day; paid plans higher |
| India support | Yes — `country=in` parameter |
| Attribution | Required |
| Storage | Temporary cache only per ToS |
| Integration status | UNVERIFIED — API key not obtained |

### 2B. NewsData.io

| Property | Value |
|---|---|
| Documentation | `https://newsdata.io/documentation` |
| Auth | API key |
| Plan | Free: 200 req/day, 10 articles/response. Paid: from \$49/month |
| Fields | title, link, description, pubDate, source_id, category, country, language, image_url, content (licensed tiers) |
| Freshness | 15–30 min |
| India support | Yes — `country=in` |
| Languages | English, Hindi |
| Attribution | Required |
| Integration status | UNVERIFIED |

### 2C. NewsAPI.org

| Property | Value |
|---|---|
| Documentation | `https://newsapi.org/docs` |
| Auth | API key |
| Plan | Free (dev only, not for production): 100 req/day. Paid: from \$449/month |
| Fields | title, description, url, urlToImage, publishedAt, source, author, content (truncated) |
| Note | **Free tier prohibits commercial/production use.** Production requires paid license. |
| Integration status | UNVERIFIED — not recommended for MVP due to cost |

### 2D. The Guardian API

| Property | Value |
|---|---|
| Documentation | `https://open-platform.theguardian.com/documentation/` |
| Auth | API key (free) |
| Fields | webTitle, webUrl, webPublicationDate, sectionId, fields.body (licensed) |
| India content | Available but UK-centric |
| Attribution | "Powered by The Guardian" required |
| Cost | Free for non-commercial and small commercial use |
| Integration status | UNVERIFIED |

---

## Source Category 3 — Government and Official Announcements

| Source | URL | Auth | Fields | Freshness | Notes |
|---|---|---|---|---|---|
| PIB (Press Information Bureau) | `https://pib.gov.in/` — RSS available | None | title, summary, date, ministry | Daily | Official GoI press releases — high trust |
| Lok Sabha / Rajya Sabha | `https://sansad.in/` | None | Bill notifications, session schedules | Per session | Structured but HTML scraping needed |
| SEBI | `https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=5&ssid=0&smid=0` | None | Circulars, orders, press releases | Per announcement | High legal significance |
| RBI | `https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx` | None | Press releases | Per announcement | High financial significance |
| MCA21 / Ministry of Corporate Affairs | `https://www.mca.gov.in/` | None | Company filings | Daily | Complex structure |
| Election Commission | `https://eci.gov.in/` | None | Election notifications | Per event | High civic value |

**Legal considerations:** Government press releases in India are generally public domain and may be reproduced with attribution. Always verify individual source terms.

---

## Source Category 4 — PR Wire Services

| Source | URL | Auth | Fields | Cost | Notes |
|---|---|---|---|---|---|
| PR Newswire Asia | `https://www.prnewswire.com/rss/news-releases-list.rss` | None (public RSS) | title, body, date, company, contact | Free (public feed) | Key source for brand–creator collaboration announcements |
| Business Wire India | `https://www.businesswireindia.com/rss` | None | title, summary, date | Free | India-focused corporate announcements |
| Globe Newswire India | `https://www.globenewswire.com/RssFeed/country/India` | None | title, summary, date, company | Free | International with India filter |

**High value for:** Collaboration Radar — brands announce influencer partnerships here.

---

## Source Category 5 — Sports

| Source | URL | Auth | Fields | Cost | Notes |
|---|---|---|---|---|---|
| CricInfo RSS | `https://www.espncricinfo.com/rss/content/story/feeds/0.xml` | None | title, link, date | Free | Cricket scores and news |
| BCCI Official | `https://www.bcci.tv/` | None | Press releases (HTML) | Free | Official BCCI announcements |
| FIFA RSS | `https://www.fifa.com/rss-feeds` | None | Match results, news | Free | Football |
| ISL | `https://www.indiansuperleague.com/` | None | Match results (HTML) | Free | Indian Super League |

---

## Source Category 6 — GDELT

| Property | Value |
|---|---|
| URL | `https://www.gdeltproject.org/` |
| Auth | None — publicly available |
| Fields | Event codes, actor names, URLs, date, country, tone score |
| Freshness | Updated every 15 minutes |
| Coverage | Global, India included |
| Cost | Free |
| Legal | Open data — attribution appreciated |
| Integration status | UNVERIFIED — BigQuery access or file download required |
| Recommendation | Useful for trend detection (Phase 2). Complexity deferred from Phase 1. |

---

## Source Prioritization for MVP Launch

| Priority | Source | Rationale |
|---|---|---|
| **Tier 1** | Top 15 Indian publisher RSS feeds | Free, legal, reliable, sufficient for launch |
| **Tier 1** | PIB and RBI official feeds | High-trust official sources |
| **Tier 1** | PR Newswire and Business Wire India RSS | Essential for Collaboration Radar |
| **Tier 2** | GNews API (paid tier) | Fills gaps, adds India-specific discovery |
| **Tier 2** | The Guardian API | World news coverage |
| **Tier 3** | NewsData.io | Hindi language support for Phase 2 |
| **Deferred** | GDELT | Phase 2 trend detection |
| **Excluded** | NewsAPI.org free tier | Prohibits production use |

---

## Data Freshness SLA

| Category | Target Freshness | Polling Interval |
|---|---|---|
| Breaking news | < 15 minutes | Every 10 minutes |
| General news | < 30 minutes | Every 20 minutes |
| Creator / PR events | < 60 minutes | Every 30 minutes |
| Government announcements | < 4 hours | Every 2 hours |

---

## Failure Modes and Mitigations

| Failure | Impact | Mitigation |
|---|---|---|
| RSS feed goes down | Missing articles from one outlet | Fallback to cached items; alert operations |
| API rate limit hit | Ingestion stops | Exponential backoff; distribute requests across time |
| Duplicate articles | Noise in feed | Canonical URL deduplication + content hash check |
| Copyright violation | Legal risk | Store metadata only; never full article text; attribution mandatory |
| Feed URL changes | Silent 404 | Monitor HTTP response codes; alert if 404 for >1 hour |
