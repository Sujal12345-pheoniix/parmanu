import { Response } from 'express';
import { prisma } from '../prisma/client';
import { AuthenticatedRequest } from '../security/auth';
import { logAuditEvent } from '../audit/audit.service';
import {
  StoryClusterQuerySchema,
  MergeClustersSchema,
  SplitClusterSchema,
  ClusterLifecycleSchema,
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
  const result = await defaultSearchService.searchStoryClusters({
    query: query.search,
    category: query.category,
    status: query.status,
    entityId: query.entityId,
    minConfidence: query.minConfidence,
    page: query.page,
    limit: query.limit,
  });

  res.status(200).json({
    success: true,
    data: result.items,
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

  if (!cluster) {
    res.status(404).json({
      success: false,
      error: 'Story cluster not found',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: cluster,
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
    const inputItems = cluster.items.map((i) => ({
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
