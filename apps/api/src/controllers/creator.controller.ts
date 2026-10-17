import { Response } from 'express';
import { prisma } from '../prisma/client';
import { AuthenticatedRequest } from '../security/auth';
import { logAuditEvent } from '../audit/audit.service';

/**
 * Controller for Creator Profiles, Follows, Interests, and Personalized Feeds
 */

export async function listCreators(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.id;
    const creators = await prisma.creatorProfile.findMany({
      orderBy: [
        { isVerified: 'desc' },
        { displayName: 'asc' },
      ],
      include: {
        claims: {
          take: 3,
          orderBy: { claimDate: 'desc' },
          include: {
            brandProfile: {
              select: { id: true, name: true, slug: true, logoUrl: true, sector: true },
            },
          },
        },
        _count: {
          select: {
            follows: true,
            claims: true,
          },
        },
      },
    });

    let followedIds = new Set<string>();
    if (userId) {
      const userFollows = await prisma.userFollow.findMany({
        where: { userId, creatorProfileId: { not: null } },
        select: { creatorProfileId: true },
      });
      userFollows.forEach((f) => {
        if (f.creatorProfileId) followedIds.add(f.creatorProfileId);
      });
    }

    const data = creators.map((c) => ({
      id: c.id,
      displayName: c.displayName,
      instagramHandle: c.instagramHandle,
      bio: c.bio,
      avatarUrl: c.avatarUrl,
      category: c.category,
      isVerified: c.isVerified,
      followerRange: c.followerRange,
      officialLinks: c.officialLinks,
      followersCount: c._count.follows,
      totalClaimsCount: c._count.claims,
      isFollowedByMe: followedIds.has(c.id),
      recentCollabs: c.claims.map((claim) => ({
        id: claim.id,
        brandName: claim.brandProfile.name,
        brandLogo: claim.brandProfile.logoUrl,
        campaignName: claim.campaignName,
        claimType: claim.claimType,
        provenanceState: claim.provenanceState,
        claimDate: claim.claimDate,
      })),
    }));

    res.status(200).json({
      success: true,
      data,
      meta: {
        total: data.length,
        timestamp: new Date().toISOString(),
        requestId: req.requestId || 'req-unknown',
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve creator profiles',
      message: error.message,
    });
  }
}

export async function toggleFollowCreator(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const { id: creatorProfileId } = req.params;
  const creator = await prisma.creatorProfile.findUnique({
    where: { id: creatorProfileId },
  });

  if (!creator) {
    res.status(404).json({ success: false, error: 'Creator not found' });
    return;
  }

  const existingFollow = await prisma.userFollow.findUnique({
    where: {
      userId_creatorProfileId: {
        userId,
        creatorProfileId,
      },
    },
  });

  if (existingFollow) {
    await prisma.userFollow.delete({
      where: { id: existingFollow.id },
    });

    await logAuditEvent({
      action: 'CREATOR_UNFOLLOW',
      entityType: 'CreatorProfile',
      entityId: creatorProfileId,
      req,
    });

    res.status(200).json({
      success: true,
      data: { isFollowed: false, creatorId: creatorProfileId },
      message: `Unfollowed ${creator.displayName}`,
    });
  } else {
    await prisma.userFollow.create({
      data: {
        userId,
        creatorProfileId,
      },
    });

    await logAuditEvent({
      action: 'CREATOR_FOLLOW',
      entityType: 'CreatorProfile',
      entityId: creatorProfileId,
      req,
    });

    res.status(200).json({
      success: true,
      data: { isFollowed: true, creatorId: creatorProfileId },
      message: `Following ${creator.displayName}`,
    });
  }
}

export async function getUserInterests(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const interests = await prisma.userInterest.findMany({
    where: { userId },
    select: { category: true, weight: true },
  });

  res.status(200).json({
    success: true,
    data: interests.map((i) => i.category),
  });
}

export async function updateUserInterests(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  const { categories } = req.body;
  if (!Array.isArray(categories)) {
    res.status(400).json({ success: false, error: 'categories must be an array of strings' });
    return;
  }

  // Delete existing and bulk create
  await prisma.$transaction([
    prisma.userInterest.deleteMany({ where: { userId } }),
    prisma.userInterest.createMany({
      data: categories.map((cat: string) => ({
        userId,
        category: cat.trim(),
        weight: 1.0,
      })),
    }),
  ]);

  await logAuditEvent({
    action: 'USER_INTERESTS_UPDATE',
    entityType: 'User',
    entityId: userId,
    after: { categories },
    req,
  });

  res.status(200).json({
    success: true,
    data: categories,
    message: 'Interests updated successfully',
  });
}

export async function getPersonalizedFeed(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;

  // 1. If not authenticated, return general creator intelligence
  if (!userId) {
    const [topCreators, recentCollabs, topNews] = await Promise.all([
      prisma.creatorProfile.findMany({
        take: 6,
        orderBy: { isVerified: 'desc' },
      }),
      prisma.collaborationClaim.findMany({
        take: 6,
        orderBy: { claimDate: 'desc' },
        include: {
          creatorProfile: true,
          brandProfile: true,
        },
      }),
      prisma.sourceItem.findMany({
        take: 8,
        where: { processingState: 'APPROVED' },
        orderBy: { publishedAt: 'desc' },
        include: { source: true },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        isPersonalized: false,
        followedCreators: [],
        suggestedCreators: topCreators,
        recentCollabs,
        interestStories: topNews,
        stats: { followedCount: 0, interestCount: 0 },
      },
    });
    return;
  }

  // 2. Authenticated user: retrieve followed creators & user interests
  const [userFollows, userInterests] = await Promise.all([
    prisma.userFollow.findMany({
      where: { userId, creatorProfileId: { not: null } },
      include: {
        creatorProfile: {
          include: {
            claims: {
              take: 5,
              orderBy: { claimDate: 'desc' },
              include: {
                brandProfile: true,
                evidenceLinks: {
                  take: 1,
                  include: { sourceItem: true },
                },
              },
            },
          },
        },
      },
    }),
    prisma.userInterest.findMany({
      where: { userId },
    }),
  ]);

  const followedCreatorIds = userFollows
    .map((f) => f.creatorProfileId)
    .filter((id): id is string => Boolean(id));

  const interestCategories = userInterests.map((i) => i.category);

  // Category mapping for tag matching
  const categoryMap: Record<string, string[]> = {
    creator: ['creator', 'Creator', 'Creator Economy', 'Influencer', 'Digital Media', 'Commerce & AdTech'],
    policy: ['policy', 'Policy', 'Tech', 'Technology', 'Policy & Tech', 'National', 'Politics', 'India'],
    culture: ['culture', 'Culture', 'Cinema', 'Culture & Cinema', 'Entertainment', 'Arts', 'Bollywood'],
    investigative: ['investigative', 'Investigative', 'Investigation', 'Special Report', 'Economy'],
    climate: ['climate', 'Climate', 'Environment', 'Weather', 'Science'],
  };

  const expandedTags: string[] = [];
  interestCategories.forEach((cat) => {
    const lower = cat.toLowerCase();
    if (categoryMap[lower]) {
      expandedTags.push(...categoryMap[lower]);
    } else {
      expandedTags.push(cat);
    }
  });

  // Fetch collabs from followed creators (or all if none followed yet)
  const collabsWhere: any = {};
  if (followedCreatorIds.length > 0) {
    collabsWhere.creatorProfileId = { in: followedCreatorIds };
  }

  const [followedCollabs, interestNews, suggestedCreators] = await Promise.all([
    prisma.collaborationClaim.findMany({
      where: collabsWhere,
      take: 10,
      orderBy: { claimDate: 'desc' },
      include: {
        creatorProfile: true,
        brandProfile: true,
        evidenceLinks: {
          include: {
            sourceItem: {
              include: { source: true },
            },
          },
        },
      },
    }),
    prisma.sourceItem.findMany({
      where: {
        processingState: 'APPROVED',
        ...(expandedTags.length > 0 ? { category: { hasSome: expandedTags } } : {}),
      },
      take: 10,
      orderBy: { publishedAt: 'desc' },
      include: {
        source: {
          select: { name: true, attributionName: true, attributionUrl: true },
        },
      },
    }),
    prisma.creatorProfile.findMany({
      where: followedCreatorIds.length > 0 ? { id: { notIn: followedCreatorIds } } : undefined,
      take: 4,
      orderBy: { isVerified: 'desc' },
      include: {
        claims: {
          take: 1,
          include: { brandProfile: true },
        },
      },
    }),
  ]);

  res.status(200).json({
    success: true,
    data: {
      isPersonalized: true,
      followedCreators: userFollows.map((f) => ({
        ...f.creatorProfile,
        followedAt: f.followedAt,
      })),
      recentCollabs: followedCollabs,
      interestStories: interestNews,
      suggestedCreators,
      stats: {
        followedCount: followedCreatorIds.length,
        interestCount: interestCategories.length,
      },
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'req-unknown',
    },
  });
}
