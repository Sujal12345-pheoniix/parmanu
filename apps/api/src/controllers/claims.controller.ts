import { Response } from 'express';
import { prisma } from '../prisma/client';
import { AuthenticatedRequest } from '../security/auth';
import { logAuditEvent } from '../audit/audit.service';
import { defaultEvidenceVerificationService } from '../intelligence/evidence.service';
import { ReviewClaimSchema, ClaimVerificationStatusSchema } from '@parmanu/types';

export async function createStoryClaim(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id: storyClusterId } = req.params;
  const { claimText, claimType, initialEvidenceSourceItemId, sourceIndependence } = req.body;

  if (!claimText || claimText.trim().length < 5) {
    res.status(400).json({
      success: false,
      error: 'claimText must be at least 5 characters',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  try {
    const claim = await defaultEvidenceVerificationService.createClaim({
      storyClusterId,
      claimText,
      claimType,
      initialEvidenceSourceItemId,
      sourceIndependence,
    });

    await logAuditEvent({
      action: 'CREATE_STORY_CLAIM',
      entityType: 'StoryClaim',
      entityId: claim.id,
      after: claim,
      req,
    });

    res.status(201).json({
      success: true,
      data: claim,
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

export async function attachEvidenceToClaim(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id: claimId } = req.params;
  const { sourceItemId, stance, quoteExcerpt, sourceIndependence, notes } = req.body;

  if (!sourceItemId) {
    res.status(400).json({
      success: false,
      error: 'sourceItemId is required',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  try {
    const result = await defaultEvidenceVerificationService.attachEvidence({
      claimId,
      sourceItemId,
      stance,
      quoteExcerpt,
      sourceIndependence,
      notes,
      reviewerUserId: req.user?.id,
    });

    await logAuditEvent({
      action: 'ATTACH_CLAIM_EVIDENCE',
      entityType: 'ClaimEvidence',
      entityId: result.evidence.id,
      after: result,
      req,
    });

    res.status(201).json({
      success: true,
      data: result,
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

export async function reviewStoryClaim(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id: claimId } = req.params;

  const parseResult = ReviewClaimSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { verificationStatus, notes } = parseResult.data;

  try {
    const updated = await defaultEvidenceVerificationService.reviewClaim(
      claimId,
      verificationStatus,
      req.user?.id || 'admin',
      notes
    );

    await logAuditEvent({
      action: 'REVIEW_STORY_CLAIM',
      entityType: 'StoryClaim',
      entityId: claimId,
      after: updated,
      reason: notes,
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

export async function listStoryClaims(req: AuthenticatedRequest, res: Response): Promise<void> {
  const clusterId = req.query.clusterId as string | undefined;
  const status = req.query.status as any;

  const where: any = {};
  if (clusterId) where.storyClusterId = clusterId;
  if (status && ClaimVerificationStatusSchema.safeParse(status).success) {
    where.verificationStatus = status;
  }

  const claims = await prisma.storyClaim.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      storyCluster: {
        select: {
          id: true,
          primaryHeadline: true,
          clusterSlug: true,
        },
      },
      evidenceRecords: {
        include: {
          sourceItem: {
            select: {
              id: true,
              headline: true,
              canonicalUrl: true,
              provenanceState: true,
              source: { select: { id: true, name: true, type: true } },
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
