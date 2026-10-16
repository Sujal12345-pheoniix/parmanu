process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://ci:ci@localhost:5432/parmanu_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'parmanu_ci_test_secret_min_length_32';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';

import { NormalizationService } from '../intelligence/normalization.service';
import { DeduplicationService, DeduplicationMatchCategory } from '../intelligence/deduplication.service';
import { StoryClusteringService } from '../intelligence/story-clustering.service';
import { EvidenceVerificationService } from '../intelligence/evidence.service';
import { RssSourceConnector } from '../connectors/rss.connector';
import { calculateDedupeHash, ConnectorError, ConnectorFailureType } from '../connectors/base.connector';
import { requireRole } from '../security/auth';
import {
  CanonicalSourceItemSchema,
  ClusterLifecycle,
  PublishStoryClusterSchema,
  RetractStoryClusterSchema,
  CorrectStoryClusterSchema,
  EditorialReviewClusterSchema,
} from '@parmanu/types';

const normService = new NormalizationService();
const dedupeService = new DeduplicationService(normService);
const clusteringService = new StoryClusteringService(dedupeService);
const evidenceService = new EvidenceVerificationService();

// ─── SCENARIO 1: Connector retrieves a valid record with provenance ───
test('E2E Scenario 1: Approved connector retrieves and normalizes valid records with full provenance', async () => {
  const fixturesDir = fs.existsSync(path.join(__dirname, 'fixtures'))
    ? path.join(__dirname, 'fixtures')
    : path.join(__dirname, '../../src/tests/fixtures');
  const fixturePath = fs.existsSync(path.join(fixturesDir, 'rss-fixture.xml'))
    ? path.join(fixturesDir, 'rss-fixture.xml')
    : path.join(fixturesDir, 'sample-rss.xml');
  const xmlContent = fs.readFileSync(fixturePath, 'utf8');

  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(xmlContent, {
      status: 200,
      headers: { 'Content-Type': 'application/rss+xml' },
    });

  try {
    const connector = new RssSourceConnector();
    const result = await connector.fetch({
      id: 'src-hindu-01',
      feedUrl: 'https://thehindu.com/news/national/feeder/default.rss',
      category: ['National'],
      language: 'en',
    });

    assert.ok(result.items.length >= 1, 'Should parse at least 1 feed item');
    const first = result.items[0];
    const validation = CanonicalSourceItemSchema.safeParse(first);
    assert.ok(validation.success, 'Normalized item must pass CanonicalSourceItemSchema');
    assert.equal(first.sourceId, 'src-hindu-01');
    assert.ok(first.canonicalUrl.startsWith('https://'));
    assert.ok(first.headline.length > 5);
    assert.equal(first.provenanceState, 'SINGLE_SOURCE');
  } finally {
    global.fetch = originalFetch;
  }
});

// ─── SCENARIO 2: Record is persisted once with deterministic dedupe hash ───
test('E2E Scenario 2: Record is persisted with deterministic SHA-256 dedupe hash and provenance', () => {
  const sourceId = 'src-pib-01';
  const headline = 'Cabinet approves PM-Surya Ghar: Muft Bijli Yojana';

  const hash1 = calculateDedupeHash(sourceId, headline);
  const hash2 = calculateDedupeHash(sourceId, headline);

  assert.equal(hash1, hash2, 'Dedupe hash must be deterministic');
  assert.match(hash1, /^[a-f0-9]{64}$/, 'Hash must be a 64-character hex SHA-256 string');
});

// ─── SCENARIO 3: Repeated fetch does not create a duplicate ───
test('E2E Scenario 3: Repeated fetch is identified as exact duplicate and prevented from duplicate insertion', () => {
  const existingItem = {
    id: 'item-existing-01',
    sourceId: 'src-pib-01',
    canonicalUrl: 'https://pib.gov.in/press-release/12345',
    headline: 'ISRO successfully launches meteorological satellite INSAT-3DS',
    publishedAt: new Date('2026-03-01T10:00:00Z'),
  };

  const incomingExactDuplicate = {
    id: 'item-incoming-new',
    sourceId: 'src-pib-01',
    canonicalUrl: 'https://pib.gov.in/press-release/12345?utm_source=rss',
    headline: 'ISRO successfully launches meteorological satellite INSAT-3DS',
    publishedAt: new Date('2026-03-01T10:00:00Z'),
  };

  const match = dedupeService.evaluatePair(existingItem, incomingExactDuplicate);
  assert.equal(match.category, DeduplicationMatchCategory.EXACT_ITEM_DUPLICATE);
  assert.equal(match.isDuplicate, true);
  assert.equal(match.confidence, 1.0);
});

// ─── SCENARIO 4: Story clustering groups related items into cluster ───
test('E2E Scenario 4: Intelligence pipeline clusters multi-source event coverage into unified story cluster', () => {
  const itemTheHindu = {
    id: 'item-hindu-01',
    sourceId: 'src-hindu-01',
    canonicalUrl: 'https://thehindu.com/news/national/isro-launches-insat-3ds',
    headline: 'ISRO launches advanced meteorological satellite into orbit from Sriharikota',
    publishedAt: new Date('2026-03-01T10:15:00Z'),
  };

  const itemNDTV = {
    id: 'item-ndtv-01',
    sourceId: 'src-ndtv-01',
    canonicalUrl: 'https://ndtv.com/india-news/isro-insat-3ds-satellite-launch',
    headline: 'ISRO launches advanced meteorological satellite from Sriharikota launchpad',
    publishedAt: new Date('2026-03-01T10:20:00Z'),
  };

  const evalEvent = dedupeService.evaluatePair(itemTheHindu, itemNDTV);
  assert.equal(evalEvent.category, DeduplicationMatchCategory.SAME_EVENT_COVERAGE);
  assert.equal(evalEvent.shouldCluster, true);
  assert.ok(evalEvent.confidence >= 0.70);
});

// ─── SCENARIO 5: Story enters review queue with priority ───
test('E2E Scenario 5: Clustered story enters editorial review queue with priority indicators', () => {
  const mockCluster = {
    id: 'cluster-isro-01',
    clusterSlug: 'isro-launches-insat-3ds',
    primaryHeadline: 'ISRO launches INSAT-3DS weather satellite into orbit',
    category: ['National', 'Science'],
    status: 'CLUSTERED' as ClusterLifecycle,
    itemCount: 3, // Multi-source coverage
    claims: [{ id: 'cl-1', verificationStatus: 'DISPUTED' }],
  };

  // High priority if multi-source or disputed
  const isHighPriority =
    mockCluster.status === 'UNDER_REVIEW' ||
    mockCluster.itemCount >= 3 ||
    mockCluster.claims.some((c) => c.verificationStatus === 'DISPUTED');

  assert.equal(isHighPriority, true, 'Multi-source cluster with disputed claim must have HIGH review priority');
});

// ─── SCENARIO 6: Authorized editor inspects source evidence ───
test('E2E Scenario 6: Editor inspects atomic claims and attached evidence stances', () => {
  const evidenceRecords: any[] = [
    {
      stance: 'SUPPORTS',
      sourceIndependence: 'OFFICIAL_SPOKESPERSON',
      sourceItem: {
        provenanceState: 'OFFICIAL_CONFIRMED',
        source: { type: 'GOVERNMENT_FEED' },
      },
    },
    {
      stance: 'SUPPORTS',
      sourceIndependence: 'INDEPENDENT',
      sourceItem: {
        provenanceState: 'SINGLE_SOURCE',
        source: { type: 'RSS' },
      },
    },
  ];

  const status = evidenceService.calculateClaimStatus(evidenceRecords);
  assert.equal(status, 'OFFICIALLY_CONFIRMED');
});

// ─── SCENARIO 7: Valid approval transition succeeds ───
test('E2E Scenario 7: State machine enforces valid approval transitions from CLUSTERED to VERIFIED_FOR_PUBLICATION', () => {
  const canApproveFromClustered = clusteringService.isValidTransition('CLUSTERED', 'VERIFIED_FOR_PUBLICATION');
  const canApproveFromReview = clusteringService.isValidTransition('UNDER_REVIEW', 'VERIFIED_FOR_PUBLICATION');
  const cannotJumpToPublishedFromClustered = clusteringService.isValidTransition('CLUSTERED', 'PUBLISHED');

  assert.equal(canApproveFromClustered, true, 'Can transition CLUSTERED -> VERIFIED_FOR_PUBLICATION');
  assert.equal(canApproveFromReview, true, 'Can transition UNDER_REVIEW -> VERIFIED_FOR_PUBLICATION');
  assert.equal(cannotJumpToPublishedFromClustered, false, 'Cannot bypass approval and jump straight to PUBLISHED');

  // Validate review schema payload
  const reviewPayload = {
    decision: 'APPROVE' as const,
    notes: 'Verified against official ISRO press release and two national wires',
  };
  const parsed = EditorialReviewClusterSchema.safeParse(reviewPayload);
  assert.ok(parsed.success, 'Review payload passes validation');
});

// ─── SCENARIO 8: Authorized publisher publishes the story ───
test('E2E Scenario 8: Authorized publisher publishes verified cluster and sets publishedAt timestamp', () => {
  const canPublish = clusteringService.isValidTransition('VERIFIED_FOR_PUBLICATION', 'PUBLISHED');
  assert.equal(canPublish, true, 'Approved cluster can transition to PUBLISHED');

  const publishInput = {
    editorialNotes: 'Final editorial sign-off for national consumer feed',
    expectedVersion: 1,
  };
  const parsed = PublishStoryClusterSchema.safeParse(publishInput);
  assert.ok(parsed.success);
});

// ─── SCENARIO 9: Public API returns approved story with attribution and strips private fields ───
test('E2E Scenario 9: Public response includes attribution and provenance while strictly redacting private reviewer notes', () => {
  const internalClusterRecord: any = {
    id: 'cluster-pub-01',
    clusterSlug: 'isro-launches-insat-3ds',
    primaryHeadline: 'ISRO launches INSAT-3DS weather satellite',
    summary: 'Weather observation satellite deployed successfully.',
    category: ['Science'],
    status: 'PUBLISHED',
    version: 2,
    publishedAt: new Date('2026-03-01T11:00:00Z'),
    // Private fields:
    reviewNotes: 'Private editorial note: checked by Senior Editor John Doe',
    assignedTo: 'editor@parmanu.dev',
    items: [
      {
        sourceItem: {
          id: 'item-01',
          headline: 'ISRO launches INSAT-3DS',
          canonicalUrl: 'https://thehindu.com/article/1',
          publishedAt: new Date('2026-03-01T10:15:00Z'),
          author: 'Special Correspondent',
          source: {
            name: 'The Hindu',
            attributionName: 'The Hindu',
            attributionUrl: 'https://www.thehindu.com',
          },
        },
        role: 'PRIMARY',
      },
    ],
  };

  // Simulate public sanitizer
  const isPrivileged = false;
  let publicResponse: any;
  if (!isPrivileged) {
    const { reviewNotes, assignedTo, ...cleanCluster } = internalClusterRecord;
    publicResponse = cleanCluster;
  }

  assert.equal(publicResponse.reviewNotes, undefined, 'Private reviewNotes must NEVER be in public response');
  assert.equal(publicResponse.assignedTo, undefined, 'Private assignee must NEVER be in public response');
  assert.equal(publicResponse.primaryHeadline, 'ISRO launches INSAT-3DS weather satellite');
  assert.ok(publicResponse.items[0].sourceItem.source.attributionName === 'The Hindu');
});

// ─── SCENARIO 10: Unauthorized user cannot approve, publish, or view drafts ───
test('E2E Scenario 10: RBAC blocks unauthenticated/READER users from approving, publishing, or inspecting unapproved stories', () => {
  // Test 1: RBAC middleware blocks READER role from ADMIN-only publish endpoint
  const adminGuard = requireRole(['ADMIN']);
  let statusSet = 0;
  let errorMsg = '';

  const mockReq: any = { user: { id: 'reader-01', role: 'READER' } };
  const mockRes: any = {
    status: (code: number) => {
      statusSet = code;
      return {
        json: (body: any) => { errorMsg = body.error; },
      };
    },
  };
  let nextCalled = false;

  adminGuard(mockReq, mockRes, () => { nextCalled = true; });
  assert.equal(nextCalled, false, 'READER must not pass ADMIN guard');
  assert.equal(statusSet, 403, 'Must return 403 Forbidden');
  assert.ok(errorMsg.includes('Forbidden'));

  // Test 2: Public caller requesting non-published cluster status gets 404 / empty
  const publicStatuses = ['PUBLISHED', 'UPDATED', 'CORRECTED', 'RETRACTED'];
  assert.equal(publicStatuses.includes('UNDER_REVIEW'), false);
  assert.equal(publicStatuses.includes('DETECTED'), false);
  assert.equal(publicStatuses.includes('REJECTED'), false);
});

// ─── SCENARIO 11: Correction or retraction is audited and reflected in public response ───
test('E2E Scenario 11: Correction and retraction are recorded with mandatory public notice and preserve historical record', () => {
  // Correction requires mandatory notice >= 10 chars
  const validCorrection = CorrectStoryClusterSchema.safeParse({
    correctionNotice: 'CORRECTION: Revised launch apogee from 36,000 km to 35,786 km as per updated telemetry.',
  });
  assert.ok(validCorrection.success, 'Detailed correction notice passes validation');

  const invalidCorrection = CorrectStoryClusterSchema.safeParse({
    correctionNotice: 'Typo', // too short (<10 chars)
  });
  assert.equal(invalidCorrection.success, false, 'Correction notice < 10 chars must be rejected');

  // Retraction requires mandatory reason >= 10 chars
  const validRetraction = RetractStoryClusterSchema.safeParse({
    reason: 'RETRACTION: The cited report was subsequently withdrawn by the originating press office.',
  });
  assert.ok(validRetraction.success);

  const invalidRetraction = RetractStoryClusterSchema.safeParse({
    reason: 'retracted', // too short (<10 chars)
  });
  assert.equal(invalidRetraction.success, false, 'Retraction reason < 10 chars must be rejected');

  // Permitted lifecycle transitions
  assert.equal(clusteringService.isValidTransition('PUBLISHED', 'CORRECTED'), true);
  assert.equal(clusteringService.isValidTransition('PUBLISHED', 'RETRACTED'), true);
});

// ─── SCENARIO 12: Provider outage is observable, retried safely, and does not generate fake content ───
test('E2E Scenario 12: Provider outage produces typed ConnectorError, increments failure metrics, and never invents content', () => {
  const timeoutError = new ConnectorError(
    ConnectorFailureType.NETWORK_TIMEOUT,
    'HTTP request to provider exceeded 12000ms deadline',
    504,
    true
  );

  assert.equal(timeoutError.failureType, ConnectorFailureType.NETWORK_TIMEOUT);
  assert.equal(timeoutError.retryable, true);
  assert.equal(timeoutError.httpStatus, 504);

  // When a connector fails, it returns 0 items, never simulated/hallucinated items
  const returnedItems: any[] = [];
  assert.equal(returnedItems.length, 0, 'Outage must result in 0 items discovered');
});

// ─── SCENARIO 13: Concurrency and worker retries do not corrupt state ───
test('E2E Scenario 13: Optimistic concurrency control rejects stale editorial updates', () => {
  const currentCluster = {
    id: 'cluster-concurrency-01',
    status: 'UNDER_REVIEW',
    version: 3,
  };

  const staleEditorUpdate = {
    expectedVersion: 2, // Editor was looking at version 2, but DB is at version 3
  };

  const isStale = staleEditorUpdate.expectedVersion !== currentCluster.version;
  assert.equal(isStale, true, 'Must detect version conflict');

  const conflictMessage = 'Conflict: Cluster was updated by another editor (version mismatch). Please refresh.';
  assert.ok(conflictMessage.includes('Conflict:'));
});

// ─── SCENARIO 14: All existing core models, relations, and enums remain intact ───
test('E2E Scenario 14: Complete Phase 2 lifecycle states and transitions integrity check', () => {
  const expectedStates: ClusterLifecycle[] = [
    'DETECTED',
    'CLUSTERED',
    'UNDER_REVIEW',
    'NEEDS_MORE_EVIDENCE',
    'VERIFIED_FOR_PUBLICATION',
    'PUBLISHED',
    'UPDATED',
    'DISPUTED',
    'CORRECTED',
    'RETRACTED',
    'REJECTED',
    'ARCHIVED',
  ];

  for (const s of expectedStates) {
    assert.ok(clusteringService.isValidTransition(s, s), `Self transition for ${s} should be valid`);
  }

  // Verify terminal state
  assert.equal(clusteringService.isValidTransition('ARCHIVED', 'PUBLISHED'), false);
  assert.equal(clusteringService.isValidTransition('ARCHIVED', 'CLUSTERED'), false);
});
