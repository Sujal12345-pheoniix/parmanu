import { prisma } from '../prisma/client';
import { ClusterLifecycle, ClaimVerificationStatus } from '@parmanu/types';

export interface SearchStoriesFilter {
  query?: string;
  category?: string;
  status?: ClusterLifecycle;
  allowedStatuses?: ClusterLifecycle[];
  entityId?: string;
  minConfidence?: number;
  fromDate?: Date;
  toDate?: Date;
  page?: number;
  limit?: number;
}

export class SearchService {
  /**
   * High-performance search across StoryClusters and related entities using PostgreSQL indexes
   */
  public async searchStoryClusters(filter: SearchStoriesFilter): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filter.allowedStatuses && filter.allowedStatuses.length > 0) {
      if (filter.status && filter.allowedStatuses.includes(filter.status)) {
        where.status = filter.status;
      } else {
        where.status = { in: filter.allowedStatuses };
      }
    } else if (filter.status) {
      where.status = filter.status;
    } else {
      where.status = { not: 'ARCHIVED' };
    }

    if (filter.category && filter.category !== 'all') {
      const cat = filter.category.toLowerCase();
      const categoryMap: Record<string, string[]> = {
        creator: ['creator', 'Creator', 'Creator Economy', 'creator-economy', 'Influencer', 'Digital Media', 'Commerce & AdTech', 'Brands', 'Business', 'Podcasting'],
        policy: ['policy', 'Policy', 'Tech', 'Technology', 'Policy & Tech', 'policy-tech', 'National', 'National News', 'India', 'Politics', 'World', 'Government'],
        culture: ['culture', 'Culture', 'Cinema', 'Culture & Cinema', 'culture-cinema', 'Entertainment', 'Arts', 'Bollywood', 'Music', 'Comedy'],
        investigative: ['investigative', 'Investigative', 'Investigation', 'Special Report', 'Audit', 'Economy', 'Markets', 'Crime'],
        climate: ['climate', 'Climate', 'Environment', 'climate-environment', 'Weather', 'Science', 'Ecology'],
      };
      const matchedTags = categoryMap[cat] || [filter.category];
      where.category = { hasSome: matchedTags };
    }

    if (filter.minConfidence !== undefined) {
      where.confidenceScore = { gte: filter.minConfidence };
    }

    if (filter.fromDate || filter.toDate) {
      where.lastObservedAt = {};
      if (filter.fromDate) where.lastObservedAt.gte = filter.fromDate;
      if (filter.toDate) where.lastObservedAt.lte = filter.toDate;
    }

    if (filter.entityId) {
      where.entityLinks = {
        some: { entityId: filter.entityId },
      };
    }

    if (filter.query && filter.query.trim().length > 0) {
      const q = filter.query.trim();
      where.OR = [
        { primaryHeadline: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.storyCluster.findMany({
        where,
        skip,
        take: limit,
        orderBy: { lastObservedAt: 'desc' },
        include: {
          items: {
            take: 3,
            include: {
              sourceItem: {
                select: {
                  id: true,
                  headline: true,
                  canonicalUrl: true,
                  publishedAt: true,
                  provenanceState: true,
                  rightsStatus: true,
                  source: {
                    select: {
                      id: true,
                      name: true,
                      type: true,
                    },
                  },
                },
              },
            },
          },
          entityLinks: {
            include: {
              entity: {
                select: {
                  id: true,
                  canonicalName: true,
                  entityType: true,
                  slug: true,
                },
              },
            },
          },
          claims: {
            take: 2,
            select: {
              id: true,
              claimText: true,
              verificationStatus: true,
            },
          },
        },
      }),
      prisma.storyCluster.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }

  /**
   * Search registered entities by canonical name or alias
   */
  public async searchEntities(searchTerm: string, limit: number = 20): Promise<any[]> {
    if (!searchTerm || searchTerm.trim().length === 0) {
      return await prisma.entityRegistry.findMany({
        take: limit,
        orderBy: { canonicalName: 'asc' },
      });
    }

    const q = searchTerm.trim();
    return await prisma.entityRegistry.findMany({
      where: {
        OR: [
          { canonicalName: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q, mode: 'insensitive' } },
          { aliases: { has: q } },
        ],
      },
      take: limit,
      orderBy: { canonicalName: 'asc' },
    });
  }
}

export const defaultSearchService = new SearchService();
