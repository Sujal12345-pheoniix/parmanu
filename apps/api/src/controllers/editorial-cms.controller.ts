import { Response } from 'express';
import { prisma } from '../prisma/client';
import { AuthenticatedRequest } from '../security/auth';
import { logAuditEvent } from '../audit/audit.service';
import {
  EditorialQueueQuerySchema,
  AssignStoryClusterSchema,
  EditorialReviewClusterSchema,
  PublishStoryClusterSchema,
  RetractStoryClusterSchema,
  CorrectStoryClusterSchema,
  ClusterLifecycle,
} from '@parmanu/types';
import { defaultStoryClusteringService } from '../intelligence/story-clustering.service';

/**
 * Editorial Overview Metrics
 * Returns verified database-backed operational metrics for editorial staff
 */
export async function getEditorialOverview(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      items24h,
      items7d,
      awaitingReviewCount,
      approvedCount,
      publishedCount,
      disputedCount,
      correctedCount,
      retractedCount,
      rejectedCount,
      activeSourcesCount,
      failingSourcesCount,
      failedJobs24h,
      lastSuccessfulJob,
      duplicateCandidateClusters,
    ] = await Promise.all([
      // Items ingested in last 24h
      prisma.sourceItem.count({
        where: { createdAt: { gte: twentyFourHoursAgo } },
      }),
      // Items ingested in last 7d
      prisma.sourceItem.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
      // Stories awaiting review
      prisma.storyCluster.count({
        where: {
          status: { in: ['DETECTED', 'CLUSTERED', 'UNDER_REVIEW', 'NEEDS_MORE_EVIDENCE'] },
        },
      }),
      // Stories approved (verified for publication)
      prisma.storyCluster.count({
        where: { status: 'VERIFIED_FOR_PUBLICATION' },
      }),
      // Stories published or updated
      prisma.storyCluster.count({
        where: { status: { in: ['PUBLISHED', 'UPDATED'] } },
      }),
      // Disputed stories
      prisma.storyCluster.count({
        where: { status: 'DISPUTED' },
      }),
      // Corrected stories
      prisma.storyCluster.count({
        where: { status: 'CORRECTED' },
      }),
      // Retracted stories
      prisma.storyCluster.count({
        where: { status: 'RETRACTED' },
      }),
      // Rejected stories
      prisma.storyCluster.count({
        where: { status: 'REJECTED' },
      }),
      // Active news sources
      prisma.newsSource.count({
        where: { isActive: true },
      }),
      // Failing sources (failureCount > 0)
      prisma.newsSource.count({
        where: { isActive: true, failureCount: { gt: 0 } },
      }),
      // Failed ingestion jobs in 24h
      prisma.ingestionJob.count({
        where: {
          status: 'FAILED',
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
      // Last successful ingestion job
      prisma.ingestionJob.findFirst({
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        select: { id: true, completedAt: true, sourceId: true, itemsNew: true },
      }),
      // Clusters with multi-source duplicate coverage
      prisma.storyCluster.count({
        where: { itemCount: { gte: 2 } },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        ingestion: {
          itemsIngested24h: items24h,
          itemsIngested7d: items7d,
          activeSources: activeSourcesCount,
          failingSources: failingSourcesCount,
          failedJobs24h,
          lastSuccessfulIngestionAt: lastSuccessfulJob?.completedAt || null,
        },
        editorial: {
          awaitingReview: awaitingReviewCount,
          approved: approvedCount,
          published: publishedCount,
          disputed: disputedCount,
          corrected: correctedCount,
          retracted: retractedCount,
          rejected: rejectedCount,
          multiSourceClusters: duplicateCandidateClusters,
        },
      },
      meta: {
        timestamp: now.toISOString(),
        requestId: req.requestId || 'req-unknown',
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to calculate editorial metrics: ${err.message}`,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  }
}

/**
 * Editorial Review Queue
 * Provides rich filtering, sorting, pagination, and evidence summary for editorial staff
 */
export async function getEditorialQueue(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parseResult = EditorialQueueQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid query parameters',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const query = parseResult.data;
  const whereClause: any = {};

  if (query.status) {
    whereClause.status = query.status;
  }

  if (query.category) {
    whereClause.category = { has: query.category };
  }

  if (query.assignedTo) {
    whereClause.assignedTo = query.assignedTo;
  }

  if (query.search && query.search.trim().length > 0) {
    whereClause.OR = [
      { primaryHeadline: { contains: query.search.trim(), mode: 'insensitive' } },
      { summary: { contains: query.search.trim(), mode: 'insensitive' } },
    ];
  }

  if (query.dateFrom || query.dateTo) {
    whereClause.lastObservedAt = {};
    if (query.dateFrom) whereClause.lastObservedAt.gte = query.dateFrom;
    if (query.dateTo) whereClause.lastObservedAt.lte = query.dateTo;
  }

  if (query.sourceId) {
    whereClause.items = {
      some: {
        sourceItem: {
          sourceId: query.sourceId,
        },
      },
    };
  }

  if (query.entityId) {
    whereClause.entityLinks = {
      some: {
        entityId: query.entityId,
      },
    };
  }

  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  try {
    const total = await prisma.storyCluster.count({ where: whereClause });
    const clusters = await prisma.storyCluster.findMany({
      where: whereClause,
      orderBy: [
        { confidenceScore: 'desc' },
        { lastObservedAt: 'desc' },
      ],
      skip,
      take: limit,
      include: {
        items: {
          take: 5,
          include: {
            sourceItem: {
              select: {
                id: true,
                headline: true,
                canonicalUrl: true,
                publishedAt: true,
                source: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    type: true,
                    failureCount: true,
                  },
                },
              },
            },
          },
        },
        claims: {
          take: 3,
          select: {
            id: true,
            claimText: true,
            verificationStatus: true,
            confidenceScore: true,
          },
        },
        entityLinks: {
          include: {
            entity: {
              select: {
                id: true,
                canonicalName: true,
                entityType: true,
                isVerified: true,
              },
            },
          },
        },
      },
    });

    // Enhance response with review priority indicator
    const formatted = clusters.map((c: any) => {
      const isUrgent =
        c.status === 'UNDER_REVIEW' ||
        c.itemCount >= 3 ||
        c.claims.some((cl: any) => cl.verificationStatus === 'DISPUTED');

      return {
        id: c.id,
        clusterSlug: c.clusterSlug,
        primaryHeadline: c.primaryHeadline,
        summary: c.summary,
        category: c.category,
        status: c.status,
        version: c.version,
        assignedTo: c.assignedTo,
        confidenceScore: c.confidenceScore,
        itemCount: c.itemCount,
        reviewPriority: isUrgent ? 'HIGH' : 'NORMAL',
        firstObservedAt: c.firstObservedAt,
        lastObservedAt: c.lastObservedAt,
        publishedAt: c.publishedAt,
        retractedAt: c.retractedAt,
        retractionReason: c.retractionReason,
        correctionNotes: c.correctionNotes,
        reviewNotes: c.reviewNotes,
        sources: c.items.map((it: any) => ({
          itemId: it.sourceItem.id,
          sourceName: it.sourceItem.source.name,
          headline: it.sourceItem.headline,
          canonicalUrl: it.sourceItem.canonicalUrl,
          publishedAt: it.sourceItem.publishedAt,
          sourceType: it.sourceItem.source.type,
          matchRole: it.role,
        })),
        claims: c.claims,
        entities: c.entityLinks.map((el: any) => ({
          id: el.entity.id,
          name: el.entity.canonicalName,
          type: el.entity.entityType,
          isVerified: el.entity.isVerified,
        })),
      };
    });

    res.status(200).json({
      success: true,
      data: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        timestamp: new Date().toISOString(),
        requestId: req.requestId || 'req-unknown',
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: `Failed to fetch editorial queue: ${err.message}`,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  }
}

/**
 * Assign Story Cluster to Reviewer
 */
export async function assignCluster(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const parseResult = AssignStoryClusterSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid assignment payload',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { assignedTo, notes } = parseResult.data;

  try {
    const updated = await defaultStoryClusteringService.assignCluster(id, assignedTo);

    await logAuditEvent({
      action: 'ASSIGN_STORY_CLUSTER',
      entityType: 'StoryCluster',
      entityId: id,
      after: { assignedTo },
      reason: notes || `Assigned to ${assignedTo}`,
      req,
    });

    res.status(200).json({
      success: true,
      data: updated,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: err.message,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  }
}

/**
 * Record Editorial Review Decision
 * Transitions cluster between DETECTED / CLUSTERED / UNDER_REVIEW / VERIFIED_FOR_PUBLICATION / REJECTED / NEEDS_MORE_EVIDENCE
 */
export async function reviewCluster(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const parseResult = EditorialReviewClusterSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid review payload',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { decision, notes, expectedVersion } = parseResult.data;

  // Map review decision to target ClusterLifecycle state
  let targetStatus: ClusterLifecycle;
  switch (decision) {
    case 'APPROVE':
      targetStatus = 'VERIFIED_FOR_PUBLICATION';
      break;
    case 'REJECT':
      targetStatus = 'REJECTED';
      break;
    case 'NEEDS_MORE_EVIDENCE':
      targetStatus = 'NEEDS_MORE_EVIDENCE';
      break;
    case 'DISPUTE':
      targetStatus = 'DISPUTED';
      break;
  }

  try {
    const updated = await defaultStoryClusteringService.transitionClusterStatus(
      id,
      targetStatus,
      notes,
      {
        expectedVersion,
        actorId: req.user?.id,
      }
    );

    await logAuditEvent({
      action: 'EDITORIAL_REVIEW_DECISION',
      entityType: 'StoryCluster',
      entityId: id,
      after: { status: targetStatus, decision },
      reason: notes,
      req,
    });

    res.status(200).json({
      success: true,
      data: updated,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  } catch (err: any) {
    const isConflict = err.message.includes('Conflict:');
    res.status(isConflict ? 409 : 400).json({
      success: false,
      error: err.message,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  }
}

/**
 * Publish Story Cluster
 * Only authorized role (ADMIN / EDITOR with publishing privileges) can publish
 */
export async function publishCluster(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const parseResult = PublishStoryClusterSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid publication payload',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { headline, summary, editorialNotes, expectedVersion } = parseResult.data;

  try {
    const updated = await defaultStoryClusteringService.transitionClusterStatus(
      id,
      'PUBLISHED',
      editorialNotes || 'Approved and published to public feed',
      {
        expectedVersion,
        revisedHeadline: headline,
        revisedSummary: summary,
        actorId: req.user?.id,
      }
    );

    await logAuditEvent({
      action: 'PUBLISH_STORY_CLUSTER',
      entityType: 'StoryCluster',
      entityId: id,
      after: {
        status: 'PUBLISHED',
        publishedAt: updated.publishedAt,
        headline: updated.primaryHeadline,
      },
      reason: editorialNotes || 'Published to public feed',
      req,
    });

    res.status(200).json({
      success: true,
      data: updated,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  } catch (err: any) {
    const isConflict = err.message.includes('Conflict:');
    res.status(isConflict ? 409 : 400).json({
      success: false,
      error: err.message,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  }
}

/**
 * Retract Published Story Cluster
 * Preserves historical version while marking as retracted and recording public retraction notice
 */
export async function retractCluster(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const parseResult = RetractStoryClusterSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid retraction payload',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { reason, editorialNotes, expectedVersion } = parseResult.data;

  try {
    const updated = await defaultStoryClusteringService.transitionClusterStatus(
      id,
      'RETRACTED',
      reason,
      {
        expectedVersion,
        actorId: req.user?.id,
      }
    );

    await logAuditEvent({
      action: 'RETRACT_STORY_CLUSTER',
      entityType: 'StoryCluster',
      entityId: id,
      after: {
        status: 'RETRACTED',
        retractedAt: updated.retractedAt,
        retractionReason: reason,
      },
      reason: editorialNotes || reason,
      req,
    });

    res.status(200).json({
      success: true,
      data: updated,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  } catch (err: any) {
    const isConflict = err.message.includes('Conflict:');
    res.status(isConflict ? 409 : 400).json({
      success: false,
      error: err.message,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  }
}

/**
 * Record Correction on Published Story Cluster
 * Preserves historical record while updating content and publishing a correction notice
 */
export async function correctCluster(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const parseResult = CorrectStoryClusterSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid correction payload',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { correctionNotice, revisedHeadline, revisedSummary, editorialNotes, expectedVersion } = parseResult.data;

  try {
    const updated = await defaultStoryClusteringService.transitionClusterStatus(
      id,
      'CORRECTED',
      correctionNotice,
      {
        expectedVersion,
        revisedHeadline,
        revisedSummary,
        actorId: req.user?.id,
      }
    );

    await logAuditEvent({
      action: 'CORRECT_STORY_CLUSTER',
      entityType: 'StoryCluster',
      entityId: id,
      after: {
        status: 'CORRECTED',
        correctionNotes: correctionNotice,
        primaryHeadline: updated.primaryHeadline,
      },
      reason: editorialNotes || correctionNotice,
      req,
    });

    res.status(200).json({
      success: true,
      data: updated,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  } catch (err: any) {
    const isConflict = err.message.includes('Conflict:');
    res.status(isConflict ? 409 : 400).json({
      success: false,
      error: err.message,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  }
}
