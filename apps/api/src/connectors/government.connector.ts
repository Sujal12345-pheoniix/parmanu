import { XMLParser } from 'fast-xml-parser';
import {
  CanonicalSourceItem,
  CanonicalSourceItemSchema,
  ContentType,
  ProvenanceState,
  RightsStatus,
  SourceAdapterConfig,
} from '@parmanu/types';
import {
  ConnectorError,
  ConnectorFailureType,
  ConnectorFetchResult,
  ConnectorHealth,
  SourceAdapter,
  validateUrlForSsrf,
  withRetry,
} from './base.connector';
import { cleanText, parsePubDate } from './rss.connector';

/**
 * Verified list of official Indian Government domains permitted for high-trust ingestion
 */
const VERIFIED_GOV_DOMAINS = [
  'pib.gov.in',
  'rbi.org.in',
  'sansad.in',
  'eci.gov.in',
  'sebi.gov.in',
  'mca.gov.in',
  'nic.in',
  'gov.in',
];

export class GovernmentFeedConnector implements SourceAdapter {
  public readonly id = 'gov-feed-connector';
  public readonly name = 'Official Indian Government & Statutory Feed Connector';
  public readonly sourceType = 'GOVERNMENT_FEED' as const;
  public readonly supportedContentTypes: ContentType[] = ['GOVERNMENT_ANNOUNCEMENT', 'NEWS_ARTICLE'];
  public readonly attributionRequirement = 'Official Government of India attribution with direct gazette/announcement link';

  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      trimValues: true,
    });
  }

  /**
   * Verifies that the endpoint is an official government domain
   */
  public isOfficialDomain(targetUrl: string): boolean {
    try {
      const parsed = new URL(targetUrl);
      const hostname = parsed.hostname.toLowerCase();
      return VERIFIED_GOV_DOMAINS.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`)
      );
    } catch {
      return false;
    }
  }

  public async fetch(sourceConfig: SourceAdapterConfig): Promise<ConnectorFetchResult> {
    if (!sourceConfig.feedUrl) {
      throw new ConnectorError(
        ConnectorFailureType.VALIDATION_ERROR,
        'feedUrl is required for Government Feed connector',
        undefined,
        false
      );
    }

    // SSRF validation
    validateUrlForSsrf(sourceConfig.feedUrl);

    // Domain verification for official status
    const isVerifiedGov = this.isOfficialDomain(sourceConfig.feedUrl);
    const provenanceState: ProvenanceState = isVerifiedGov ? 'OFFICIAL_CONFIRMED' : 'SINGLE_SOURCE';
    const rightsStatus: RightsStatus = isVerifiedGov ? 'PUBLIC_DOMAIN' : 'METADATA_ONLY';

    const startTime = Date.now();

    const xmlContent = await withRetry(async () => {
      const controller = new AbortController();
      const timeoutMs = sourceConfig.timeoutMs || 12000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(sourceConfig.feedUrl!, {
          method: 'GET',
          headers: {
            'User-Agent': 'ParmanuGovBot/1.0 (+https://parmanu.dev; official public domain indexing)',
            Accept: 'application/rss+xml, application/xml, text/xml, application/atom+xml, text/html;q=0.9',
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const retryAfter = response.headers.get('Retry-After');
          const retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : undefined;
          throw new ConnectorError(
            response.status === 429 ? ConnectorFailureType.RATE_LIMITED : ConnectorFailureType.HTTP_ERROR,
            `Government feed request failed: HTTP ${response.status} ${response.statusText}`,
            response.status,
            response.status >= 500 || response.status === 429,
            retryAfterSec
          );
        }

        return await response.text();
      } catch (err: any) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
          throw new ConnectorError(
            ConnectorFailureType.NETWORK_TIMEOUT,
            `Government feed connection timed out after ${timeoutMs}ms for ${sourceConfig.feedUrl}`
          );
        }
        if (err instanceof ConnectorError) throw err;
        throw new ConnectorError(ConnectorFailureType.NETWORK_TIMEOUT, `Network error: ${err.message}`);
      }
    });

    const responseTimeMs = Date.now() - startTime;

    let parsedObj: any;
    try {
      parsedObj = this.xmlParser.parse(xmlContent);
    } catch (err: any) {
      throw new ConnectorError(
        ConnectorFailureType.PARSE_ERROR,
        `Failed to parse Government XML feed: ${err.message}`,
        undefined,
        false
      );
    }

    let rawItems: any[] = [];
    if (parsedObj?.rss?.channel?.item) {
      rawItems = Array.isArray(parsedObj.rss.channel.item)
        ? parsedObj.rss.channel.item
        : [parsedObj.rss.channel.item];
    } else if (parsedObj?.feed?.entry) {
      rawItems = Array.isArray(parsedObj.feed.entry) ? parsedObj.feed.entry : [parsedObj.feed.entry];
    } else if (parsedObj?.channel?.item) {
      rawItems = Array.isArray(parsedObj.channel.item) ? parsedObj.channel.item : [parsedObj.channel.item];
    }

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

      if (!headline || !canonicalUrl) continue;

      const excerpt = cleanText(raw.description || raw.summary || raw['content:encoded'], 800);
      const author = typeof raw['dc:creator'] === 'string' ? raw['dc:creator'] : 'Government of India';
      const pubDate = parsePubDate(raw.pubDate || raw.published || raw.updated || raw['dc:date']);

      const candidate = {
        sourceId: sourceConfig.id,
        externalId: typeof raw.guid === 'string' ? raw.guid : typeof raw.id === 'string' ? raw.id : undefined,
        canonicalUrl,
        headline,
        excerpt,
        author,
        publishedAt: pubDate,
        contentType: 'GOVERNMENT_ANNOUNCEMENT' as ContentType,
        category: sourceConfig.category.length ? sourceConfig.category : ['Government', 'National'],
        language: sourceConfig.language || 'en',
        imageUrl: raw.enclosure?.['@_url'] || null,
        rightsStatus,
        retentionDays: 365, // Official gazettes retained 1 year minimum
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

  public async healthCheck(sourceConfig: SourceAdapterConfig): Promise<ConnectorHealth> {
    if (!sourceConfig.feedUrl) {
      return { isHealthy: false, consecutiveFailures: 1, lastErrorMessage: 'feedUrl missing' };
    }
    try {
      validateUrlForSsrf(sourceConfig.feedUrl);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(sourceConfig.feedUrl, {
        method: 'HEAD',
        headers: { 'User-Agent': 'ParmanuGovBot/1.0-HealthCheck' },
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
