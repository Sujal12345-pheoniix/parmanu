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
 * Regex patterns identifying creator, brand, or commercial partnership signals
 */
const COLLABORATION_PATTERNS = [
  /partners?\s+with/i,
  /signs?\s+(?:as\s+)?brand\s+ambassador/i,
  /brand\s+ambassador/i,
  /collaborat(?:es?|ion)\s+with/i,
  /endors(?:es?|ement)/i,
  /unveils?\s+campaign/i,
  /joins?\s+hands?\s+with/i,
  /ties?\s+up\s+with/i,
  /sponsors?(?:ship)?/i,
  /roster\s+of\s+creators/i,
  /creator\s+partnership/i,
  /influencer\s+campaign/i,
];

export class PrWireConnector implements SourceAdapter {
  public readonly id = 'pr-wire-connector';
  public readonly name = 'PR Wire & Corporate Announcement Connector';
  public readonly sourceType = 'MANUAL_PR' as const;
  public readonly supportedContentTypes: ContentType[] = ['PRESS_RELEASE'];
  public readonly attributionRequirement =
    'Mandatory wire service or agency attribution with direct link to original press release.';

  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      trimValues: true,
    });
  }

  /**
   * Evaluates text for brand/creator collaboration markers
   */
  public detectCollaborationSignal(text: string): boolean {
    return COLLABORATION_PATTERNS.some((pattern) => pattern.test(text));
  }

  public async fetch(sourceConfig: SourceAdapterConfig): Promise<ConnectorFetchResult> {
    if (!sourceConfig.feedUrl) {
      throw new ConnectorError(
        ConnectorFailureType.VALIDATION_ERROR,
        'feedUrl is required for PR Wire connector',
        undefined,
        false
      );
    }

    validateUrlForSsrf(sourceConfig.feedUrl);

    const startTime = Date.now();

    const xmlContent = await withRetry(async () => {
      const controller = new AbortController();
      const timeoutMs = sourceConfig.timeoutMs || 12000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(sourceConfig.feedUrl!, {
          method: 'GET',
          headers: {
            'User-Agent': 'ParmanuPRBot/1.0 (+https://parmanu.dev; corporate news & partnerships indexer)',
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
            `PR feed request failed: HTTP ${response.status} ${response.statusText}`,
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
            `PR feed connection timed out after ${timeoutMs}ms for ${sourceConfig.feedUrl}`
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
        `Failed to parse PR XML: ${err.message}`,
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
    let collaborationSignalsFound = 0;

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

      const rawExcerpt = raw.description || raw.summary || raw['content:encoded'];
      const excerpt = cleanText(rawExcerpt, 800);
      const author = typeof raw['dc:creator'] === 'string' ? raw['dc:creator'] : 'PR Wire Service';
      const pubDate = parsePubDate(raw.pubDate || raw.published || raw.updated || raw['dc:date']);

      const fullTextToInspect = `${headline} ${excerpt || ''}`;
      const isCollaboration = this.detectCollaborationSignal(fullTextToInspect);
      if (isCollaboration) {
        collaborationSignalsFound++;
      }

      const categories = [...sourceConfig.category];
      if (isCollaboration && !categories.includes('Collaboration')) {
        categories.push('Collaboration');
      }
      if (!categories.includes('PressRelease')) {
        categories.push('PressRelease');
      }

      const candidate = {
        sourceId: sourceConfig.id,
        externalId: typeof raw.guid === 'string' ? raw.guid : typeof raw.id === 'string' ? raw.id : undefined,
        canonicalUrl,
        headline,
        excerpt,
        author,
        publishedAt: pubDate,
        contentType: 'PRESS_RELEASE' as ContentType,
        category: categories,
        language: sourceConfig.language || 'en',
        imageUrl: raw.enclosure?.['@_url'] || null,
        rightsStatus: 'METADATA_ONLY' as RightsStatus,
        retentionDays: 90,
        provenanceState: 'SINGLE_SOURCE' as ProvenanceState,
      };

      const parsed = CanonicalSourceItemSchema.safeParse(candidate);
      if (parsed.success) {
        canonicalItems.push(parsed.data);
      }
    }

    return {
      items: canonicalItems,
      rawCount: rawItems.length,
      newCount: canonicalItems.length,
      responseTimeMs,
      metadata: {
        collaborationSignalsFound,
      },
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
        headers: { 'User-Agent': 'ParmanuPRBot/1.0-HealthCheck' },
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
