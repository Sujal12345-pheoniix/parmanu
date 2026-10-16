import { Response } from 'express';
import { prisma } from '../prisma/client';
import { AuthenticatedRequest } from '../security/auth';
import { CreateBookmarkSchema, BookmarkQuerySchema } from '@parmanu/types';

export async function listBookmarks(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required to view bookmarks',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const parseResult = BookmarkQuerySchema.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid query parameters',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { page, limit } = parseResult.data;
  const skip = (page - 1) * limit;

  const [total, bookmarks] = await Promise.all([
    prisma.bookmark.count({
      where: { userId: req.user.id },
    }),
    prisma.bookmark.findMany({
      where: { userId: req.user.id },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        storyCluster: {
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
          },
        },
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
    }),
  ]);

  res.status(200).json({
    success: true,
    data: bookmarks,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'req-unknown',
    },
  });
}

export async function createBookmark(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required to save bookmarks',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const parseResult = CreateBookmarkSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid bookmark payload',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { storyClusterId, sourceItemId, storyId } = parseResult.data;

  // Validate existence of target
  if (storyClusterId) {
    const cluster = await prisma.storyCluster.findUnique({
      where: { id: storyClusterId },
    });
    if (!cluster) {
      res.status(404).json({
        success: false,
        error: 'Story cluster not found',
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
      });
      return;
    }
  }

  if (sourceItemId) {
    const item = await prisma.sourceItem.findUnique({
      where: { id: sourceItemId },
    });
    if (!item) {
      res.status(404).json({
        success: false,
        error: 'Source item not found',
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
      });
      return;
    }
  }

  // Upsert or create bookmark
  try {
    let bookmark;
    if (storyClusterId) {
      bookmark = await prisma.bookmark.upsert({
        where: {
          userId_storyClusterId: {
            userId: req.user.id,
            storyClusterId,
          },
        },
        update: {},
        create: {
          userId: req.user.id,
          storyClusterId,
        },
      });
    } else if (sourceItemId) {
      bookmark = await prisma.bookmark.upsert({
        where: {
          userId_sourceItemId: {
            userId: req.user.id,
            sourceItemId,
          },
        },
        update: {},
        create: {
          userId: req.user.id,
          sourceItemId,
        },
      });
    } else if (storyId) {
      bookmark = await prisma.bookmark.upsert({
        where: {
          userId_storyId: {
            userId: req.user.id,
            storyId,
          },
        },
        update: {},
        create: {
          userId: req.user.id,
          storyId,
        },
      });
    }

    res.status(201).json({
      success: true,
      data: bookmark,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to create bookmark: ' + error.message,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  }
}

export async function deleteBookmark(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required to remove bookmark',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { id } = req.params;

  // Check if id is a Bookmark ID or a storyClusterId
  const bookmark = await prisma.bookmark.findFirst({
    where: {
      userId: req.user.id,
      OR: [{ id }, { storyClusterId: id }, { sourceItemId: id }],
    },
  });

  if (!bookmark) {
    res.status(404).json({
      success: false,
      error: 'Bookmark not found',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  await prisma.bookmark.delete({
    where: { id: bookmark.id },
  });

  res.status(200).json({
    success: true,
    data: { id: bookmark.id, deleted: true },
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
  });
}

export async function checkBookmark(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(200).json({
      success: true,
      data: { isBookmarked: false },
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { storyClusterId } = req.params;

  const bookmark = await prisma.bookmark.findFirst({
    where: {
      userId: req.user.id,
      storyClusterId,
    },
  });

  res.status(200).json({
    success: true,
    data: {
      isBookmarked: Boolean(bookmark),
      bookmarkId: bookmark?.id,
    },
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
  });
}
