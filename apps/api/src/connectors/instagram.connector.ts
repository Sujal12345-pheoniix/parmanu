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
import { decrypt } from '../security/encryption';

export class InstagramApiConnector implements SourceAdapter {
  public readonly id = 'instagram-official-connector';
  public readonly name = 'Meta Instagram Graph API (Voluntary Creator OAuth)';
  public readonly sourceType = 'INSTAGRAM_API' as const;
  public readonly supportedContentTypes: ContentType[] = ['INSTAGRAM_POST', 'CREATOR_ANNOUNCEMENT'];
  public readonly attributionRequirement =
    'Direct creator attribution with Instagram permalink. Content ingested strictly under voluntary creator authorization.';

  private resolveAccessToken(config: SourceAdapterConfig): string | null {
    if (config.apiConfig?.accessTokenEncrypted) {
      try {
        return decrypt(config.apiConfig.accessTokenEncrypted);
      } catch {
        // Fallback
      }
    }
    if (config.apiConfig?.accessToken) {
      return config.apiConfig.accessToken;
    }
    if (process.env.INSTAGRAM_ACCESS_TOKEN) {
      return process.env.INSTAGRAM_ACCESS_TOKEN;
    }
    return null;
  }

  public async fetch(sourceConfig: SourceAdapterConfig): Promise<ConnectorFetchResult> {
    const accessToken = this.resolveAccessToken(sourceConfig);
    if (!accessToken) {
      throw new ConnectorError(
        ConnectorFailureType.AUTH_ERROR,
        'Instagram voluntary creator access token is missing. Configure accessToken or accessTokenEncrypted in apiConfig. Unauthorized scraping is prohibited.',
        401,
        false
      );
    }

    const baseUrl = sourceConfig.feedUrl || 'https://graph.instagram.com/me/media';
    validateUrlForSsrf(baseUrl);

    const url = new URL(baseUrl);
    url.searchParams.set(
      'fields',
      'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username'
    );
    url.searchParams.set('limit', String(Math.min(sourceConfig.maxItemsPerPoll || 25, 50)));
    url.searchParams.set('access_token', accessToken);

    const startTime = Date.now();

    const jsonText = await withRetry(async () => {
      const controller = new AbortController();
      const timeoutMs = sourceConfig.timeoutMs || 12000;
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'User-Agent': 'ParmanuCreatorSync/1.0 (+https://parmanu.dev; voluntary creator portfolio indexing)',
            Accept: 'application/json',
          },
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const retryAfter = response.headers.get('Retry-After');
          const retryAfterSec = retryAfter ? parseInt(retryAfter, 10) : undefined;

          let errBody: any;
          try {
            errBody = await response.json();
          } catch {
            // ignore
          }

          const fbError = errBody?.error;
          const fbMessage = fbError?.message || response.statusText;

          // OAuth token expired / revoked
          if (response.status === 400 || response.status === 401 || fbError?.code === 190) {
            throw new ConnectorError(
              ConnectorFailureType.AUTH_ERROR,
              `Instagram creator token expired or invalid: ${fbMessage}`,
              response.status,
              false
            );
          }

          if (response.status === 429 || fbError?.code === 4 || fbError?.code === 17) {
            throw new ConnectorError(
              ConnectorFailureType.RATE_LIMITED,
              `Instagram API rate limit reached: ${fbMessage}`,
              429,
              true,
              retryAfterSec || 60
            );
          }

          throw new ConnectorError(
            ConnectorFailureType.HTTP_ERROR,
            `Instagram Graph API returned HTTP ${response.status}: ${fbMessage}`,
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
            `Instagram API request timed out after ${timeoutMs}ms`
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
        `Instagram API returned invalid JSON: ${err.message}`,
        undefined,
        false
      );
    }

    if (!payload || !Array.isArray(payload.data)) {
      if (payload?.error) {
        throw new ConnectorError(
          ConnectorFailureType.VALIDATION_ERROR,
          `Instagram error: ${payload.error.message}`,
          undefined,
          false
        );
      }
      throw new ConnectorError(
        ConnectorFailureType.VALIDATION_ERROR,
        'Instagram API response did not contain a data array',
        undefined,
        false
      );
    }

    const rawItems: any[] = payload.data;
    const canonicalItems: CanonicalSourceItem[] = [];

    for (const post of rawItems) {
      const canonicalUrl = post.permalink?.trim();
      if (!canonicalUrl) continue;

      const rawCaption = post.caption || '';
      const cleanedCaption = cleanText(rawCaption, 800);
      const username = post.username || sourceConfig.name || 'creator';

      // Generate concise headline from caption or handle
      let headline = '';
      if (cleanedCaption) {
        const firstLine = cleanedCaption.split('\n')[0].trim();
        headline = firstLine.length > 120 ? firstLine.slice(0, 117) + '...' : firstLine;
      }
      if (!headline || headline.length < 5) {
        headline = `Instagram post by @${username}`;
      }

      // Check for collaboration markers in caption (#collab, #ad, paid partnership, with ...)
      const isCollaboration =
        /#(?:ad|collab|sponsored|partner)\b/i.test(rawCaption) ||
        /paid\s+partnership/i.test(rawCaption) ||
        /in\s+collaboration\s+with/i.test(rawCaption);

      const categories = [...sourceConfig.category];
      if (isCollaboration && !categories.includes('Collaboration')) {
        categories.push('Collaboration');
      }
      if (!categories.includes('Creator')) {
        categories.push('Creator');
      }

      const contentType: ContentType = isCollaboration ? 'CREATOR_ANNOUNCEMENT' : 'INSTAGRAM_POST';
      const pubDate = parsePubDate(post.timestamp);

      const candidate = {
        sourceId: sourceConfig.id,
        externalId: post.id,
        canonicalUrl,
        headline,
        excerpt: cleanedCaption,
        author: `@${username}`,
        publishedAt: pubDate,
        contentType,
        category: categories,
        language: sourceConfig.language || 'en',
        imageUrl: post.media_url || post.thumbnail_url || null,
        rightsStatus: 'METADATA_ONLY' as RightsStatus,
        retentionDays: 90,
        provenanceState: 'OFFICIAL_CONFIRMED' as ProvenanceState,
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
        paging: payload.paging,
      },
    };
  }

  public async healthCheck(sourceConfig: SourceAdapterConfig): Promise<ConnectorHealth> {
    const accessToken = this.resolveAccessToken(sourceConfig);
    if (!accessToken) {
      return {
        isHealthy: false,
        consecutiveFailures: 1,
        lastErrorMessage: 'Instagram access token not configured',
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`, {
        method: 'GET',
        headers: { 'User-Agent': 'ParmanuCreatorSync/1.0-HealthCheck' },
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
