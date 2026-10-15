import { Response } from 'express';
import { CreateNewsSourceSchema, UpdateNewsSourceSchema, SourceHealthStatus } from '@parmanu/types';
import { prisma } from '../prisma/client';
import { AuthenticatedRequest } from '../security/auth';
import { logAuditEvent } from '../audit/audit.service';
import { validateUrlForSsrf } from '../connectors/base.connector';
import { defaultAdapterRegistry } from '../ingestion/adapter.registry';

export async function listSources(req: AuthenticatedRequest, res: Response): Promise<void> {
  const sources = await prisma.newsSource.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      feedUrl: true,
      apiProvider: true,
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
      createdAt: true,
      updatedAt: true,
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

export async function updateSource(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const parseResult = UpdateNewsSourceSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const existing = await prisma.newsSource.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({
      success: false,
      error: 'News source not found',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  const data = parseResult.data;

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
    const updated = await prisma.newsSource.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.feedUrl !== undefined && { feedUrl: data.feedUrl }),
        ...(data.apiProvider !== undefined && { apiProvider: data.apiProvider }),
        ...(data.apiConfig !== undefined && { apiConfig: data.apiConfig || undefined }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.language !== undefined && { language: data.language }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.pollingIntervalMinutes !== undefined && {
          pollingIntervalMinutes: data.pollingIntervalMinutes,
        }),
        ...(data.attributionName !== undefined && { attributionName: data.attributionName }),
        ...(data.attributionUrl !== undefined && { attributionUrl: data.attributionUrl }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    await logAuditEvent({
      action: 'UPDATE_NEWS_SOURCE',
      entityType: 'NewsSource',
      entityId: id,
      before: existing,
      after: updated,
      req,
    });

    res.status(200).json({
      success: true,
      data: updated,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to update news source',
      details: err.message,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
  }
}

export async function getSourceHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const source = await prisma.newsSource.findUnique({
    where: { id },
    include: {
      _count: {
        select: { sourceItems: true, ingestionJobs: true },
      },
      ingestionJobs: {
        orderBy: { scheduledAt: 'desc' },
        take: 5,
        include: { attempts: true },
      },
    },
  });

  if (!source) {
    res.status(404).json({
      success: false,
      error: 'News source not found',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  let healthStatus: SourceHealthStatus = 'HEALTHY';
  if (!source.isActive) {
    healthStatus = 'DISABLED';
  } else if (source.failureCount >= 5) {
    healthStatus = 'FAILING';
  } else if (source.failureCount > 0) {
    healthStatus = 'DEGRADED';
  }

  const latestJob = source.ingestionJobs[0];
  const lastErrorCategory = latestJob?.attempts?.find((a) => !a.success)?.errorCode || null;
  const lastErrorMessage = latestJob?.errorSummary || null;

  // Connector adapter probe
  let liveCheckResult = null;
  if (req.query.probe === 'true' && defaultAdapterRegistry.hasAdapter(source.type as any)) {
    try {
      const adapter = defaultAdapterRegistry.getAdapter(source.type as any);
      liveCheckResult = await adapter.healthCheck({
        id: source.id,
        name: source.name,
        type: source.type as any,
        feedUrl: source.feedUrl,
        apiProvider: source.apiProvider,
        apiConfig: source.apiConfig as any,
        category: source.category,
        language: source.language,
        country: source.country,
        attributionName: source.attributionName,
        attributionUrl: source.attributionUrl,
        isActive: source.isActive,
        pollingIntervalMinutes: source.pollingIntervalMinutes,
        maxItemsPerPoll: 10,
        timeoutMs: 6000,
        permissionClassification: 'PUBLIC_SYNDICATION',
      });
    } catch (probeErr: any) {
      liveCheckResult = { isHealthy: false, lastErrorMessage: probeErr.message };
    }
  }

  res.status(200).json({
    success: true,
    data: {
      sourceId: source.id,
      name: source.name,
      type: source.type,
      healthStatus,
      isActive: source.isActive,
      consecutiveFailures: source.failureCount,
      lastPolledAt: source.lastPolledAt,
      lastSuccessAt: source.lastSuccessAt,
      lastErrorCategory,
      lastErrorMessage,
      totalItemsCount: source._count.sourceItems,
      totalJobsCount: source._count.ingestionJobs,
      recentJobs: source.ingestionJobs,
      liveProbe: liveCheckResult,
    },
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
  });
}
