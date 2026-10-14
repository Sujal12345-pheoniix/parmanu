import { Response } from 'express';
import { CreateCollaborationClaimSchema } from '@parmanu/types';
import { prisma } from '../prisma/client';
import { AuthenticatedRequest } from '../security/auth';
import { logAuditEvent } from '../audit/audit.service';

export async function listCollaborationClaims(req: AuthenticatedRequest, res: Response): Promise<void> {
  const claims = await prisma.collaborationClaim.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      creatorProfile: {
        select: {
          id: true,
          displayName: true,
          instagramHandle: true,
          avatarUrl: true,
          category: true,
          isVerified: true,
        },
      },
      brandProfile: {
        select: {
          id: true,
          name: true,
          slug: true,
          sector: true,
          logoUrl: true,
        },
      },
      evidenceLinks: {
        include: {
          sourceItem: {
            select: {
              id: true,
              headline: true,
              canonicalUrl: true,
              publishedAt: true,
              source: {
                select: { name: true, attributionName: true, attributionUrl: true },
              },
            },
          },
        },
      },
    },
  });

  res.status(200).json({
    success: true,
    data: claims,
    meta: {
      total: claims.length,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'req-unknown',
    },
  });
}

export async function createCollaborationClaim(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parseResult = CreateCollaborationClaimSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { creatorProfileId, brandProfileId, campaignName, claimType, provenanceState, claimDate, evidenceSourceItemId, notes } = parseResult.data;

  const claim = await prisma.collaborationClaim.create({
    data: {
      creatorProfileId,
      brandProfileId,
      campaignName: campaignName || null,
      claimType: claimType as any,
      provenanceState: provenanceState as any,
      claimDate: claimDate || new Date(),
      reviewedBy: req.user?.id,
      reviewNote: notes || null,
    },
  });

  // If evidence source item ID provided, link it
  if (evidenceSourceItemId) {
    await prisma.evidenceLink.create({
      data: {
        collaborationClaimId: claim.id,
        sourceItemId: evidenceSourceItemId,
        relationshipType: 'PRIMARY_SOURCE',
        evidenceStatus: 'ACTIVE',
        reviewerUserId: req.user?.id,
        notes: notes || null,
      },
    });
  }

  await logAuditEvent({
    action: 'CREATE_COLLABORATION_CLAIM',
    entityType: 'CollaborationClaim',
    entityId: claim.id,
    after: claim,
    req,
  });

  res.status(201).json({
    success: true,
    data: claim,
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
  });
}
