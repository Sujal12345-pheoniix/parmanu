import { Response } from 'express';
import { prisma } from '../prisma/client';
import { AuthenticatedRequest } from '../security/auth';
import { logAuditEvent } from '../audit/audit.service';
import {
  StoryClusterQuerySchema,
  MergeClustersSchema,
  SplitClusterSchema,
  ClusterLifecycleSchema,
  ClusterLifecycle,
} from '@parmanu/types';
import { defaultStoryClusteringService } from '../intelligence/story-clustering.service';
import { defaultSearchService } from '../intelligence/search.service';
import { defaultAiIntelligenceService } from '../intelligence/ai-intelligence.service';

export async function listStoryClusters(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parseResult = StoryClusterQuerySchema.safeParse(req.query);
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
  const isPrivileged = req.user && (req.user.role === 'EDITOR' || req.user.role === 'ADMIN');
  const allowedStatuses: ClusterLifecycle[] | undefined = isPrivileged
    ? undefined
    : ['PUBLISHED', 'UPDATED', 'CORRECTED', 'RETRACTED'];

  const result = await defaultSearchService.searchStoryClusters({
    query: query.search,
    category: query.category,
    status: query.status,
    allowedStatuses,
    entityId: query.entityId,
    minConfidence: query.minConfidence,
    page: query.page,
    limit: query.limit,
  });

  // If not privileged, strip private editorial fields
  const formattedItems = result.items.map((item: any) => {
    if (!isPrivileged) {
      const { reviewNotes, assignedTo, ...cleanItem } = item;
      return cleanItem;
    }
    return item;
  });

  res.status(200).json({
    success: true,
    data: formattedItems,
    meta: {
      page: result.page,
      limit: result.limit,
      total: result.total,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'req-unknown',
    },
  });
}

export async function getStoryClusterById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const isPrivileged = req.user && (req.user.role === 'EDITOR' || req.user.role === 'ADMIN');

  const cluster = await prisma.storyCluster.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          sourceItem: {
            include: {
              source: true,
            },
          },
        },
      },
      claims: {
        include: {
          evidenceRecords: {
            include: {
              sourceItem: true,
            },
          },
        },
      },
      entityLinks: {
        include: {
          entity: true,
        },
      },
      mergeSplitLogs: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const publicStatuses = ['PUBLISHED', 'UPDATED', 'CORRECTED', 'RETRACTED'];
  if (!cluster || (!isPrivileged && !publicStatuses.includes(cluster.status as any))) {
    res.status(404).json({
      success: false,
      error: 'Story cluster not found',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  let responseData: any = cluster;
  if (!isPrivileged) {
    responseData = {
      id: cluster.id,
      clusterSlug: cluster.clusterSlug,
      primaryHeadline: cluster.primaryHeadline,
      summary: cluster.summary,
      category: cluster.category,
      status: cluster.status,
      firstObservedAt: cluster.firstObservedAt,
      lastObservedAt: cluster.lastObservedAt,
      publishedAt: cluster.publishedAt,
      retractedAt: cluster.retractedAt,
      retractionReason: cluster.retractionReason,
      correctionNotes: cluster.correctionNotes,
      itemCount: cluster.itemCount,
      sources: cluster.items.map((it: any) => ({
        itemId: it.sourceItem.id,
        headline: it.sourceItem.headline,
        canonicalUrl: it.sourceItem.canonicalUrl,
        publishedAt: it.sourceItem.publishedAt,
        author: it.sourceItem.author,
        source: {
          name: it.sourceItem.source.name,
          attributionName: it.sourceItem.source.attributionName,
          attributionUrl: it.sourceItem.source.attributionUrl,
        },
        role: it.role,
      })),
      claims: cluster.claims.map((cl: any) => ({
        id: cl.id,
        claimText: cl.claimText,
        claimType: cl.claimType,
        verificationStatus: cl.verificationStatus,
        assertedAt: cl.assertedAt,
        resolvedAt: cl.resolvedAt,
        evidence: cl.evidenceRecords.map((ev: any) => ({
          stance: ev.stance,
          quoteExcerpt: ev.quoteExcerpt,
          sourceIndependence: ev.sourceIndependence,
          sourceUrl: ev.sourceItem.canonicalUrl,
          sourceHeadline: ev.sourceItem.headline,
        })),
      })),
      entities: cluster.entityLinks.map((el: any) => ({
        name: el.entity.canonicalName,
        type: el.entity.entityType,
        isVerified: el.entity.isVerified,
      })),
    };
  }

  res.status(200).json({
    success: true,
    data: responseData,
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
  });
}

export async function mergeClusters(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parseResult = MergeClustersSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { primaryClusterId, secondaryClusterId, reason } = parseResult.data;

  try {
    const outcome = await defaultStoryClusteringService.mergeClusters({
      primaryClusterId,
      secondaryClusterId,
      reason,
      actorId: req.user?.id,
      actorRole: req.user?.role,
    });

    await logAuditEvent({
      action: 'MERGE_STORY_CLUSTERS',
      entityType: 'StoryCluster',
      entityId: primaryClusterId,
      before: { secondaryClusterId },
      after: outcome,
      reason,
      req,
    });

    res.status(200).json({
      success: true,
      data: outcome,
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

export async function splitCluster(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const parseResult = SplitClusterSchema.safeParse({ ...req.body, sourceClusterId: id });
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { sourceItemIdsToDetach, newClusterHeadline, reason } = parseResult.data;

  try {
    const outcome = await defaultStoryClusteringService.splitCluster({
      sourceClusterId: id,
      sourceItemIdsToDetach,
      newClusterHeadline,
      reason,
      actorId: req.user?.id,
      actorRole: req.user?.role,
    });

    await logAuditEvent({
      action: 'SPLIT_STORY_CLUSTER',
      entityType: 'StoryCluster',
      entityId: id,
      after: outcome,
      reason,
      req,
    });

    res.status(200).json({
      success: true,
      data: outcome,
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

export async function updateClusterStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, reason } = req.body;

  const validStatus = ClusterLifecycleSchema.safeParse(status);
  if (!validStatus.success) {
    res.status(400).json({
      success: false,
      error: `Invalid status: ${status}`,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  try {
    const updated = await defaultStoryClusteringService.transitionClusterStatus(
      id,
      validStatus.data,
      reason
    );

    await logAuditEvent({
      action: 'UPDATE_CLUSTER_STATUS',
      entityType: 'StoryCluster',
      entityId: id,
      after: updated,
      reason,
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

export async function generateDraftSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const cluster = await prisma.storyCluster.findUnique({
    where: { id },
    include: {
      items: {
        include: { sourceItem: true },
      },
    },
  });

  if (!cluster) {
    res.status(404).json({
      success: false,
      error: 'Story cluster not found',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  try {
    const inputItems = cluster.items.map((i: any) => ({
      id: i.sourceItem.id,
      headline: i.sourceItem.headline,
      excerpt: i.sourceItem.excerpt,
      author: i.sourceItem.author,
    }));

    const draft = await defaultAiIntelligenceService.generateClusterSummary(inputItems);

    res.status(200).json({
      success: true,
      data: draft,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  }
}
