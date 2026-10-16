import { Response } from 'express';
import { prisma } from '../prisma/client';
import { AuthenticatedRequest } from '../security/auth';
import { TrendingStoriesQuerySchema, ConsumerSearchQuerySchema } from '@parmanu/types';

export async function getTrendingStories(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parseResult = TrendingStoriesQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid query parameters',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { category, limit } = parseResult.data;

  const whereClause: any = {
    status: { in: ['PUBLISHED', 'UPDATED', 'CORRECTED'] },
  };

  if (category && category !== 'ALL') {
    whereClause.category = { has: category.toUpperCase() };
  }

  const clusters = await prisma.storyCluster.findMany({
    where: whereClause,
    take: limit,
    orderBy: [
      { itemCount: 'desc' },
      { confidenceScore: 'desc' },
      { lastObservedAt: 'desc' },
    ],
    select: {
      id: true,
      clusterSlug: true,
      primaryHeadline: true,
      summary: true,
      category: true,
      confidenceScore: true,
      itemCount: true,
      firstObservedAt: true,
      lastObservedAt: true,
      publishedAt: true,
      status: true,
      correctionNotes: true,
      items: {
        take: 5,
        include: {
          sourceItem: {
            select: {
              id: true,
              headline: true,
              canonicalUrl: true,
              publishedAt: true,
              provenanceState: true,
              source: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  type: true,
                },
              },
            },
          },
        },
      },
      entityLinks: {
        take: 5,
        include: {
          entity: {
            select: {
              id: true,
              slug: true,
              canonicalName: true,
              entityType: true,
              isVerified: true,
            },
          },
        },
      },
    },
  });

  res.status(200).json({
    success: true,
    data: clusters,
    meta: {
      total: clusters.length,
      limit,
      category: category || 'ALL',
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'req-unknown',
    },
  });
}

export async function getFeaturedStory(req: AuthenticatedRequest, res: Response): Promise<void> {
  const cluster = await prisma.storyCluster.findFirst({
    where: {
      status: { in: ['PUBLISHED', 'UPDATED', 'CORRECTED'] },
    },
    orderBy: [
      { confidenceScore: 'desc' },
      { itemCount: 'desc' },
      { lastObservedAt: 'desc' },
    ],
    select: {
      id: true,
      clusterSlug: true,
      primaryHeadline: true,
      summary: true,
      category: true,
      confidenceScore: true,
      itemCount: true,
      firstObservedAt: true,
      lastObservedAt: true,
      publishedAt: true,
      status: true,
      correctionNotes: true,
      items: {
        take: 10,
        include: {
          sourceItem: {
            select: {
              id: true,
              headline: true,
              excerpt: true,
              canonicalUrl: true,
              publishedAt: true,
              provenanceState: true,
              source: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  type: true,
                },
              },
            },
          },
        },
      },
      claims: {
        take: 6,
        select: {
          id: true,
          claimText: true,
          claimType: true,
          verificationStatus: true,
          confidenceScore: true,
          evidenceRecords: {
            take: 3,
            select: {
              id: true,
              stance: true,
              quoteExcerpt: true,
              sourceItem: {
                select: {
                  id: true,
                  canonicalUrl: true,
                  source: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      entityLinks: {
        take: 8,
        include: {
          entity: {
            select: {
              id: true,
              slug: true,
              canonicalName: true,
              entityType: true,
              isVerified: true,
            },
          },
        },
      },
    },
  });

  if (!cluster) {
    res.status(404).json({
      success: false,
      error: 'No published featured story available',
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

export async function getCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
  const publishedStories = await prisma.storyCluster.findMany({
    where: {
      status: { in: ['PUBLISHED', 'UPDATED', 'CORRECTED'] },
    },
    select: {
      category: true,
    },
  });

  const categoryCountMap = new Map<string, number>();
  for (const story of publishedStories) {
    if (Array.isArray(story.category)) {
      for (const cat of story.category) {
        const normalized = cat.trim().toUpperCase();
        if (normalized) {
          categoryCountMap.set(normalized, (categoryCountMap.get(normalized) || 0) + 1);
        }
      }
    }
  }

  const categories = Array.from(categoryCountMap.entries())
    .map(([name, count]) => ({
      name,
      slug: name.toLowerCase().replace(/_/g, '-'),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  res.status(200).json({
    success: true,
    data: categories,
    meta: {
      totalCategories: categories.length,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'req-unknown',
    },
  });
}

export async function globalSearch(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parseResult = ConsumerSearchQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid search query',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { q, category, page, limit } = parseResult.data;
  const skip = (page - 1) * limit;

  const clusterWhere: any = {
    status: { in: ['PUBLISHED', 'UPDATED', 'CORRECTED'] },
    OR: [
      { primaryHeadline: { contains: q, mode: 'insensitive' } },
      { summary: { contains: q, mode: 'insensitive' } },
    ],
  };

  if (category && category !== 'ALL') {
    clusterWhere.category = { has: category.toUpperCase() };
  }

  const [clusterCount, clusters, entities] = await Promise.all([
    prisma.storyCluster.count({ where: clusterWhere }),
    prisma.storyCluster.findMany({
      where: clusterWhere,
      skip,
      take: limit,
      orderBy: [{ lastObservedAt: 'desc' }],
      select: {
        id: true,
        clusterSlug: true,
        primaryHeadline: true,
        summary: true,
        category: true,
        confidenceScore: true,
        itemCount: true,
        publishedAt: true,
        status: true,
        items: {
          take: 3,
          include: {
            sourceItem: {
              select: {
                id: true,
                headline: true,
                canonicalUrl: true,
                source: {
                  select: {
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.entityRegistry.findMany({
      where: {
        OR: [
          { canonicalName: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
          { aliases: { has: q } },
        ],
      },
      take: 5,
      select: {
        id: true,
        slug: true,
        canonicalName: true,
        entityType: true,
        isVerified: true,
      },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      clusters,
      entities,
    },
    meta: {
      query: q,
      category: category || 'ALL',
      page,
      limit,
      totalClusters: clusterCount,
      totalEntities: entities.length,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'req-unknown',
    },
  });
}
