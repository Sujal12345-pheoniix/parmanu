import * as crypto from 'crypto';
import { CanonicalSourceItem, SourceType } from '@parmanu/types';

export interface ConnectorFetchResult {
  items: CanonicalSourceItem[];
  rawCount: number;
  newCount: number;
  responseTimeMs: number;
  metadata?: Record<string, any>;
}

export interface ConnectorHealth {
  isHealthy: boolean;
  lastSuccessAt?: Date;
  lastFailureAt?: Date;
  consecutiveFailures: number;
  lastErrorMessage?: string;
}

export enum ConnectorFailureType {
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  HTTP_ERROR = 'HTTP_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  PARSE_ERROR = 'PARSE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SSRF_BLOCKED = 'SSRF_BLOCKED',
  AUTH_ERROR = 'AUTH_ERROR',
  UNKNOWN = 'UNKNOWN',
}

export class ConnectorError extends Error {
  constructor(
    public readonly failureType: ConnectorFailureType,
    message: string,
    public readonly httpStatus?: number,
    public readonly retryable: boolean = true
  ) {
    super(message);
    this.name = 'ConnectorError';
  }
}

/**
 * SSRF Protection Validator
 * Verifies that a target URL is public and does not point to internal networks or localhost.
 */
export function validateUrlForSsrf(targetUrl: string): void {
  let parsed: URL;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw new ConnectorError(ConnectorFailureType.SSRF_BLOCKED, 'Invalid URL format', undefined, false);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ConnectorError(ConnectorFailureType.SSRF_BLOCKED, `Blocked unsupported protocol: ${parsed.protocol}`, undefined, false);
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and internal names
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    throw new ConnectorError(ConnectorFailureType.SSRF_BLOCKED, `Blocked private network host: ${hostname}`, undefined, false);
  }

  // Block private IPv4 ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x)
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipMatch = hostname.match(ipv4Regex);
  if (ipMatch) {
    const octet1 = parseInt(ipMatch[1], 10);
    const octet2 = parseInt(ipMatch[2], 10);

    if (
      octet1 === 10 ||
      octet1 === 127 ||
      (octet1 === 172 && octet2 >= 16 && octet2 <= 31) ||
      (octet1 === 192 && octet2 === 168) ||
      (octet1 === 169 && octet2 === 254) ||
      octet1 === 0
    ) {
      throw new ConnectorError(ConnectorFailureType.SSRF_BLOCKED, `Blocked private IP address: ${hostname}`, undefined, false);
    }
  }
}

/**
 * Calculates SHA-256 dedupe hash from normalized headline and source ID
 */
export function calculateDedupeHash(sourceId: string, headline: string): string {
  const normalized = headline.toLowerCase().replace(/[^a-z0-9]/g, '');
  return crypto.createHash('sha256').update(`${sourceId}:${normalized}`).digest('hex');
}

/**
 * Generic retry wrapper with bounded exponential backoff and jitter
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    factor?: number;
  } = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 8000;
  const factor = options.factor ?? 2;

  let attempt = 0;
  let delay = initialDelayMs;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      return await fn();
    } catch (err: any) {
      const isRetryable = err instanceof ConnectorError ? err.retryable : true;
      if (!isRetryable || attempt >= maxAttempts) {
        throw err;
      }

      // Add jitter (±20%)
      const jitter = delay * (0.8 + Math.random() * 0.4);
      await new Promise((res) => setTimeout(res, Math.min(jitter, maxDelayMs)));
      delay *= factor;
    }
  }

  throw new Error('Unreachable retry loop exit');
}

/**
 * Abstract Base Source Connector Interface
 */
export interface SourceConnector {
  readonly id: string;
  readonly name: string;
  readonly sourceType: SourceType;
  fetch(sourceConfig: {
    id: string;
    feedUrl?: string | null;
    apiProvider?: string | null;
    apiConfig?: any;
    category: string[];
    language: string;
  }): Promise<ConnectorFetchResult>;
}
