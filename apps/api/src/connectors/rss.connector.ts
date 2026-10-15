import { XMLParser } from 'fast-xml-parser';
import {
  CanonicalSourceItem,
  CanonicalSourceItemSchema,
  ContentType,
  ProvenanceState,
  RightsStatus,
} from '@parmanu/types';
import {
  ConnectorError,
  ConnectorFailureType,
  ConnectorFetchResult,
  ConnectorHealth,
  SourceAdapter,
  SourceConnector,
  validateUrlForSsrf,
  withRetry,
} from './base.connector';

/**
 * Strips HTML tags and unescapes common entities from text (headlines and excerpts)
 */
export function cleanText(rawText?: string, maxLength: number = 500): string | undefined {
  if (!rawText) return undefined;
  const noHtml = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const unescaped = noHtml
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  return unescaped.slice(0, maxLength).trim();
}

/**
 * Parses publication date string into a valid Date, falling back to current date if missing or unparseable
 */
export function parsePubDate(dateStr?: string): Date {
  if (!dateStr) return new Date();
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}

export class RssSourceConnector implements SourceAdapter, SourceConnector {
  public readonly id = 'rss-standard-connector';
  public readonly name = 'Standard RSS 2.0 / Atom Connector';
  public readonly sourceType = 'RSS' as const;
  public readonly supportedContentTypes: ContentType[] = ['NEWS_ARTICLE', 'SPORTS_UPDATE'];
  public readonly attributionRequirement = 'Mandatory publisher name attribution and direct permalink';

  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      trimValues: true,
    });
  }

  public async fetch(sourceConfig: {
    id: string;
    feedUrl?: string | null;
    apiProvider?: string | null;
    apiConfig?: any;
    category: string[];
    language: string;
    type?: string;
  }): Promise<ConnectorFetchResult> {
    if (!sourceConfig.feedUrl) {
      throw new ConnectorError(ConnectorFailureType.VALIDATION_ERROR, 'feedUrl is required for RSS connector', undefined, false);
    }

    // SSRF validation
    validateUrlForSsrf(sourceConfig.feedUrl);

    const startTime = Date.now();

    // Fetch RSS feed with timeout and retry
    const xmlContent = await withRetry(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000); // 12s timeout

      try {
        const response = await fetch(sourceConfig.feedUrl!, {
          method: 'GET',
          headers: {
            'User-Agent': 'ParmanuNewsBot/1.0 (+https://parmanu.dev; research and metadata indexing)',
            Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, text/html;q=0.9',
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          throw new ConnectorError(
            ConnectorFailureType.HTTP_ERROR,
            `Failed to fetch feed: HTTP ${response.status} ${response.statusText}`,
            response.status,
            response.status >= 500 || response.status === 429
          );
        }

        return await response.text();
      } catch (err: any) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
          throw new ConnectorError(ConnectorFailureType.NETWORK_TIMEOUT, `Connection timed out after 12s fetching ${sourceConfig.feedUrl}`);
        }
        if (err instanceof ConnectorError) throw err;
        throw new ConnectorError(ConnectorFailureType.NETWORK_TIMEOUT, `Network error: ${err.message}`);
      }
    });

    const responseTimeMs = Date.now() - startTime;

    // Parse XML
    let parsedObj: any;
    try {
      parsedObj = this.xmlParser.parse(xmlContent);
    } catch (err: any) {
      throw new ConnectorError(ConnectorFailureType.PARSE_ERROR, `Failed to parse RSS XML: ${err.message}`, undefined, false);
    }

    // Extract items (support RSS 2.0 <channel><item> and Atom <feed><entry>)
    let rawItems: any[] = [];
    if (parsedObj?.rss?.channel?.item) {
      rawItems = Array.isArray(parsedObj.rss.channel.item) ? parsedObj.rss.channel.item : [parsedObj.rss.channel.item];
    } else if (parsedObj?.feed?.entry) {
      rawItems = Array.isArray(parsedObj.feed.entry) ? parsedObj.feed.entry : [parsedObj.feed.entry];
    } else if (parsedObj?.channel?.item) {
      rawItems = Array.isArray(parsedObj.channel.item) ? parsedObj.channel.item : [parsedObj.channel.item];
    }

    if (!rawItems.length) {
      return {
        items: [],
        rawCount: 0,
        newCount: 0,
        responseTimeMs,
      };
    }

    const isGovSource = sourceConfig.type === 'GOVERNMENT_FEED' || sourceConfig.feedUrl.includes('pib.gov.in');

    const canonicalItems: CanonicalSourceItem[] = [];

    for (const raw of rawItems) {
      const headline = cleanText(String(raw.title || ''), 400);
      let canonicalUrl = '';

      if (typeof raw.link === 'string') {
        canonicalUrl = raw.link.trim();
      } else if (raw.link?.['@_href']) {
        canonicalUrl = raw.link['@_href'].trim();
      } else if (raw.guid && typeof raw.guid === 'string' && raw.guid.startsWith('http')) {
        canonicalUrl = raw.guid.trim();
      }

      // Skip invalid items lacking headline or URL
      if (!headline || !canonicalUrl) continue;

      const excerpt = cleanText(raw.description || raw.summary || raw['content:encoded'], 600);
      const author = typeof raw['dc:creator'] === 'string' ? raw['dc:creator'] : typeof raw.author === 'string' ? raw.author : undefined;
      const pubDate = parsePubDate(raw.pubDate || raw.published || raw.updated || raw['dc:date']);

      // Determine initial provenance state
      const provenanceState: ProvenanceState = isGovSource ? 'OFFICIAL_CONFIRMED' : 'SINGLE_SOURCE';
      const contentType: ContentType = isGovSource ? 'GOVERNMENT_ANNOUNCEMENT' : 'NEWS_ARTICLE';

      const candidate = {
        sourceId: sourceConfig.id,
        externalId: typeof raw.guid === 'string' ? raw.guid : typeof raw.id === 'string' ? raw.id : undefined,
        canonicalUrl,
        headline,
        excerpt,
        author,
        publishedAt: pubDate,
        contentType,
        category: sourceConfig.category,
        language: sourceConfig.language || 'en',
        imageUrl: raw.enclosure?.['@_url'] || raw['media:content']?.['@_url'] || null,
        rightsStatus: isGovSource ? ('PUBLIC_DOMAIN' as RightsStatus) : ('METADATA_ONLY' as RightsStatus),
        retentionDays: 90,
        provenanceState,
      };

      const parsedItem = CanonicalSourceItemSchema.safeParse(candidate);
      if (parsedItem.success) {
        canonicalItems.push(parsedItem.data);
      }
    }

    return {
      items: canonicalItems,
      rawCount: rawItems.length,
      newCount: canonicalItems.length,
      responseTimeMs,
    };
  }

  public async healthCheck(sourceConfig: { feedUrl?: string | null }): Promise<ConnectorHealth> {
    if (!sourceConfig.feedUrl) {
      return {
        isHealthy: false,
        consecutiveFailures: 1,
        lastErrorMessage: 'feedUrl is missing',
      };
    }

    const start = Date.now();
    try {
      validateUrlForSsrf(sourceConfig.feedUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(sourceConfig.feedUrl, {
        method: 'HEAD',
        headers: { 'User-Agent': 'ParmanuBot/1.0-HealthCheck' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      return {
        isHealthy: res.ok,
        lastSuccessAt: res.ok ? new Date() : undefined,
        lastFailureAt: !res.ok ? new Date() : undefined,
        consecutiveFailures: res.ok ? 0 : 1,
        lastErrorMessage: res.ok ? undefined : `HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        isHealthy: false,
        lastFailureAt: new Date(),
        consecutiveFailures: 1,
        lastErrorMessage: err.message,
      };
    }
  }
}
