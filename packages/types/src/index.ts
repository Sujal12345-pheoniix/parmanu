import { z } from 'zod';

// ─── ENUMS & CORE VALUE CONSTANTS ─────────────────────────────────

export const UserRoleSchema = z.enum(['READER', 'EDITOR', 'ADMIN']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const SourceTypeSchema = z.enum([
  'RSS',
  'ATOM',
  'API_GNEWS',
  'API_GUARDIAN',
  'API_NEWSDATA',
  'MANUAL_PR',
  'GOVERNMENT_FEED',
  'INSTAGRAM_API',
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const ContentTypeSchema = z.enum([
  'NEWS_ARTICLE',
  'PRESS_RELEASE',
  'GOVERNMENT_ANNOUNCEMENT',
  'SPORTS_UPDATE',
  'CREATOR_ANNOUNCEMENT',
  'INSTAGRAM_POST',
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const ProcessingStateSchema = z.enum([
  'PENDING',
  'PROCESSING',
  'NORMALIZED',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
]);
export type ProcessingState = z.infer<typeof ProcessingStateSchema>;

export const ProvenanceStateSchema = z.enum([
  'OFFICIAL_CONFIRMED',
  'CORROBORATED',
  'SINGLE_SOURCE',
  'UNVERIFIED',
  'DISPUTED',
  'INFERRED',
]);
export type ProvenanceState = z.infer<typeof ProvenanceStateSchema>;

export const RightsStatusSchema = z.enum([
  'UNKNOWN',
  'METADATA_ONLY',
  'LICENSED_EXCERPT',
  'LICENSED_FULL',
  'PUBLIC_DOMAIN',
]);
export type RightsStatus = z.infer<typeof RightsStatusSchema>;

export const PermissionClassificationSchema = z.enum([
  'PUBLIC_SYNDICATION',
  'LICENSED_API',
  'OFFICIAL_GOVERNMENT',
  'CREATOR_VOLUNTARY_OAUTH',
  'PR_WIRE',
]);
export type PermissionClassification = z.infer<typeof PermissionClassificationSchema>;

export const SourceHealthStatusSchema = z.enum([
  'HEALTHY',
  'DEGRADED',
  'FAILING',
  'DISABLED',
]);
export type SourceHealthStatus = z.infer<typeof SourceHealthStatusSchema>;

export const EvidenceRelationSchema = z.enum([
  'PRIMARY_SOURCE',
  'CORROBORATING',
  'CONTRADICTING',
  'BACKGROUND',
  'OFFICIAL_STATEMENT',
]);
export type EvidenceRelation = z.infer<typeof EvidenceRelationSchema>;

export const EvidenceStatusSchema = z.enum([
  'ACTIVE',
  'SUPERSEDED',
  'RETRACTED',
  'DISPUTED',
]);
export type EvidenceStatus = z.infer<typeof EvidenceStatusSchema>;

export const ClaimTypeSchema = z.enum([
  'BRAND_COLLABORATION',
  'SPONSORED_POST',
  'AMBASSADOR',
  'PRODUCT_GIFTING',
  'EVENT_APPEARANCE',
]);
export type ClaimType = z.infer<typeof ClaimTypeSchema>;

export const JobTypeSchema = z.enum([
  'RSS_POLL',
  'API_POLL',
  'INSTAGRAM_SYNC',
  'TOKEN_REFRESH',
]);
export type JobType = z.infer<typeof JobTypeSchema>;

export const JobStatusSchema = z.enum([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'SKIPPED',
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

// ─── AUTHENTICATION SCHEMAS ────────────────────────────────────────

export const RegisterUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(12, 'Password must be at least 12 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  adminKey: z.string().optional(), // For bootstrapping admin
  interests: z.array(z.string()).optional(),
});
export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;

export const LoginUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required'),
});
export type LoginUserInput = z.infer<typeof LoginUserSchema>;

export const AuthTokenPayloadSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  role: UserRoleSchema,
  name: z.string().nullable().optional(),
});
export type AuthTokenPayload = z.infer<typeof AuthTokenPayloadSchema>;

// ─── SOURCE CONFIGURATION SCHEMAS ──────────────────────────────────

export const CreateNewsSourceSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  type: SourceTypeSchema,
  feedUrl: z.string().url().optional(),
  apiProvider: z.string().optional(),
  apiConfig: z.record(z.any()).optional(),
  category: z.array(z.string()).min(1),
  language: z.string().default('en'),
  country: z.string().default('IN'),
  pollingIntervalMinutes: z.number().int().min(5).max(1440).default(15),
  attributionName: z.string().min(1),
  attributionUrl: z.string().url(),
  isActive: z.boolean().default(true),
});
export type CreateNewsSourceInput = z.infer<typeof CreateNewsSourceSchema>;

export const UpdateNewsSourceSchema = z.object({
  name: z.string().min(2).optional(),
  feedUrl: z.string().url().optional().nullable(),
  apiProvider: z.string().optional().nullable(),
  apiConfig: z.record(z.any()).optional().nullable(),
  category: z.array(z.string()).min(1).optional(),
  language: z.string().optional(),
  country: z.string().optional(),
  pollingIntervalMinutes: z.number().int().min(5).max(1440).optional(),
  attributionName: z.string().min(1).optional(),
  attributionUrl: z.string().url().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateNewsSourceInput = z.infer<typeof UpdateNewsSourceSchema>;

export const SourceAdapterConfigSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  type: SourceTypeSchema,
  feedUrl: z.string().url().optional().nullable(),
  apiProvider: z.string().optional().nullable(),
  apiConfig: z.record(z.any()).optional().nullable(),
  category: z.array(z.string()).default([]),
  language: z.string().default('en'),
  country: z.string().default('IN'),
  attributionName: z.string().default(''),
  attributionUrl: z.string().default(''),
  isActive: z.boolean().default(true),
  pollingIntervalMinutes: z.number().int().default(15),
  maxItemsPerPoll: z.number().int().default(50),
  timeoutMs: z.number().int().default(12000),
  permissionClassification: PermissionClassificationSchema.default('PUBLIC_SYNDICATION'),
});
export type SourceAdapterConfig = z.infer<typeof SourceAdapterConfigSchema>;

// ─── CANONICAL SOURCE ITEM CONTRACT ────────────────────────────────

export const CanonicalSourceItemSchema = z.object({
  sourceId: z.string(),
  externalId: z.string().optional(),
  canonicalUrl: z.string().url(),
  headline: z.string().min(3).max(500),
  excerpt: z.string().max(1000).optional(),
  author: z.string().max(200).optional(),
  publishedAt: z.coerce.date(),
  contentType: ContentTypeSchema.default('NEWS_ARTICLE'),
  category: z.array(z.string()).default([]),
  language: z.string().default('en'),
  imageUrl: z.string().url().optional().nullable(),
  rightsStatus: RightsStatusSchema.default('METADATA_ONLY'),
  retentionDays: z.number().int().default(90),
  provenanceState: ProvenanceStateSchema.default('SINGLE_SOURCE'),
});
export type CanonicalSourceItem = z.infer<typeof CanonicalSourceItemSchema>;

// ─── EDITORIAL SCHEMAS ─────────────────────────────────────────────

export const ReviewSourceItemSchema = z.object({
  processingState: z.enum(['APPROVED', 'REJECTED']),
  provenanceState: ProvenanceStateSchema.optional(),
  reason: z.string().optional(), // Required if rejected or provenance changed
});
export type ReviewSourceItemInput = z.infer<typeof ReviewSourceItemSchema>;

export const CreateCollaborationClaimSchema = z.object({
  creatorProfileId: z.string(),
  brandProfileId: z.string(),
  campaignName: z.string().optional(),
  claimType: ClaimTypeSchema,
  provenanceState: ProvenanceStateSchema.default('UNVERIFIED'),
  claimDate: z.coerce.date().optional(),
  evidenceSourceItemId: z.string().optional(),
  notes: z.string().optional(),
});
export type CreateCollaborationClaimInput = z.infer<typeof CreateCollaborationClaimSchema>;

// ─── API RESPONSE ENVELOPE ─────────────────────────────────────────

export interface ApiResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  timestamp: string;
  requestId: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
  meta: ApiResponseMeta;
}

// ─── FEED QUERY PARAMETERS ─────────────────────────────────────────

export const NewsFeedQuerySchema = z.object({
  category: z.string().optional(),
  state: ProcessingStateSchema.default('APPROVED'),
  provenance: ProvenanceStateSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});
export type NewsFeedQuery = z.infer<typeof NewsFeedQuerySchema>;

// ─── INGESTION RUN & HEALTH METRICS ─────────────────────────────────

export interface IngestionRunSummary {
  sourceId: string;
  sourceName: string;
  sourceType: SourceType;
  jobId: string;
  success: boolean;
  itemsDiscovered: number;
  itemsInserted: number;
  itemsUpdated: number;
  itemsSkipped: number;
  itemsRejected: number;
  durationMs: number;
  errorCategory?: string;
  errorMessage?: string;
  retryAfterSeconds?: number;
}

export interface SourceHealthMetrics {
  sourceId: string;
  name: string;
  type: SourceType;
  healthStatus: SourceHealthStatus;
  isActive: boolean;
  consecutiveFailures: number;
  lastPolledAt: Date | null;
  lastSuccessAt: Date | null;
  lastErrorCategory?: string | null;
  lastErrorMessage?: string | null;
  totalItemsCount: number;
  avgResponseTimeMs?: number;
}

// ─── PHASE 2.2 STORY INTELLIGENCE & CLUSTERING SCHEMAS ───────────────

export const ClusterLifecycleSchema = z.enum([
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
]);
export type ClusterLifecycle = z.infer<typeof ClusterLifecycleSchema>;

export const ClusterItemRoleSchema = z.enum([
  'PRIMARY',
  'CORROBORATING',
  'UPDATE',
  'CONTRADICTING',
  'BACKGROUND',
]);
export type ClusterItemRole = z.infer<typeof ClusterItemRoleSchema>;

export const StoryClaimTypeSchema = z.enum([
  'FACTUAL_EVENT',
  'BRAND_COLLABORATION',
  'STATUTORY_ACTION',
  'NUMERICAL_FIGURE',
  'OFFICIAL_STATEMENT',
  'QUOTE',
]);
export type StoryClaimType = z.infer<typeof StoryClaimTypeSchema>;

export const ClaimVerificationStatusSchema = z.enum([
  'UNASSESSED',
  'SINGLE_SOURCE',
  'MULTIPLE_SOURCES',
  'OFFICIALLY_CONFIRMED',
  'DISPUTED',
  'CORRECTED',
  'RETRACTED',
]);
export type ClaimVerificationStatus = z.infer<typeof ClaimVerificationStatusSchema>;

export const EvidenceStanceSchema = z.enum([
  'SUPPORTS',
  'CONTRADICTS',
  'CONTEXTUALIZES',
]);
export type EvidenceStance = z.infer<typeof EvidenceStanceSchema>;

export const SourceIndependenceSchema = z.enum([
  'INDEPENDENT',
  'SYNDICATED',
  'REPOST',
  'OFFICIAL_SPOKESPERSON',
]);
export type SourceIndependence = z.infer<typeof SourceIndependenceSchema>;

export const RegisteredEntityTypeSchema = z.enum([
  'CREATOR',
  'BRAND',
  'ORGANIZATION',
  'GOVERNMENT_BODY',
  'PUBLIC_FIGURE',
]);
export type RegisteredEntityType = z.infer<typeof RegisteredEntityTypeSchema>;

export const EntityRelationshipTypeSchema = z.enum([
  'ANNOUNCED_PARTNERSHIP',
  'FEATURED_WITH',
  'BRAND_CAMPAIGN',
  'CO_AUTHORED_CONTENT',
  'RUMORED_RELATIONSHIP',
  'REGULATORY_OVERSIGHT',
]);
export type EntityRelationshipType = z.infer<typeof EntityRelationshipTypeSchema>;

export const RelationshipStatusSchema = z.enum([
  'UNVERIFIED',
  'PROPOSED',
  'CONFIRMED',
  'DISPUTED',
  'TERMINATED',
]);
export type RelationshipStatus = z.infer<typeof RelationshipStatusSchema>;

// Story Cluster Query & Mutation Schemas
export const StoryClusterQuerySchema = z.object({
  status: ClusterLifecycleSchema.optional(),
  category: z.string().optional(),
  entityId: z.string().optional(),
  search: z.string().optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type StoryClusterQuery = z.infer<typeof StoryClusterQuerySchema>;

export const MergeClustersSchema = z.object({
  primaryClusterId: z.string().min(1),
  secondaryClusterId: z.string().min(1),
  reason: z.string().min(5),
});
export type MergeClustersInput = z.infer<typeof MergeClustersSchema>;

export const SplitClusterSchema = z.object({
  sourceClusterId: z.string().min(1),
  sourceItemIdsToDetach: z.array(z.string().min(1)).min(1),
  newClusterHeadline: z.string().min(5),
  reason: z.string().min(5),
});
export type SplitClusterInput = z.infer<typeof SplitClusterSchema>;

export const ReviewClaimSchema = z.object({
  verificationStatus: ClaimVerificationStatusSchema,
  notes: z.string().min(3),
});
export type ReviewClaimInput = z.infer<typeof ReviewClaimSchema>;

export const CreateEntityRegistrySchema = z.object({
  canonicalName: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  entityType: RegisteredEntityTypeSchema,
  aliases: z.array(z.string()).default([]),
  verifiedUrls: z.record(z.any()).optional(),
  isVerified: z.boolean().default(false),
  creatorProfileId: z.string().optional(),
  brandProfileId: z.string().optional(),
});
export type CreateEntityRegistryInput = z.infer<typeof CreateEntityRegistrySchema>;

export const CreateEntityRelationshipSchema = z.object({
  sourceEntityId: z.string().min(1),
  targetEntityId: z.string().min(1),
  relationshipType: EntityRelationshipTypeSchema,
  status: RelationshipStatusSchema.default('UNVERIFIED'),
  confidence: z.number().min(0).max(1).default(0.5),
  storyClusterId: z.string().optional(),
  evidenceSourceItemId: z.string().optional(),
  notes: z.string().optional(),
  validFrom: z.coerce.date().optional(),
  validTo: z.coerce.date().optional(),
});
export type CreateEntityRelationshipInput = z.infer<typeof CreateEntityRelationshipSchema>;

// ─── PHASE 2.3: EDITORIAL CMS & PUBLISHING SCHEMAS ──────────────────

export const EditorialQueueQuerySchema = z.object({
  status: ClusterLifecycleSchema.optional(),
  category: z.string().optional(),
  sourceId: z.string().optional(),
  entityId: z.string().optional(),
  assignedTo: z.string().optional(),
  priority: z.enum(['HIGH', 'NORMAL', 'ALL']).optional().default('ALL'),
  search: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type EditorialQueueQuery = z.infer<typeof EditorialQueueQuerySchema>;

export const AssignStoryClusterSchema = z.object({
  assignedTo: z.string().min(1, 'Assignee ID or email is required'),
  notes: z.string().optional(),
});
export type AssignStoryClusterInput = z.infer<typeof AssignStoryClusterSchema>;

export const EditorialReviewDecisionSchema = z.enum([
  'APPROVE',
  'REJECT',
  'NEEDS_MORE_EVIDENCE',
  'DISPUTE',
]);
export type EditorialReviewDecision = z.infer<typeof EditorialReviewDecisionSchema>;

export const EditorialReviewClusterSchema = z.object({
  decision: EditorialReviewDecisionSchema,
  notes: z.string().min(3, 'Review notes must provide rationale'),
  expectedVersion: z.number().int().optional(),
});
export type EditorialReviewClusterInput = z.infer<typeof EditorialReviewClusterSchema>;

export const PublishStoryClusterSchema = z.object({
  headline: z.string().min(5).optional(),
  summary: z.string().min(10).optional(),
  editorialNotes: z.string().optional(),
  expectedVersion: z.number().int().optional(),
});
export type PublishStoryClusterInput = z.infer<typeof PublishStoryClusterSchema>;

export const RetractStoryClusterSchema = z.object({
  reason: z.string().min(10, 'A detailed reason is required for story retraction'),
  editorialNotes: z.string().optional(),
  expectedVersion: z.number().int().optional(),
});
export type RetractStoryClusterInput = z.infer<typeof RetractStoryClusterSchema>;

export const CorrectStoryClusterSchema = z.object({
  correctionNotice: z.string().min(10, 'Public correction notice must clearly describe what was changed and why'),
  revisedHeadline: z.string().min(5).optional(),
  revisedSummary: z.string().min(10).optional(),
  editorialNotes: z.string().optional(),
  expectedVersion: z.number().int().optional(),
});
export type CorrectStoryClusterInput = z.infer<typeof CorrectStoryClusterSchema>;

// ─── PHASE 3.1: CONSUMER DISCOVERY & BOOKMARKS SCHEMAS ────────────────

export const CreateBookmarkSchema = z.object({
  storyClusterId: z.string().optional(),
  sourceItemId: z.string().optional(),
  storyId: z.string().optional(),
}).refine(data => Boolean(data.storyClusterId || data.sourceItemId || data.storyId), {
  message: 'Must provide at least one target to bookmark: storyClusterId, sourceItemId, or storyId',
});
export type CreateBookmarkInput = z.infer<typeof CreateBookmarkSchema>;

export const BookmarkQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type BookmarkQuery = z.infer<typeof BookmarkQuerySchema>;

export const TrendingStoriesQuerySchema = z.object({
  category: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});
export type TrendingStoriesQuery = z.infer<typeof TrendingStoriesQuerySchema>;

export const ConsumerFeedQuerySchema = z.object({
  category: z.string().optional(),
  topic: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['latest', 'trending', 'confidence']).default('latest'),
});
export type ConsumerFeedQuery = z.infer<typeof ConsumerFeedQuerySchema>;

export const ConsumerSearchQuerySchema = z.object({
  q: z.string().min(1, 'Search query is required'),
  category: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type ConsumerSearchQuery = z.infer<typeof ConsumerSearchQuerySchema>;


