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

export class GNewsApiConnector implements SourceAdapter {
  public readonly id = 'gnews-api-connector';
  public readonly name = 'GNews Commercial News API';
  public readonly sourceType = 'API_GNEWS' as const;
  public readonly supportedContentTypes: ContentType[] = ['NEWS_ARTICLE'];
  public readonly attributionRequirement =
    'Mandatory original publisher attribution as provided by GNews API with canonical link.';

  private resolveApiKey(config: SourceAdapterConfig): string | null {
    if (config.apiConfig?.apiKeyEncrypted) {
      try {
        return decrypt(config.apiConfig.apiKeyEncrypted);
      } catch {
        // Fallback
      }
    }
    if (config.apiConfig?.apiKey) {
      return config.apiConfig.apiKey;
    }
    const env = getEnv();
    return env.GNEWS_API_KEY || null;
  }

  public async fetch(sourceConfig: SourceAdapterConfig): Promise<ConnectorFetchResult> {
    const apiKey = this.resolveApiKey(sourceConfig);
    if (!apiKey) {
      throw new ConnectorError(
        ConnectorFailureType.AUTH_ERROR,
        'GNews API key is missing. Configure apiKey in apiConfig or set GNEWS_API_KEY env var.',
        401,
        false
      );
    }

    const baseUrl = sourceConfig.feedUrl || 'https://gnews.io/api/v4/top-headlines';
    validateUrlForSsrf(baseUrl);

    const url = new URL(baseUrl);
    url.searchParams.set('apikey', apiKey);
    url.searchParams.set('lang', sourceConfig.language || 'en');
    url.searchParams.set('country', (sourceConfig.country || 'in').toLowerCase());
    url.searchParams.set('max', String(Math.min(sourceConfig.maxItemsPerPoll || 50, 100)));

    if (sourceConfig.category && sourceConfig.category.length > 0) {
      const cat = sourceConfig.category[0].toLowerCase();
      const validGNewsCategories = [
        'general',
        'world',
        'nation',
        'business',
        'technology',
        'entertainment',
        'sports',
        'science',
        'health',
      ];
      if (validGNewsCategories.includes(cat)) {
        url.searchParams.set('category', cat);
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
            'User-Agent': 'ParmanuGNewsBot/1.0 (+https://parmanu.dev)',
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const retryAfter = response.headers.get('Retry-After');
          const retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : undefined;

          if (response.status === 401) {
            throw new ConnectorError(
              ConnectorFailureType.AUTH_ERROR,
              'Invalid or unauthorized GNews API key',
              401,
              false
            );
          }
          if (response.status === 429 || response.status === 403) {
            throw new ConnectorError(
              ConnectorFailureType.RATE_LIMITED,
              `GNews rate limit or quota exceeded: HTTP ${response.status}`,
              response.status,
              true,
              retryAfterSec || 60
            );
          }
          throw new ConnectorError(
            ConnectorFailureType.HTTP_ERROR,
            `GNews API returned HTTP ${response.status} ${response.statusText}`,
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
            `GNews API connection timed out after ${timeoutMs}ms`
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
        `GNews API returned malformed JSON: ${err.message}`,
        undefined,
        false
      );
    }

    if (!payload || !Array.isArray(payload.articles)) {
      if (payload?.errors) {
        throw new ConnectorError(
          ConnectorFailureType.VALIDATION_ERROR,
          `GNews API reported error: ${JSON.stringify(payload.errors)}`,
          undefined,
          false
        );
      }
      throw new ConnectorError(
        ConnectorFailureType.VALIDATION_ERROR,
        'GNews API response did not contain an articles array',
        undefined,
        false
      );
    }

    const rawArticles: any[] = payload.articles;
    const canonicalItems: CanonicalSourceItem[] = [];

    for (const article of rawArticles) {
      const headline = cleanText(article.title, 400);
      const canonicalUrl = article.url?.trim();

      if (!headline || !canonicalUrl) continue;

      const rawExcerpt = article.description || article.content;
      const excerpt = cleanText(rawExcerpt, 600);
      const author = article.source?.name ? `${article.source.name}` : undefined;
      const pubDate = parsePubDate(article.publishedAt);

      const candidate = {
        sourceId: sourceConfig.id,
        externalId: article.url,
        canonicalUrl,
        headline,
        excerpt,
        author,
        publishedAt: pubDate,
        contentType: 'NEWS_ARTICLE' as ContentType,
        category: sourceConfig.category.length ? sourceConfig.category : ['News'],
        language: sourceConfig.language || 'en',
        imageUrl: article.image || null,
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
      rawCount: rawArticles.length,
      newCount: canonicalItems.length,
      responseTimeMs,
      metadata: {
        totalArticles: payload.totalArticles,
      },
    };
  }

  public async healthCheck(sourceConfig: SourceAdapterConfig): Promise<ConnectorHealth> {
    const apiKey = this.resolveApiKey(sourceConfig);
    if (!apiKey) {
      return {
        isHealthy: false,
        consecutiveFailures: 1,
        lastErrorMessage: 'GNews API key not configured',
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`https://gnews.io/api/v4/top-headlines?category=general&lang=en&max=1&apikey=${encodeURIComponent(apiKey)}`, {
        method: 'GET',
        headers: { 'User-Agent': 'ParmanuGNewsBot/1.0-HealthCheck' },
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
