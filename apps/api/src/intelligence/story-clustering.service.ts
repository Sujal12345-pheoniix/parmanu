import { prisma } from '../prisma/client';
import {
  ClusterLifecycle,
  ClusterItemRole,
} from '@parmanu/types';
import {
  defaultDeduplicationService,
  DeduplicationService,
  CandidateItem,
  DeduplicationMatchCategory,
} from './deduplication.service';

/**
 * Permitted forward and branch transitions in the Story Cluster lifecycle
 */
const VALID_TRANSITIONS: Record<ClusterLifecycle, ClusterLifecycle[]> = {
  DETECTED: ['CLUSTERED', 'UNDER_REVIEW', 'ARCHIVED'],
  CLUSTERED: ['UNDER_REVIEW', 'VERIFIED_FOR_PUBLICATION', 'ARCHIVED'],
  UNDER_REVIEW: ['VERIFIED_FOR_PUBLICATION', 'CLUSTERED', 'DISPUTED', 'ARCHIVED'],
  VERIFIED_FOR_PUBLICATION: ['PUBLISHED', 'UNDER_REVIEW', 'ARCHIVED'],
  PUBLISHED: ['UPDATED', 'DISPUTED', 'CORRECTED', 'RETRACTED', 'ARCHIVED'],
  UPDATED: ['DISPUTED', 'CORRECTED', 'RETRACTED', 'ARCHIVED'],
  DISPUTED: ['UNDER_REVIEW', 'CORRECTED', 'RETRACTED', 'ARCHIVED'],
  CORRECTED: ['UPDATED', 'ARCHIVED'],
  RETRACTED: ['ARCHIVED'],
  ARCHIVED: [],
};

export class StoryClusteringService {
  constructor(private deduplicationService: DeduplicationService = defaultDeduplicationService) {}

  /**
   * Generates a deterministic slug for a story cluster
   */
  private generateSlug(headline: string): string {
    const base = headline
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 70);
    const suffix = Math.random().toString(36).substring(2, 7);
    return `${base || 'story'}-${suffix}`;
  }

  /**
   * Validates whether a lifecycle state transition is permitted
   */
  public isValidTransition(current: ClusterLifecycle, target: ClusterLifecycle): boolean {
    if (current === target) return true;
    const allowed = VALID_TRANSITIONS[current];
    return allowed ? allowed.includes(target) : false;
  }

  /**
   * Ingests a new SourceItem into the clustering engine:
   * Finds matching active clusters, attaches item or creates new cluster.
   */
  public async clusterSourceItem(sourceItemId: string): Promise<{
    clusterId: string;
    action: 'ATTACHED' | 'CREATED';
    matchReason: string;
    confidence: number;
  }> {
    const item = await prisma.sourceItem.findUnique({
      where: { id: sourceItemId },
      include: { source: true },
    });

    if (!item) {
      throw new Error(`SourceItem with id ${sourceItemId} not found`);
    }

    const candidateItem: CandidateItem = {
      id: item.id,
      sourceId: item.sourceId,
      canonicalUrl: item.canonicalUrl,
      headline: item.headline,
      excerpt: item.excerpt,
      publishedAt: item.publishedAt,
      author: item.author,
      category: item.category,
    };

    // Look for active clusters from the last 72 hours
    const windowStart = new Date(item.publishedAt.getTime() - 72 * 60 * 60 * 1000);
    const candidateClusters = await prisma.storyCluster.findMany({
      where: {
        lastObservedAt: { gte: windowStart },
        status: { notIn: ['RETRACTED', 'ARCHIVED'] },
      },
      include: {
        items: {
          include: { sourceItem: true },
          take: 5,
        },
      },
      orderBy: { lastObservedAt: 'desc' },
      take: 20,
    });

    let bestCluster: (typeof candidateClusters)[0] | null = null;
    let bestMatchResult: any = null;
    let highestConfidence = 0;

    for (const cluster of candidateClusters) {
      if (cluster.isManuallyLocked) continue;

      for (const clusterItem of cluster.items) {
        const clusterSourceItem: CandidateItem = {
          id: clusterItem.sourceItem.id,
          sourceId: clusterItem.sourceItem.sourceId,
          canonicalUrl: clusterItem.sourceItem.canonicalUrl,
          headline: clusterItem.sourceItem.headline,
          excerpt: clusterItem.sourceItem.excerpt,
          publishedAt: clusterItem.sourceItem.publishedAt,
          author: clusterItem.sourceItem.author,
          category: clusterItem.sourceItem.category,
        };

        const evalResult = this.deduplicationService.evaluatePair(candidateItem, clusterSourceItem);

        if (evalResult.shouldCluster && evalResult.confidence > highestConfidence) {
          highestConfidence = evalResult.confidence;
          bestCluster = cluster;
          bestMatchResult = evalResult;
        }
      }
    }

    // Attach to best existing cluster if confidence meets threshold
    if (bestCluster && bestMatchResult && highestConfidence >= 0.65) {
      let role: ClusterItemRole = 'CORROBORATING';
      if (bestMatchResult.category === DeduplicationMatchCategory.STORY_UPDATE) {
        role = 'UPDATE';
      } else if (bestMatchResult.category === DeduplicationMatchCategory.CORRECTION_OR_RETRACTION) {
        role = 'UPDATE';
      }

      await prisma.storyClusterItem.create({
        data: {
          storyClusterId: bestCluster.id,
          sourceItemId: item.id,
          role,
          confidence: highestConfidence,
          matchReason: bestMatchResult.matchReason,
        },
      });

      // Recalculate cluster metadata
      const newCount = bestCluster.itemCount + 1;
      const combinedCategories = Array.from(new Set([...bestCluster.category, ...item.category]));

      let updatedStatus: ClusterLifecycle = bestCluster.status;
      if (bestCluster.status === 'DETECTED' && newCount >= 2) {
        updatedStatus = 'CLUSTERED';
      } else if (bestCluster.status === 'PUBLISHED' && role === 'UPDATE') {
        updatedStatus = 'UPDATED';
      }

      await prisma.storyCluster.update({
        where: { id: bestCluster.id },
        data: {
          itemCount: newCount,
          lastObservedAt: item.publishedAt > bestCluster.lastObservedAt ? item.publishedAt : bestCluster.lastObservedAt,
          category: combinedCategories,
          status: updatedStatus,
          confidenceScore: Number(Math.min(1.0, (bestCluster.confidenceScore + highestConfidence) / 2).toFixed(2)),
        },
      });

      return {
        clusterId: bestCluster.id,
        action: 'ATTACHED',
        matchReason: bestMatchResult.matchReason,
        confidence: highestConfidence,
      };
    }

    // Otherwise create a new story cluster
    const newCluster = await prisma.storyCluster.create({
      data: {
        clusterSlug: this.generateSlug(item.headline),
        primaryHeadline: item.headline,
        summary: item.excerpt || `Initial report on: ${item.headline}`,
        category: item.category,
        status: 'DETECTED',
        confidenceScore: 0.5,
        firstObservedAt: item.publishedAt,
        lastObservedAt: item.publishedAt,
        itemCount: 1,
        items: {
          create: {
            sourceItemId: item.id,
            role: 'PRIMARY',
            confidence: 1.0,
            matchReason: 'Origin primary source item for detected event',
          },
        },
      },
    });

    return {
      clusterId: newCluster.id,
      action: 'CREATED',
      matchReason: 'No existing cluster matched confidence threshold (>0.65)',
      confidence: 1.0,
    };
  }

  /**
   * Merges a secondary cluster into a primary cluster with full audit logging
   */
  public async mergeClusters(params: {
    primaryClusterId: string;
    secondaryClusterId: string;
    reason: string;
    actorId?: string;
    actorRole?: string;
  }): Promise<{ success: boolean; primaryClusterId: string; movedItemCount: number }> {
    const { primaryClusterId, secondaryClusterId, reason, actorId, actorRole } = params;

    if (primaryClusterId === secondaryClusterId) {
      throw new Error('Cannot merge a cluster into itself');
    }

    const [primary, secondary] = await Promise.all([
      prisma.storyCluster.findUnique({
        where: { id: primaryClusterId },
        include: { items: true },
      }),
      prisma.storyCluster.findUnique({
        where: { id: secondaryClusterId },
        include: { items: true, claims: true, entityLinks: true },
      }),
    ]);

    if (!primary || !secondary) {
      throw new Error('One or both clusters not found');
    }

    // Transfer items
    const existingItemIds = new Set(primary.items.map((i) => i.sourceItemId));
    let movedCount = 0;

    for (const item of secondary.items) {
      if (!existingItemIds.has(item.sourceItemId)) {
        await prisma.storyClusterItem.create({
          data: {
            storyClusterId: primary.id,
            sourceItemId: item.sourceItemId,
            role: 'CORROBORATING',
            confidence: item.confidence,
            matchReason: `Manual merge: ${reason}`,
          },
        });
        movedCount++;
      }
    }

    // Transfer claims
    for (const claim of secondary.claims) {
      await prisma.storyClaim.update({
        where: { id: claim.id },
        data: { storyClusterId: primary.id },
      });
    }

    // Log the merge
    await prisma.clusterMergeSplitLog.create({
      data: {
        action: 'MERGE',
        targetClusterId: primary.id,
        sourceClusterId: secondary.id,
        reason,
        actorId,
        actorRole,
        metadata: {
          secondarySlug: secondary.clusterSlug,
          movedItemCount: movedCount,
        },
      },
    });

    // Update primary count and archive secondary
    await Promise.all([
      prisma.storyCluster.update({
        where: { id: primary.id },
        data: {
          itemCount: primary.items.length + movedCount,
          lastObservedAt: secondary.lastObservedAt > primary.lastObservedAt ? secondary.lastObservedAt : primary.lastObservedAt,
        },
      }),
      prisma.storyCluster.update({
        where: { id: secondary.id },
        data: {
          status: 'ARCHIVED',
        },
      }),
    ]);

    return {
      success: true,
      primaryClusterId: primary.id,
      movedItemCount: movedCount,
    };
  }

  /**
   * Splits specified source items from an existing cluster into a new story cluster
   */
  public async splitCluster(params: {
    sourceClusterId: string;
    sourceItemIdsToDetach: string[];
    newClusterHeadline: string;
    reason: string;
    actorId?: string;
    actorRole?: string;
  }): Promise<{ success: boolean; newClusterId: string; detachedCount: number }> {
    const { sourceClusterId, sourceItemIdsToDetach, newClusterHeadline, reason, actorId, actorRole } = params;

    const sourceCluster = await prisma.storyCluster.findUnique({
      where: { id: sourceClusterId },
      include: { items: { include: { sourceItem: true } } },
    });

    if (!sourceCluster) {
      throw new Error(`Cluster ${sourceClusterId} not found`);
    }

    if (sourceCluster.items.length <= sourceItemIdsToDetach.length) {
      throw new Error('Cannot detach all items from a cluster; use cluster archive or update instead');
    }

    // Create the new cluster
    const newCluster = await prisma.storyCluster.create({
      data: {
        clusterSlug: this.generateSlug(newClusterHeadline),
        primaryHeadline: newClusterHeadline,
        summary: `Split cluster: ${newClusterHeadline}`,
        category: sourceCluster.category,
        status: 'CLUSTERED',
        confidenceScore: 0.7,
        itemCount: sourceItemIdsToDetach.length,
      },
    });

    // Move cluster items
    for (const itemId of sourceItemIdsToDetach) {
      await prisma.storyClusterItem.deleteMany({
        where: { storyClusterId: sourceCluster.id, sourceItemId: itemId },
      });

      await prisma.storyClusterItem.create({
        data: {
          storyClusterId: newCluster.id,
          sourceItemId: itemId,
          role: 'PRIMARY',
          confidence: 0.9,
          matchReason: `Manual cluster split: ${reason}`,
        },
      });
    }

    // Update remaining count on source cluster
    await prisma.storyCluster.update({
      where: { id: sourceCluster.id },
      data: {
        itemCount: sourceCluster.items.length - sourceItemIdsToDetach.length,
      },
    });

    // Record audit log
    await prisma.clusterMergeSplitLog.create({
      data: {
        action: 'SPLIT',
        targetClusterId: newCluster.id,
        sourceClusterId: sourceCluster.id,
        reason,
        actorId,
        actorRole,
        metadata: {
          detachedItemIds: sourceItemIdsToDetach,
        },
      },
    });

    return {
      success: true,
      newClusterId: newCluster.id,
      detachedCount: sourceItemIdsToDetach.length,
    };
  }

  /**
   * Updates cluster lifecycle state after verifying valid transition
   */
  public async transitionClusterStatus(
    clusterId: string,
    newStatus: ClusterLifecycle,
    reason?: string
  ): Promise<any> {
    const cluster = await prisma.storyCluster.findUnique({ where: { id: clusterId } });
    if (!cluster) {
      throw new Error('Cluster not found');
    }

    if (!this.isValidTransition(cluster.status as ClusterLifecycle, newStatus)) {
      throw new Error(
        `Invalid lifecycle transition from ${cluster.status} to ${newStatus}. Permitted: ${VALID_TRANSITIONS[cluster.status as ClusterLifecycle]?.join(', ')}`
      );
    }

    return await prisma.storyCluster.update({
      where: { id: clusterId },
      data: {
        status: newStatus,
        ...(reason && { summary: `${cluster.summary || ''}\n[Status Note: ${reason}]`.trim() }),
      },
    });
  }
}

export const defaultStoryClusteringService = new StoryClusteringService();
