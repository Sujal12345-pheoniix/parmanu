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
