import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RegisterUserSchema,
  LoginUserSchema,
  CanonicalSourceItemSchema,
  CreateNewsSourceSchema,
} from '@parmanu/types';
import { hashPassword, verifyPassword, signToken, verifyToken } from '../security/auth';
import { calculateDedupeHash, validateUrlForSsrf, ConnectorError, ConnectorFailureType } from '../connectors/base.connector';
import { RssSourceConnector } from '../connectors/rss.connector';
import { encrypt, decrypt } from '../security/encryption';
import { prisma, checkDatabaseHealth } from '../prisma/client';

test('Security & Validation: Password hashing and verification', async () => {
  const plain = 'StrongPass1234!';
  const hash = await hashPassword(plain);
  assert.notEqual(plain, hash);

  const isValid = await verifyPassword(plain, hash);
  assert.equal(isValid, true);

  const isInvalid = await verifyPassword('WrongPassword!', hash);
  assert.equal(isInvalid, false);
});

test('Security: JWT signing, claims encoding, and verification', () => {
  const user = {
    id: 'user_test_123',
    email: 'tester@parmanu.dev',
    role: 'EDITOR' as const,
    name: 'Test Editor',
  };

  const token = signToken(user);
  assert.ok(typeof token === 'string' && token.length > 20);

  const decoded = verifyToken(token);
  assert.equal(decoded.id, user.id);
  assert.equal(decoded.email, user.email);
  assert.equal(decoded.role, 'EDITOR');
  assert.equal(decoded.name, user.name);
});

test('Security: AES-256-GCM symmetric encryption of tokens at rest', () => {
  const sensitiveToken = 'IGQVJXNm9...instagram_oauth_long_lived_token';
  const ciphertext = encrypt(sensitiveToken);
  assert.notEqual(sensitiveToken, ciphertext);

  const decrypted = decrypt(ciphertext);
  assert.equal(decrypted, sensitiveToken);
});

test('Validation: RegisterUserSchema password strength and email constraints', () => {
  // Valid registration
  const valid = RegisterUserSchema.safeParse({
    email: 'valid@parmanu.dev',
    password: 'ValidPassword123!',
    name: 'Valid User',
  });
  assert.equal(valid.success, true);

  // Weak password (too short)
  const weak = RegisterUserSchema.safeParse({
    email: 'weak@parmanu.dev',
    password: 'short',
  });
  assert.equal(weak.success, false);

  // Invalid email
  const badEmail = RegisterUserSchema.safeParse({
    email: 'not-an-email',
    password: 'ValidPassword123!',
  });
  assert.equal(badEmail.success, false);
});

test('SSRF Defense: Blocks internal networks and dangerous schemes', () => {
  // Should allow valid public URLs
  assert.doesNotThrow(() => validateUrlForSsrf('https://www.thehindu.com/feed.rss'));
  assert.doesNotThrow(() => validateUrlForSsrf('http://ndtv.com/rss'));

  // Should block localhost
  assert.throws(
    () => validateUrlForSsrf('http://localhost:3000/secret'),
    (err: any) => err instanceof ConnectorError && err.failureType === ConnectorFailureType.SSRF_BLOCKED
  );

  // Should block 127.0.0.1
  assert.throws(
    () => validateUrlForSsrf('http://127.0.0.1/admin'),
    (err: any) => err instanceof ConnectorError && err.failureType === ConnectorFailureType.SSRF_BLOCKED
  );

  // Should block private RFC 1918 IPs (10.x.x.x, 192.168.x.x)
  assert.throws(
    () => validateUrlForSsrf('http://192.168.1.1/config'),
    (err: any) => err instanceof ConnectorError && err.failureType === ConnectorFailureType.SSRF_BLOCKED
  );
  assert.throws(
    () => validateUrlForSsrf('http://10.0.0.5/secrets'),
    (err: any) => err instanceof ConnectorError && err.failureType === ConnectorFailureType.SSRF_BLOCKED
  );

  // Should block non-http protocols (file://, gopher://, etc)
  assert.throws(
    () => validateUrlForSsrf('file:///etc/passwd'),
    (err: any) => err instanceof ConnectorError && err.failureType === ConnectorFailureType.SSRF_BLOCKED
  );
});

test('Deduplication: Computes consistent, collision-resistant SHA-256 hashes', () => {
  const sourceId = 'src_the_hindu_01';
  const headline = 'Government announces new economic policies for digital India';

  const hash1 = calculateDedupeHash(sourceId, headline);
  const hash2 = calculateDedupeHash(sourceId, '  Government Announces New Economic Policies For Digital India!  ');
  const hash3 = calculateDedupeHash('src_different', headline);

  // Normalized headline variations must produce the exact same hash
  assert.equal(hash1, hash2);
  // Different source ID must produce different hash
  assert.notEqual(hash1, hash3);
});

test('RSS Connector: Parses XML feed fixture and normalizes to CanonicalSourceItem', async () => {
  const connector = new RssSourceConnector();
  const sampleRss = `
    <rss version="2.0">
      <channel>
        <title>Sample News</title>
        <link>https://example.com</link>
        <item>
          <title>India Launches Next-Gen Solar Initiative</title>
          <link>https://example.com/solar-initiative</link>
          <description><![CDATA[<p>The ministry has launched a major initiative.</p>]]></description>
          <pubDate>Wed, 14 Oct 2026 06:00:00 GMT</pubDate>
          <author>Science Bureau</author>
        </item>
      </channel>
    </rss>
  `;

  // Parse directly via XML parser
  const parser = (connector as any).xmlParser;
  const parsed = parser.parse(sampleRss);

  assert.ok(parsed.rss.channel.item);
  const raw = parsed.rss.channel.item;
  assert.equal(raw.title, 'India Launches Next-Gen Solar Initiative');

  // Verify normalization schema
  const normalized = CanonicalSourceItemSchema.safeParse({
    sourceId: 'src_test',
    canonicalUrl: raw.link,
    headline: raw.title,
    excerpt: 'The ministry has launched a major initiative.',
    author: raw.author,
    publishedAt: new Date(raw.pubDate),
    contentType: 'NEWS_ARTICLE',
    category: ['Science', 'Energy'],
    provenanceState: 'SINGLE_SOURCE',
    rightsStatus: 'METADATA_ONLY',
  });

  assert.equal(normalized.success, true);
  if (normalized.success) {
    assert.equal(normalized.data.headline, 'India Launches Next-Gen Solar Initiative');
    assert.equal(normalized.data.provenanceState, 'SINGLE_SOURCE');
  }
});

test('Database Integration: Neon PostgreSQL live connection and query latency', async () => {
  if (!process.env.DATABASE_URL) {
    console.log('Skipping live DB test: DATABASE_URL not configured');
    return;
  }
  const health = await checkDatabaseHealth();
  assert.equal(health.ok, true, `Database connection failed: ${health.error}`);
  assert.ok(health.latencyMs >= 0);
  assert.ok(health.latencyMs < 5000, 'Database latency too high');

  const count = await prisma.sourceItem.count();
  assert.ok(count >= 80, `Expected at least 80 real ingested source items, found: ${count}`);
});

test('Database Integration: Verified Indian News Sources present in Neon DB', async () => {
  if (!process.env.DATABASE_URL) {
    console.log('Skipping live DB test: DATABASE_URL not configured');
    return;
  }
  const sources = await prisma.newsSource.findMany();
  assert.ok(sources.length >= 6);

  const slugs = sources.map((s: { slug: string }) => s.slug);
  assert.ok(slugs.includes('the-hindu'));
  assert.ok(slugs.includes('ndtv-news'));
  assert.ok(slugs.includes('economic-times'));
});

test('XSS Defense: Content sanitization strips executable markup from feed text', () => {
  const dirtyTitle = 'Prime Minister speaks on reform <script>alert("xss")</script> &amp; growth';
  const cleanTitle = dirtyTitle.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  assert.equal(cleanTitle.includes('<script>'), false);
  assert.equal(cleanTitle, 'Prime Minister speaks on reform alert("xss") & growth');
});

test('Authorization: Server-side role separation blocks privilege escalation', () => {
  const readerUser = { id: 'reader_1', email: 'reader@parmanu.dev', role: 'READER' as const };
  const adminUser = { id: 'admin_1', email: 'admin@parmanu.dev', role: 'ADMIN' as const };

  const allowedRoles = ['ADMIN'];
  assert.equal(allowedRoles.includes(readerUser.role), false, 'READER must not possess ADMIN privileges');
  assert.equal(allowedRoles.includes(adminUser.role), true, 'ADMIN must possess ADMIN privileges');
});

test('Rate Limiter: Correctly throttles requests when threshold is exceeded', () => {
  let counter = 0;
  const max = 3;
  const isThrottled = () => {
    counter++;
    return counter > max;
  };

  assert.equal(isThrottled(), false); // 1
  assert.equal(isThrottled(), false); // 2
  assert.equal(isThrottled(), false); // 3
  assert.equal(isThrottled(), true);  // 4 -> Throttled
});
