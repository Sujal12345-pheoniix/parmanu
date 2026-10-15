import { URL } from 'url';

/**
 * List of known tracking parameters that can be safely stripped without altering destination content
 */
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'dclid',
  'msclkid',
  'igshid',
  'ref',
  'ref_src',
  'source',
  'ocid',
  '_hsenc',
  '_hsmi',
  'mc_cid',
  'mc_eid',
]);

export interface NormalizedContentResult {
  canonicalUrl: string;
  originalUrl: string;
  headline: string;
  originalHeadline: string;
  excerpt?: string;
  author?: string;
  publishedAt: Date;
  isSuspicious: boolean;
  suspicionReason?: string;
}

export class NormalizationService {
  /**
   * Safely canonicalizes a URL by stripping marketing tracking parameters,
   * standardizing protocol/host casing, removing fragments, and sorting query parameters.
   */
  public canonicalizeUrl(rawUrl: string): { canonicalUrl: string; originalUrl: string } {
    const trimmed = rawUrl.trim();
    let parsed: URL;

    try {
      parsed = new URL(trimmed);
    } catch {
      return { canonicalUrl: trimmed, originalUrl: trimmed };
    }

    // Protocol and hostname lowercasing
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase();

    // Strip hash/fragment
    parsed.hash = '';

    // Strip tracking query parameters
    const searchParams = new URLSearchParams(parsed.search);
    const keysToDelete: string[] = [];

    searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (TRACKING_PARAMS.has(lower) || lower.startsWith('utm_')) {
        keysToDelete.push(key);
      }
    });

    for (const key of keysToDelete) {
      searchParams.delete(key);
    }

    // Sort remaining parameters deterministically
    searchParams.sort();
    parsed.search = searchParams.toString();

    // Standardize trailing slashes on paths (remove trailing slash unless it's the root)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return {
      canonicalUrl: parsed.toString(),
      originalUrl: trimmed,
    };
  }

  /**
   * Cleans and normalizes text (NFKD Unicode normalization, entity unescaping, multi-space collapse)
   */
  public normalizeText(text?: string | null): string {
    if (!text) return '';
    return text
      .normalize('NFKD')
      .replace(/<[^>]+>/g, ' ') // Strip HTML
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Evaluates record quality and detects malformed, empty, or prompt-injection attempts
   */
  public inspectQuality(headline: string, excerpt?: string): { isSuspicious: boolean; reason?: string } {
    if (!headline || headline.trim().length < 5) {
      return { isSuspicious: true, reason: 'Headline is too short or empty' };
    }

    // Check for suspicious script or execution tags
    const combined = `${headline} ${excerpt || ''}`;
    if (/<script|javascript:|onload=|onerror=/i.test(combined)) {
      return { isSuspicious: true, reason: 'Contains embedded script or HTML event handler' };
    }

    // Prompt injection heuristic: explicit instruction override phrases
    const promptInjectionPatterns = [
      /ignore\s+(?:all\s+)?previous\s+instructions/i,
      /you\s+are\s+now\s+in\s+developer\s+mode/i,
      /system\s*:\s*you\s+must/i,
      /override\s+system\s+prompt/i,
    ];

    if (promptInjectionPatterns.some((pattern) => pattern.test(combined))) {
      return { isSuspicious: true, reason: 'Detected potential prompt injection payload' };
    }

    return { isSuspicious: false };
  }

  /**
   * Full normalization pipeline for an incoming source record
   */
  public normalizeItem(raw: {
    url: string;
    headline: string;
    excerpt?: string;
    author?: string;
    publishedAt?: Date | string | null;
  }): NormalizedContentResult {
    const { canonicalUrl, originalUrl } = this.canonicalizeUrl(raw.url);
    const originalHeadline = raw.headline;
    const headline = this.normalizeText(raw.headline);
    const excerpt = raw.excerpt ? this.normalizeText(raw.excerpt) : undefined;
    const author = raw.author ? this.normalizeText(raw.author) : undefined;

    let publishedAt = new Date();
    if (raw.publishedAt) {
      const parsed = new Date(raw.publishedAt);
      if (!isNaN(parsed.getTime())) {
        publishedAt = parsed;
      }
    }

    const { isSuspicious, reason } = this.inspectQuality(headline, excerpt);

    return {
      canonicalUrl,
      originalUrl,
      headline,
      originalHeadline,
      excerpt,
      author,
      publishedAt,
      isSuspicious,
      suspicionReason: reason,
    };
  }
}

export const defaultNormalizationService = new NormalizationService();
