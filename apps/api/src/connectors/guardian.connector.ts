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
import { getEnv } from '../config/env';
import { decrypt } from '../security/encryption';

export class GuardianApiConnector implements SourceAdapter {
  public readonly id = 'guardian-api-connector';
  public readonly name = 'The Guardian Open Platform API';
  public readonly sourceType = 'API_GUARDIAN' as const;
  public readonly supportedContentTypes: ContentType[] = ['NEWS_ARTICLE'];
  public readonly attributionRequirement =
    'Content supplied by The Guardian Open Platform. Mandatory attribution with canonical link.';

  private resolveApiKey(config: SourceAdapterConfig): string | null {
    if (config.apiConfig?.apiKeyEncrypted) {
      try {
        return decrypt(config.apiConfig.apiKeyEncrypted);
      } catch {
        // Continue to fallback
      }
    }
    if (config.apiConfig?.apiKey) {
      return config.apiConfig.apiKey;
    }
    const env = getEnv();
    return env.GUARDIAN_API_KEY || null;
  }

  public async fetch(sourceConfig: SourceAdapterConfig): Promise<ConnectorFetchResult> {
    const apiKey = this.resolveApiKey(sourceConfig);
    if (!apiKey) {
      throw new ConnectorError(
        ConnectorFailureType.AUTH_ERROR,
        'Guardian API key is missing. Configure apiKey in apiConfig or set GUARDIAN_API_KEY env var.',
        401,
        false
      );
    }

    const baseUrl = sourceConfig.feedUrl || 'https://content.guardianapis.com/search';
    validateUrlForSsrf(baseUrl);

    const url = new URL(baseUrl);
    url.searchParams.set('api-key', apiKey);
    url.searchParams.set('show-fields', 'headline,trailText,byline,thumbnail,shortUrl');
    url.searchParams.set('page-size', String(sourceConfig.maxItemsPerPoll || 50));
    url.searchParams.set('order-by', 'newest');

    if (sourceConfig.category && sourceConfig.category.length > 0) {
      const section = sourceConfig.category[0].toLowerCase();
      if (['world', 'business', 'technology', 'sport', 'culture'].includes(section)) {
        url.searchParams.set('section', section);
      }
    }

    const startTime = Date.now();

    const jsonText = await withRetry(async () => {
      const controller = new AbortController();
      const timeoutMs = sourceConfig.timeoutMs || 12000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'User-Agent': 'ParmanuGuardianBot/1.0 (+https://parmanu.dev)',
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const retryAfter = response.headers.get('Retry-After');
          const retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : undefined;

          if (response.status === 401 || response.status === 403) {
            throw new ConnectorError(
              ConnectorFailureType.AUTH_ERROR,
              `Guardian API authorization failed: HTTP ${response.status}`,
              response.status,
              false
            );
          }
          if (response.status === 429) {
            throw new ConnectorError(
              ConnectorFailureType.RATE_LIMITED,
              'Guardian API rate limit reached or quota exhausted',
              429,
              true,
              retryAfterSec || 30
            );
          }
          throw new ConnectorError(
            ConnectorFailureType.HTTP_ERROR,
            `Guardian API returned HTTP ${response.status} ${response.statusText}`,
            response.status,
            response.status >= 500
          );
        }

        return await response.text();
      } catch (err: any) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
          throw new ConnectorError(
            ConnectorFailureType.NETWORK_TIMEOUT,
            `Guardian API request timed out after ${timeoutMs}ms`
          );
        }
        if (err instanceof ConnectorError) throw err;
        throw new ConnectorError(ConnectorFailureType.NETWORK_TIMEOUT, `Network error: ${err.message}`);
      }
    });

    const responseTimeMs = Date.now() - startTime;

    let payload: any;
    try {
      payload = JSON.parse(jsonText);
    } catch (err: any) {
      throw new ConnectorError(
        ConnectorFailureType.PARSE_ERROR,
        `Guardian API returned invalid JSON: ${err.message}`,
        undefined,
        false
      );
    }

    if (!payload?.response || payload.response.status !== 'ok') {
      throw new ConnectorError(
        ConnectorFailureType.VALIDATION_ERROR,
        `Guardian API response status not ok: ${payload?.response?.message || 'unknown error'}`,
        undefined,
        false
      );
    }

    const rawResults = Array.isArray(payload.response.results) ? payload.response.results : [];
    const canonicalItems: CanonicalSourceItem[] = [];

    for (const item of rawResults) {
      const headline = cleanText(item.fields?.headline || item.webTitle, 400);
      const canonicalUrl = item.webUrl || item.fields?.shortUrl;

      if (!headline || !canonicalUrl) continue;

      const rawExcerpt = item.fields?.trailText;
      const excerpt = cleanText(rawExcerpt, 600);
      const author = item.fields?.byline || 'The Guardian';
      const pubDate = parsePubDate(item.webPublicationDate);

      const candidate = {
        sourceId: sourceConfig.id,
        externalId: item.id || undefined,
        canonicalUrl,
        headline,
        excerpt,
        author,
        publishedAt: pubDate,
        contentType: 'NEWS_ARTICLE' as ContentType,
        category: sourceConfig.category.length ? sourceConfig.category : [item.sectionName || 'World'],
        language: sourceConfig.language || 'en',
        imageUrl: item.fields?.thumbnail || null,
        rightsStatus: 'LICENSED_EXCERPT' as RightsStatus,
        retentionDays: 90,
        provenanceState: 'CORROBORATED' as ProvenanceState,
      };

      const parsed = CanonicalSourceItemSchema.safeParse(candidate);
      if (parsed.success) {
        canonicalItems.push(parsed.data);
      }
    }

    return {
      items: canonicalItems,
      rawCount: rawResults.length,
      newCount: canonicalItems.length,
      responseTimeMs,
      metadata: {
        totalResults: payload.response.total,
        currentPage: payload.response.currentPage,
        pages: payload.response.pages,
      },
    };
  }

  public async healthCheck(sourceConfig: SourceAdapterConfig): Promise<ConnectorHealth> {
    const apiKey = this.resolveApiKey(sourceConfig);
    if (!apiKey) {
      return {
        isHealthy: false,
        consecutiveFailures: 1,
        lastErrorMessage: 'Guardian API key not configured',
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`https://content.guardianapis.com/sections?api-key=${encodeURIComponent(apiKey)}`, {
        method: 'GET',
        headers: { 'User-Agent': 'ParmanuGuardianBot/1.0-HealthCheck' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      return {
        isHealthy: res.ok,
        lastSuccessAt: res.ok ? new Date() : undefined,
        lastFailureAt: !res.ok ? new Date() : undefined,
        consecutiveFailures: res.ok ? 0 : 1,
        lastErrorMessage: res.ok ? undefined : `HTTP ${res.status} ${res.statusText}`,
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
