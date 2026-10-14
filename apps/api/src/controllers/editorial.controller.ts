import { Response } from 'express';
import { ReviewSourceItemSchema } from '@parmanu/types';
import { prisma } from '../prisma/client';
import { AuthenticatedRequest } from '../security/auth';
import { logAuditEvent } from '../audit/audit.service';

export async function listPendingReviewItems(req: AuthenticatedRequest, res: Response): Promise<void> {
  const items = await prisma.sourceItem.findMany({
    where: {
      processingState: { in: ['PENDING', 'NORMALIZED'] },
    },
    orderBy: { publishedAt: 'desc' },
    take: 50,
    include: {
      source: {
        select: { id: true, name: true, attributionName: true },
      },
    },
  });

  res.status(200).json({
    success: true,
    data: items,
    meta: {
      total: items.length,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'req-unknown',
    },
  });
}

export async function reviewSourceItem(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const parseResult = ReviewSourceItemSchema.safeParse(req.body);

  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid review payload',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { processingState, provenanceState, reason } = parseResult.data;

  if (processingState === 'REJECTED' && (!reason || reason.trim().length === 0)) {
    res.status(400).json({
      success: false,
      error: 'A reason is required when rejecting a source item',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const existingItem = await prisma.sourceItem.findUnique({
    where: { id },
  });

  if (!existingItem) {
    res.status(404).json({ success: false, error: 'Source item not found' });
    return;
  }

  const updatedItem = await prisma.sourceItem.update({
    where: { id },
    data: {
      processingState: processingState as any,
      provenanceState: provenanceState ? (provenanceState as any) : undefined,
    },
  });

  await logAuditEvent({
    action: 'EDITORIAL_REVIEW_SOURCE_ITEM',
    entityType: 'SourceItem',
    entityId: id,
    before: { processingState: existingItem.processingState, provenanceState: existingItem.provenanceState },
    after: { processingState: updatedItem.processingState, provenanceState: updatedItem.provenanceState },
    reason,
    req,
  });

  res.status(200).json({
    success: true,
    data: updatedItem,
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
  });
}
