import { Response } from 'express';
import { CreateNewsSourceSchema } from '@parmanu/types';
import { prisma } from '../prisma/client';
import { AuthenticatedRequest } from '../security/auth';
import { logAuditEvent } from '../audit/audit.service';
import { validateUrlForSsrf } from '../connectors/base.connector';

export async function listSources(req: AuthenticatedRequest, res: Response): Promise<void> {
  const sources = await prisma.newsSource.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      feedUrl: true,
      category: true,
      language: true,
      country: true,
      isActive: true,
      pollingIntervalMinutes: true,
      lastPolledAt: true,
      lastSuccessAt: true,
      failureCount: true,
      attributionName: true,
      attributionUrl: true,
      _count: {
        select: { sourceItems: true },
      },
    },
  });

  res.status(200).json({
    success: true,
    data: sources,
    meta: {
      total: sources.length,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'req-unknown',
    },
  });
}

export async function createSource(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parseResult = CreateNewsSourceSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const data = parseResult.data;

  // SSRF validation if feedUrl provided
  if (data.feedUrl) {
    try {
      validateUrlForSsrf(data.feedUrl);
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: `SSRF validation failed: ${err.message}`,
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
      });
      return;
    }
  }

  try {
    const source = await prisma.newsSource.create({
      data: {
        name: data.name,
        slug: data.slug,
        type: data.type as any,
        feedUrl: data.feedUrl || null,
        apiProvider: data.apiProvider || null,
        apiConfig: data.apiConfig || undefined,
        category: data.category,
        language: data.language,
        country: data.country,
        pollingIntervalMinutes: data.pollingIntervalMinutes,
        attributionName: data.attributionName,
        attributionUrl: data.attributionUrl,
        isActive: data.isActive,
      },
    });

    await logAuditEvent({
      action: 'CREATE_NEWS_SOURCE',
      entityType: 'NewsSource',
      entityId: source.id,
      after: source,
      req,
    });

    res.status(201).json({
      success: true,
      data: source,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: 'A news source with this slug already exists',
        meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: 'Failed to create news source',
      details: err.message,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  }
}
