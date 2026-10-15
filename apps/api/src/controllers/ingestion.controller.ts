import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma/client';
import { defaultIngestionService } from '../ingestion/ingestion.service';
import { AuthenticatedRequest } from '../security/auth';
import { logAuditEvent } from '../audit/audit.service';

const TriggerIngestionSchema = z.object({
  sourceId: z.string().uuid().optional(),
});

export async function triggerIngestion(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parseResult = TriggerIngestionSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Invalid request body',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const { sourceId } = parseResult.data;

  let results: any;

  if (sourceId) {
    const source = await prisma.newsSource.findUnique({
      where: { id: sourceId },
    });

    if (!source) {
      res.status(404).json({
        success: false,
        error: 'News source not found',
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
      });
      return;
    }

    const result = await defaultIngestionService.ingestSource(source);
    results = [result];
  } else {
    results = await defaultIngestionService.ingestAllActiveSources();
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
  const page = Math.max(1, parseInt(String(req.query.page || 1), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || 50), 10)));
  const skip = (page - 1) * limit;

  const [jobs, total] = await Promise.all([
    prisma.ingestionJob.findMany({
      orderBy: { scheduledAt: 'desc' },
      skip,
      take: limit,
      include: {
        source: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        attempts: {
          orderBy: { attemptNumber: 'asc' },
        },
      },
    }),
    prisma.ingestionJob.count(),
  ]);

  res.status(200).json({
    success: true,
    data: jobs,
    meta: {
      page,
      limit,
      total,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'req-unknown',
    },
  });
}

export async function getJobById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const job = await prisma.ingestionJob.findUnique({
    where: { id },
    include: {
      source: {
        select: {
          id: true,
          name: true,
          type: true,
          feedUrl: true,
          isActive: true,
        },
      },
      attempts: {
        orderBy: { attemptNumber: 'asc' },
      },
    },
  });

  if (!job) {
    res.status(404).json({
      success: false,
      error: 'Ingestion job not found',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: job,
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
  });
}

export async function retryJob(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const job = await prisma.ingestionJob.findUnique({
    where: { id },
    include: { source: true },
  });

  if (!job) {
    res.status(404).json({
      success: false,
      error: 'Ingestion job not found',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  if (job.status !== 'FAILED') {
    res.status(400).json({
      success: false,
      error: `Cannot retry job with status ${job.status}. Only FAILED jobs are eligible for retry.`,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const result = await defaultIngestionService.ingestSource(job.source);

  await logAuditEvent({
    action: 'RETRY_INGESTION_JOB',
    entityType: 'IngestionJob',
    entityId: id,
    before: { originalJobId: id, sourceId: job.sourceId },
    after: result,
    req,
  });

  res.status(200).json({
    success: true,
    data: result,
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
  });
}
