import { Response } from 'express';
import { NewsFeedQuerySchema } from '@parmanu/types';
import { prisma } from '../prisma/client';
import { AuthenticatedRequest } from '../security/auth';

export async function listSourceItems(req: AuthenticatedRequest, res: Response): Promise<void> {
  const queryResult = NewsFeedQuerySchema.safeParse(req.query);
  if (!queryResult.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid query parameters',
      details: queryResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { category, state, provenance, page, limit, search } = queryResult.data;
  const skip = (page - 1) * limit;

  const isPrivileged = req.user && (req.user.role === 'EDITOR' || req.user.role === 'ADMIN');
  const whereClause: any = {
    processingState: isPrivileged ? (state || 'APPROVED') : 'APPROVED',
  };

  if (category) {
    whereClause.category = {
      has: category,
    };
  }

  if (provenance) {
    whereClause.provenanceState = provenance;
  }

  if (search) {
    whereClause.OR = [
      { headline: { contains: search, mode: 'insensitive' } },
      { excerpt: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.sourceItem.findMany({
      where: whereClause,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
      include: {
        source: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            attributionName: true,
            attributionUrl: true,
          },
        },
        evidenceLinks: {
          select: {
            id: true,
            relationshipType: true,
            evidenceStatus: true,
            observedAt: true,
          },
        },
      },
    }),
    prisma.sourceItem.count({ where: whereClause }),
  ]);

  res.status(200).json({
    success: true,
    data: items,
    meta: {
      page,
      limit,
      total,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'req-unknown',
    },
  });
}

export async function getSourceItemById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const item = await prisma.sourceItem.findUnique({
    where: { id },
    include: {
      source: true,
      evidenceLinks: {
        include: {
          collaborationClaim: {
            include: {
              creatorProfile: true,
              brandProfile: true,
            },
          },
          editorialStory: true,
        },
      },
    },
  });

  const isPrivileged = req.user && (req.user.role === 'EDITOR' || req.user.role === 'ADMIN');
  if (!item || (!isPrivileged && item.processingState !== 'APPROVED')) {
    res.status(404).json({
      success: false,
      error: 'Source item not found',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: item,
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
  });
}
