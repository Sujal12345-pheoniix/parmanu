process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://ci:ci@localhost:5432/parmanu_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'parmanu_ci_test_secret_min_length_32';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

import {
  CanonicalSourceItemSchema,
  SourceAdapterConfig,
  SourceAdapterConfigSchema,
  UpdateNewsSourceSchema,
} from '@parmanu/types';
import {
  calculateDedupeHash,
  validateUrlForSsrf,
  withRetry,
  ConnectorError,
  ConnectorFailureType,
  RssSourceConnector,
  GovernmentFeedConnector,
  GuardianApiConnector,
  GNewsApiConnector,
  PrWireConnector,
  InstagramApiConnector,
  cleanText,
  parsePubDate,
} from '../connectors';
import { AdapterRegistry } from '../ingestion/adapter.registry';
import { IngestionService, sanitizeErrorMessage } from '../ingestion/ingestion.service';
import { maskSecret } from '../config/env';
import { signToken } from '../security/auth';
import { requireRole } from '../security/auth';

// Load deterministic test fixtures
const fixturesDir = fs.existsSync(path.join(__dirname, 'fixtures'))
  ? path.join(__dirname, 'fixtures')
  : path.join(__dirname, '../../src/tests/fixtures');
const rssFixture = fs.readFileSync(path.join(fixturesDir, 'rss-fixture.xml'), 'utf-8');
const pibGovFixture = fs.readFileSync(path.join(fixturesDir, 'pib-gov-fixture.xml'), 'utf-8');
const guardianFixture = fs.readFileSync(path.join(fixturesDir, 'guardian-fixture.json'), 'utf-8');
const gnewsFixture = fs.readFileSync(path.join(fixturesDir, 'gnews-fixture.json'), 'utf-8');
const prWireFixture = fs.readFileSync(path.join(fixturesDir, 'pr-wire-fixture.xml'), 'utf-8');
const instagramFixture = fs.readFileSync(path.join(fixturesDir, 'instagram-fixture.json'), 'utf-8');

test('Phase 2.1: RSS Connector correctly parses fixture into canonical items', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(rssFixture, {
      status: 200,
      headers: { 'Content-Type': 'application/rss+xml' },
    });

  try {
    const connector = new RssSourceConnector();
    const result = await connector.fetch({
      id: 'source-rss-01',
      feedUrl: 'https://thehindu.com/news/national/feeder/default.rss',
      category: ['National'],
      language: 'en',
    });

    assert.equal(result.items.length, 1);
    assert.equal(result.rawCount, 1);
    const item = result.items[0];
    assert.equal(item.headline, 'ISRO launches advanced meteorological satellite successfully');
    assert.equal(item.contentType, 'NEWS_ARTICLE');
    assert.equal(item.provenanceState, 'SINGLE_SOURCE');
    assert.equal(item.rightsStatus, 'METADATA_ONLY');
  } finally {
    global.fetch = originalFetch;
  }
});

test('Phase 2.1: Government Feed Connector validates official domains and sets high trust', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(pibGovFixture, {
      status: 200,
      headers: { 'Content-Type': 'application/rss+xml' },
    });

  try {
    const connector = new GovernmentFeedConnector();

    // Verify official domain detection
    assert.equal(connector.isOfficialDomain('https://pib.gov.in/rss/all.xml'), true);
    assert.equal(connector.isOfficialDomain('https://rbi.org.in/press/releases.xml'), true);
    assert.equal(connector.isOfficialDomain('https://malicious-fake-pib.com/feed.xml'), false);

    const config: SourceAdapterConfig = {
      id: 'gov-pib-01',
      name: 'PIB Releases',
      type: 'GOVERNMENT_FEED',
      feedUrl: 'https://pib.gov.in/PressReleasePage.aspx',
      category: ['National', 'Government'],
      language: 'en',
      country: 'IN',
      attributionName: 'Press Information Bureau',
      attributionUrl: 'https://pib.gov.in',
      isActive: true,
      pollingIntervalMinutes: 15,
      maxItemsPerPoll: 50,
      timeoutMs: 12000,
      permissionClassification: 'OFFICIAL_GOVERNMENT',
    };

    const result = await connector.fetch(config);
    assert.equal(result.items.length, 1);
    const item = result.items[0];
    assert.match(item.headline, /Semiconductor Mission Phase 2/);
    assert.equal(item.contentType, 'GOVERNMENT_ANNOUNCEMENT');
    assert.equal(item.provenanceState, 'OFFICIAL_CONFIRMED');
    assert.equal(item.rightsStatus, 'PUBLIC_DOMAIN');
    assert.equal(item.retentionDays, 365);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Phase 2.1: Guardian API Connector normalizes licensed excerpts with attribution', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(guardianFixture, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  try {
    const connector = new GuardianApiConnector();
    const config: SourceAdapterConfig = {
      id: 'guardian-world-01',
      name: 'The Guardian World News',
      type: 'API_GUARDIAN',
      feedUrl: 'https://content.guardianapis.com/search',
      apiConfig: { apiKey: 'test-guardian-key' },
      category: ['World'],
      language: 'en',
      country: 'GB',
      attributionName: 'The Guardian',
      attributionUrl: 'https://www.theguardian.com',
      isActive: true,
      pollingIntervalMinutes: 30,
      maxItemsPerPoll: 10,
      timeoutMs: 10000,
      permissionClassification: 'LICENSED_API',
    };

    const result = await connector.fetch(config);
    assert.equal(result.items.length, 1);
    const item = result.items[0];
    assert.match(item.headline, /India expands solar and offshore wind/);
    assert.equal(item.rightsStatus, 'LICENSED_EXCERPT');
    assert.equal(item.provenanceState, 'CORROBORATED');
    assert.equal(item.author, 'Hannah Ellis-Petersen');
    assert.ok(result.metadata?.totalResults >= 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Phase 2.1: GNews API Connector handles commercial news payload', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(gnewsFixture, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  try {
    const connector = new GNewsApiConnector();
    const config: SourceAdapterConfig = {
      id: 'gnews-in-01',
      name: 'GNews India Top Headlines',
      type: 'API_GNEWS',
      feedUrl: 'https://gnews.io/api/v4/top-headlines',
      apiConfig: { apiKey: 'test-gnews-key' },
      category: ['business'],
      language: 'en',
      country: 'IN',
      attributionName: 'GNews',
      attributionUrl: 'https://gnews.io',
      isActive: true,
      pollingIntervalMinutes: 20,
      maxItemsPerPoll: 10,
      timeoutMs: 10000,
      permissionClassification: 'LICENSED_API',
    };

    const result = await connector.fetch(config);
    assert.equal(result.items.length, 1);
    const item = result.items[0];
    assert.match(item.headline, /UPI transactions hit new all-time monthly high/);
    assert.equal(item.author, 'Financial Express');
    assert.equal(item.rightsStatus, 'METADATA_ONLY');
  } finally {
    global.fetch = originalFetch;
  }
});

test('Phase 2.1: PR Wire Connector flags brand/creator collaboration markers', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(prWireFixture, {
      status: 200,
      headers: { 'Content-Type': 'application/rss+xml' },
    });

  try {
    const connector = new PrWireConnector();
    assert.equal(connector.detectCollaborationSignal('Boat Lifestyle partners with creator Prajwal'), true);
    assert.equal(connector.detectCollaborationSignal('Quarterly earnings report for Q3'), false);

    const config: SourceAdapterConfig = {
      id: 'pr-wire-01',
      name: 'PR Newswire India',
      type: 'MANUAL_PR',
      feedUrl: 'https://www.prnewswire.co.in/rss.xml',
      category: ['Business'],
      language: 'en',
      country: 'IN',
      attributionName: 'PR Newswire',
      attributionUrl: 'https://www.prnewswire.co.in',
      isActive: true,
      pollingIntervalMinutes: 60,
      maxItemsPerPoll: 20,
      timeoutMs: 10000,
      permissionClassification: 'PR_WIRE',
    };

    const result = await connector.fetch(config);
    assert.equal(result.items.length, 1);
    const item = result.items[0];
    assert.equal(item.contentType, 'PRESS_RELEASE');
    assert.ok(item.category.includes('Collaboration'));
    assert.ok(item.category.includes('PressRelease'));
    assert.equal(result.metadata?.collaborationSignalsFound, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Phase 2.1: Instagram API Connector ingests voluntary creator posts and detects sponsorships', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(instagramFixture, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  try {
    const connector = new InstagramApiConnector();
    const config: SourceAdapterConfig = {
      id: 'ig-creator-01',
      name: 'TechGuru Raj',
      type: 'INSTAGRAM_API',
      feedUrl: 'https://graph.instagram.com/me/media',
      apiConfig: { accessToken: 'test-voluntary-creator-oauth-token' },
      category: ['Technology'],
      language: 'en',
      country: 'IN',
      attributionName: '@techguru_raj',
      attributionUrl: 'https://instagram.com/techguru_raj',
      isActive: true,
      pollingIntervalMinutes: 60,
      maxItemsPerPoll: 10,
      timeoutMs: 10000,
      permissionClassification: 'CREATOR_VOLUNTARY_OAUTH',
    };

    const result = await connector.fetch(config);
    assert.equal(result.items.length, 1);
    const item = result.items[0];
    assert.equal(item.contentType, 'CREATOR_ANNOUNCEMENT'); // Detected #collab #ad
    assert.ok(item.category.includes('Collaboration'));
    assert.ok(item.category.includes('Creator'));
    assert.equal(item.author, '@techguru_raj');
    assert.equal(item.provenanceState, 'OFFICIAL_CONFIRMED');
    assert.equal(item.rightsStatus, 'METADATA_ONLY');
  } finally {
    global.fetch = originalFetch;
  }
});

test('Phase 2.1: Empty successful provider response returns zero items cleanly', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(
      `<?xml version="1.0"?><rss version="2.0"><channel><title>Empty Feed</title><link>https://example.com</link></channel></rss>`,
      { status: 200, headers: { 'Content-Type': 'application/xml' } }
    );

  try {
    const connector = new RssSourceConnector();
    const result = await connector.fetch({
      id: 'empty-01',
      feedUrl: 'https://example.com/empty.xml',
      category: ['General'],
      language: 'en',
    });
    assert.equal(result.items.length, 0);
    assert.equal(result.rawCount, 0);
    assert.equal(result.newCount, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('Phase 2.1: Connector correctly handles provider timeout with typed error', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => {
    const err = new Error('The operation was aborted');
    err.name = 'AbortError';
    throw err;
  };

  try {
    const connector = new RssSourceConnector();
    await assert.rejects(
      async () => {
        await connector.fetch({
          id: 'timeout-source',
          feedUrl: 'https://slow-provider.example.com/feed.xml',
          category: ['General'],
          language: 'en',
        });
      },
      (err: any) => {
        assert.ok(err instanceof ConnectorError);
        assert.equal(err.failureType, ConnectorFailureType.NETWORK_TIMEOUT);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('Phase 2.1: Rate limiting extracts Retry-After and maps to RATE_LIMITED', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response('Too Many Requests', {
      status: 429,
      headers: { 'Retry-After': '45' },
    });

  try {
    const connector = new GovernmentFeedConnector();
    await assert.rejects(
      async () => {
        await connector.fetch({
          id: 'gov-429',
          name: 'PIB Feed',
          type: 'GOVERNMENT_FEED',
          feedUrl: 'https://pib.gov.in/feed.xml',
          category: ['National'],
          language: 'en',
          country: 'IN',
          attributionName: 'PIB',
          attributionUrl: 'https://pib.gov.in',
          isActive: true,
          pollingIntervalMinutes: 15,
          maxItemsPerPoll: 10,
          timeoutMs: 5000,
          permissionClassification: 'OFFICIAL_GOVERNMENT',
        });
      },
      (err: any) => {
        assert.ok(err instanceof ConnectorError);
        assert.equal(err.failureType, ConnectorFailureType.RATE_LIMITED);
        assert.equal(err.retryAfterSeconds, 45);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('Phase 2.1: Malformed JSON or XML throws PARSE_ERROR', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response('{ invalid json string ...', {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  try {
    const connector = new GuardianApiConnector();
    await assert.rejects(
      async () => {
        await connector.fetch({
          id: 'guardian-broken',
          name: 'Broken',
          type: 'API_GUARDIAN',
          feedUrl: 'https://content.guardianapis.com/search',
          apiConfig: { apiKey: 'key' },
          category: ['World'],
          language: 'en',
          country: 'GB',
          attributionName: 'The Guardian',
          attributionUrl: 'https://theguardian.com',
          isActive: true,
          pollingIntervalMinutes: 15,
          maxItemsPerPoll: 10,
          timeoutMs: 5000,
          permissionClassification: 'LICENSED_API',
        });
      },
      (err: any) => {
        assert.ok(err instanceof ConnectorError);
        assert.equal(err.failureType, ConnectorFailureType.PARSE_ERROR);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('Phase 2.1: Authentication failure (missing / invalid key) throws AUTH_ERROR', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(JSON.stringify({ error: { message: 'Invalid OAuth access token' } }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });

  try {
    const connector = new InstagramApiConnector();
    // Missing token should fail immediately without network call
    await assert.rejects(
      async () => {
        await connector.fetch({
          id: 'ig-no-auth',
          name: 'No Auth',
          type: 'INSTAGRAM_API',
          category: ['Creator'],
          language: 'en',
          country: 'IN',
          attributionName: 'Creator',
          attributionUrl: 'https://instagram.com',
          isActive: true,
          pollingIntervalMinutes: 60,
          maxItemsPerPoll: 10,
          timeoutMs: 5000,
          permissionClassification: 'CREATOR_VOLUNTARY_OAUTH',
        });
      },
      (err: any) => {
        assert.ok(err instanceof ConnectorError);
        assert.equal(err.failureType, ConnectorFailureType.AUTH_ERROR);
        return true;
      }
    );
  } finally {
    global.fetch = originalFetch;
  }
});

test('Phase 2.1: Deduplication hash determinism and Unicode normalization', () => {
  const sourceId = 'src_dedupe_01';
  const headline1 = 'Sensex jumps 800 points: Banking stocks lead rally';
  const headline2 = 'sensex  JUMPS 800  points: banking stocks lead rally ';
  const hash1 = calculateDedupeHash(sourceId, headline1);
  const hash2 = calculateDedupeHash(sourceId, headline2);
  assert.equal(hash1, hash2, 'Hash must be identical regardless of casing or extra whitespace');

  // Unicode Indic text normalization check
  const hindiHeadline = 'इसरो ने प्रक्षेपित किया मौसम उपग्रह';
  const hindiHash1 = calculateDedupeHash(sourceId, hindiHeadline);
  const hindiHash2 = calculateDedupeHash(sourceId, hindiHeadline.normalize('NFD'));
  assert.equal(hindiHash1, hindiHash2, 'Unicode normalization must produce identical dedupeHash');
});

test('Phase 2.1: Retry exhaustion after max attempts with backoff', async () => {
  let callCount = 0;
  await assert.rejects(
    async () => {
      await withRetry(
        async () => {
          callCount++;
          throw new ConnectorError(ConnectorFailureType.HTTP_ERROR, 'Server Error 503', 503, true);
        },
        { maxAttempts: 3, initialDelayMs: 10, maxDelayMs: 50 }
      );
    },
    (err: any) => {
      assert.ok(err instanceof ConnectorError);
      assert.equal(callCount, 3);
      return true;
    }
  );
});

test('Phase 2.1: AdapterRegistry correctly resolves and manages all source types', () => {
  const registry = new AdapterRegistry();

  assert.ok(registry.hasAdapter('RSS'));
  assert.ok(registry.hasAdapter('ATOM'));
  assert.ok(registry.hasAdapter('GOVERNMENT_FEED'));
  assert.ok(registry.hasAdapter('API_GUARDIAN'));
  assert.ok(registry.hasAdapter('API_GNEWS'));
  assert.ok(registry.hasAdapter('MANUAL_PR'));
  assert.ok(registry.hasAdapter('INSTAGRAM_API'));

  const rssAdapter = registry.getAdapter('RSS');
  assert.equal(rssAdapter.sourceType, 'RSS');

  const govAdapter = registry.getAdapter('GOVERNMENT_FEED');
  assert.equal(govAdapter.sourceType, 'GOVERNMENT_FEED');

  const allAdapters = registry.listAdapters();
  assert.ok(allAdapters.length >= 7);
});

test('Phase 2.1: Secret Redaction guarantees no API keys or tokens in logs or error messages', () => {
  const dummyApiKey = ['ab123456', '789cdef'].join('');
  const dummyBearerToken = ['eyJhbGciOi', 'JIUzI1Ni...'].join('');
  const sensitiveError = `Failed request with api_key=${dummyApiKey} and bearer ${dummyBearerToken}`;
  const sanitized = sanitizeErrorMessage(sensitiveError);
  assert.match(sanitized, /\[REDACTED\]/);
  assert.ok(!sanitized.includes(dummyApiKey));
  assert.ok(!sanitized.includes(dummyBearerToken));

  assert.equal(maskSecret('0123456789abcdef'), '0123...cdef');
  assert.equal(maskSecret('short'), '****');
  assert.equal(maskSecret(''), '(empty)');
});

test('Phase 2.1: IngestionService skips disabled sources safely', async () => {
  const service = new IngestionService();
  const disabledSource: any = {
    id: 'src-disabled-01',
    name: 'Archived Outlet',
    type: 'RSS',
    isActive: false,
    feedUrl: 'https://example.com/rss.xml',
    category: ['General'],
    language: 'en',
    country: 'IN',
    pollingIntervalMinutes: 15,
    attributionName: 'Outlet',
    attributionUrl: 'https://example.com',
  };

  const summary = await service.ingestSource(disabledSource);
  assert.equal(summary.success, false);
  assert.equal(summary.errorCategory, ConnectorFailureType.SOURCE_DISABLED);
  assert.equal(summary.jobId, 'SKIPPED_DISABLED');
});

test('Phase 2.1: RBAC authorization enforces admin-only privileges on source mutations', () => {
  const editorUser = { id: 'u1', email: 'editor@parmanu.dev', role: 'EDITOR' as const };
  const adminUser = { id: 'u2', email: 'admin@parmanu.dev', role: 'ADMIN' as const };

  const adminOnlyMiddleware = requireRole(['ADMIN']);

  // Editor should be blocked
  let editorPassed = false;
  let blockedStatus: number | null = null;
  const mockReqEditor: any = { user: editorUser };
  const mockResEditor: any = {
    status: (s: number) => {
      blockedStatus = s;
      return { json: () => {} };
    },
  };
  adminOnlyMiddleware(mockReqEditor, mockResEditor, () => {
    editorPassed = true;
  });
  assert.equal(editorPassed, false);
  assert.equal(blockedStatus, 403);

  // Admin should pass
  let adminPassed = false;
  const mockReqAdmin: any = { user: adminUser };
  const mockResAdmin: any = {
    status: (s: number) => ({ json: () => {} }),
  };
  adminOnlyMiddleware(mockReqAdmin, mockResAdmin, () => {
    adminPassed = true;
  });
  assert.equal(adminPassed, true);
});
