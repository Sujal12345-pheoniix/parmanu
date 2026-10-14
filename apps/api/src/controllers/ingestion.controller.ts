import { Response } from 'express';
import { prisma } from '../prisma/client';
import { IngestionService } from '../ingestion/ingestion.service';
import { AuthenticatedRequest } from '../security/auth';
import { logAuditEvent } from '../audit/audit.service';

const ingestionService = new IngestionService();

export async function triggerIngestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { sourceId } = req.body;

  let results: any;

  if (sourceId) {
    const source = await prisma.newsSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      res.status(404).json({ success: false, error: 'News source not found' });
      return;
    }

    const result = await ingestionService.ingestSource(source);
    results = [{ sourceId: source.id, name: source.name, result }];
  } else {
    results = await ingestionService.ingestAllActiveSources();
  }

  await logAuditEvent({
    action: 'TRIGGER_INGESTION',
    entityType: 'IngestionJob',
    entityId: sourceId || 'ALL',
    after: results,
    req,
  });

  res.status(200).json({
    success: true,
    data: results,
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
  });
}

export async function listIngestionJobs(req: AuthenticatedRequest, res: Response): Promise<void> {
  const jobs = await prisma.ingestionJob.findMany({
    orderBy: { scheduledAt: 'desc' },
    take: 50,
    include: {
      source: {
        select: {
          id: true,
          name: true,
          type: true,
        },
      },
      attempts: true,
    },
  });

  res.status(200).json({
    success: true,
    data: jobs,
    meta: {
      total: jobs.length,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'req-unknown',
    },
  });
}
