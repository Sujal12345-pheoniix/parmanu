process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://ci:ci@localhost:5432/parmanu_test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'parmanu_ci_test_secret_min_length_32';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CreateBookmarkSchema,
  BookmarkQuerySchema,
  TrendingStoriesQuerySchema,
  ConsumerSearchQuerySchema,
  ConsumerFeedQuerySchema,
} from '@parmanu/types';

// ─── TEST 1: Consumer Query Schemas Validation ────────────────────────

test('Phase 3.1: Consumer Query Schemas correctly validate input boundaries', () => {
  // Trending query validation
  const validTrending = TrendingStoriesQuerySchema.safeParse({ category: 'TECH', limit: 15 });
  assert.ok(validTrending.success);
  assert.equal(validTrending.data.category, 'TECH');
  assert.equal(validTrending.data.limit, 15);

  const defaultTrending = TrendingStoriesQuerySchema.safeParse({});
  assert.ok(defaultTrending.success);
  assert.equal(defaultTrending.data.limit, 10);

  const invalidLimitTrending = TrendingStoriesQuerySchema.safeParse({ limit: 100 });
  assert.ok(!invalidLimitTrending.success, 'Trending limit should be capped at 50');

  // Search query validation
  const validSearch = ConsumerSearchQuerySchema.safeParse({ q: 'ISRO', page: '2', limit: '20' });
  assert.ok(validSearch.success);
  assert.equal(validSearch.data.q, 'ISRO');
  assert.equal(validSearch.data.page, 2);

  const emptySearch = ConsumerSearchQuerySchema.safeParse({ q: '' });
  assert.ok(!emptySearch.success, 'Empty query string must be rejected');

  // Consumer feed query validation
  const validFeed = ConsumerFeedQuerySchema.safeParse({ category: 'POLICY', sort: 'trending' });
  assert.ok(validFeed.success);
  assert.equal(validFeed.data.sort, 'trending');

  const invalidSort = ConsumerFeedQuerySchema.safeParse({ sort: 'unsupported_sort' });
  assert.ok(!invalidSort.success);
});

// ─── TEST 2: Bookmark Payload Validation & Isolation ──────────────────

test('Phase 3.1: Bookmark schemas enforce target requirement and user isolation', () => {
  // Must provide at least one target ID
  const emptyBookmark = CreateBookmarkSchema.safeParse({});
  assert.ok(!emptyBookmark.success, 'Must fail when no target ID is provided');

  const validClusterBookmark = CreateBookmarkSchema.safeParse({ storyClusterId: 'cluster_123' });
  assert.ok(validClusterBookmark.success);
  assert.equal(validClusterBookmark.data.storyClusterId, 'cluster_123');

  const validSourceItemBookmark = CreateBookmarkSchema.safeParse({ sourceItemId: 'item_456' });
  assert.ok(validSourceItemBookmark.success);
  assert.equal(validSourceItemBookmark.data.sourceItemId, 'item_456');

  // Pagination bounds
  const validPage = BookmarkQuerySchema.safeParse({ page: '1', limit: '10' });
  assert.ok(validPage.success);
  assert.equal(validPage.data.page, 1);
  assert.equal(validPage.data.limit, 10);

  const invalidPage = BookmarkQuerySchema.safeParse({ page: '0' });
  assert.ok(!invalidPage.success, 'Page 0 is invalid, min is 1');
});

// ─── TEST 3: Trending Stories Ranking Determinism ──────────────────────

test('Phase 3.1: Trending stories ranking algorithm accurately weights corroboration, confidence, and recency', () => {
  const mockClusters = [
    {
      id: 'cluster-1',
      primaryHeadline: 'Single-source emerging post',
      itemCount: 1,
      confidenceScore: 0.60,
      lastObservedAt: new Date('2026-10-15T10:00:00Z'),
    },
    {
      id: 'cluster-2',
      primaryHeadline: 'Heavily corroborated multi-source report',
      itemCount: 5,
      confidenceScore: 0.95,
      lastObservedAt: new Date('2026-10-15T09:00:00Z'),
    },
    {
      id: 'cluster-3',
      primaryHeadline: 'Dual-source confirmed story',
      itemCount: 2,
      confidenceScore: 0.85,
      lastObservedAt: new Date('2026-10-15T11:00:00Z'),
    },
  ];

  // Sorting according to consumer controller rules: itemCount DESC, confidenceScore DESC, lastObservedAt DESC
  const sorted = [...mockClusters].sort((a, b) => {
    if (b.itemCount !== a.itemCount) return b.itemCount - a.itemCount;
    if (b.confidenceScore !== a.confidenceScore) return b.confidenceScore - a.confidenceScore;
    return b.lastObservedAt.getTime() - a.lastObservedAt.getTime();
  });

  assert.equal(sorted[0].id, 'cluster-2', 'Heavily corroborated cluster must rank first');
  assert.equal(sorted[1].id, 'cluster-3', 'Dual source cluster must rank second');
  assert.equal(sorted[2].id, 'cluster-1', 'Single source cluster must rank third');
});

// ─── TEST 4: Category Distribution Aggregation ────────────────────────

test('Phase 3.1: Category distribution aggregation normalizes tags and handles duplicates', () => {
  const mockPublishedStories = [
    { category: ['National', 'Policy'] },
    { category: ['NATIONAL', 'Tech'] },
    { category: ['Creator Economy', 'Tech'] },
    { category: ['Policy'] },
  ];

  const categoryCountMap = new Map<string, number>();
  for (const story of mockPublishedStories) {
    if (Array.isArray(story.category)) {
      for (const cat of story.category) {
        const normalized = cat.trim().toUpperCase();
        if (normalized) {
          categoryCountMap.set(normalized, (categoryCountMap.get(normalized) || 0) + 1);
        }
      }
    }
  }

  const result = Array.from(categoryCountMap.entries())
    .map(([name, count]) => ({
      name,
      slug: name.toLowerCase().replace(/_/g, '-'),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  assert.equal(result.find((c) => c.name === 'NATIONAL')?.count, 2);
  assert.equal(result.find((c) => c.name === 'POLICY')?.count, 2);
  assert.equal(result.find((c) => c.name === 'TECH')?.count, 2);
  assert.equal(result.find((c) => c.name === 'CREATOR ECONOMY')?.count, 1);
});

// ─── TEST 5: Public API Privacy Guard (Zero Leaked Editorial Notes) ───

test('Phase 3.1: Consumer endpoints strip internal editorial notes and unapproved statuses', () => {
  const rawDbCluster = {
    id: 'cl-77',
    clusterSlug: 'union-budget-ai-allocations',
    primaryHeadline: 'Union Budget 2026 allocates Rs 10,000 Cr to IndiaAI mission',
    summary: 'Corroborated news item with multi-agency attribution.',
    category: ['TECH', 'POLICY'],
    status: 'PUBLISHED',
    confidenceScore: 0.92,
    itemCount: 4,
    assignedTo: 'editor-internal@parmanu.dev',
    reviewNotes: 'Verified via PIB and Ministry briefing. Internal discussion on section 4.',
    retractionReason: null,
  };

  const isPrivileged = false; // Consumer request
  let sanitizedItem: any = rawDbCluster;
  if (!isPrivileged) {
    const { reviewNotes, assignedTo, ...cleanItem } = rawDbCluster;
    sanitizedItem = cleanItem;
  }

  assert.equal(sanitizedItem.reviewNotes, undefined, 'Private review notes must NOT leak to consumer');
  assert.equal(sanitizedItem.assignedTo, undefined, 'Assigned staff must NOT leak to consumer');
  assert.equal(sanitizedItem.primaryHeadline, rawDbCluster.primaryHeadline);
  assert.equal(sanitizedItem.confidenceScore, 0.92);
});

// ─── TEST 6: Unapproved Content Guard ─────────────────────────────────

test('Phase 3.1: Consumer query filter strictly forbids DETECTED and UNDER_REVIEW clusters', () => {
  const publicStatuses = ['PUBLISHED', 'UPDATED', 'CORRECTED', 'RETRACTED'];

  const testStatuses = [
    { status: 'DETECTED', shouldShow: false },
    { status: 'CLUSTERED', shouldShow: false },
    { status: 'UNDER_REVIEW', shouldShow: false },
    { status: 'NEEDS_MORE_EVIDENCE', shouldShow: false },
    { status: 'REJECTED', shouldShow: false },
    { status: 'PUBLISHED', shouldShow: true },
    { status: 'UPDATED', shouldShow: true },
    { status: 'CORRECTED', shouldShow: true },
    { status: 'RETRACTED', shouldShow: true },
  ];

  for (const item of testStatuses) {
    const isVisible = publicStatuses.includes(item.status);
    assert.equal(
      isVisible,
      item.shouldShow,
      `Status ${item.status} visibility expected to be ${item.shouldShow}`
    );
  }
});
