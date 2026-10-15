import { Response } from 'express';
import { prisma } from '../prisma/client';
import { AuthenticatedRequest } from '../security/auth';
import { logAuditEvent } from '../audit/audit.service';
import {
  CreateEntityRegistrySchema,
  CreateEntityRelationshipSchema,
} from '@parmanu/types';
import { defaultEntityResolutionService } from '../intelligence/entity-resolution.service';
import { defaultSearchService } from '../intelligence/search.service';

export async function listEntities(req: AuthenticatedRequest, res: Response): Promise<void> {
  const search = req.query.search as string | undefined;
  const limit = Math.min(100, parseInt(String(req.query.limit || 20), 10));

  const entities = await defaultSearchService.searchEntities(search || '', limit);

  res.status(200).json({
    success: true,
    data: entities,
    meta: {
      total: entities.length,
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'req-unknown',
    },
  });
}

export async function getEntityById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  const entity = await prisma.entityRegistry.findUnique({
    where: { id },
    include: {
      storyLinks: {
        include: {
          storyCluster: {
            select: {
              id: true,
              primaryHeadline: true,
              clusterSlug: true,
              status: true,
              lastObservedAt: true,
            },
          },
        },
      },
      outgoingRelations: {
        include: {
          targetEntity: true,
        },
      },
      incomingRelations: {
        include: {
          sourceEntity: true,
        },
      },
    },
  });

  if (!entity) {
    res.status(404).json({
      success: false,
      error: 'Entity not found',
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: entity,
    meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
  });
}

export async function createEntity(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parseResult = CreateEntityRegistrySchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  try {
    const entity = await defaultEntityResolutionService.registerEntity(parseResult.data);

    await logAuditEvent({
      action: 'REGISTER_ENTITY',
      entityType: 'EntityRegistry',
      entityId: entity.id,
      after: entity,
      req,
    });

    res.status(201).json({
      success: true,
      data: entity,
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

export async function createRelationship(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parseResult = CreateEntityRelationshipSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: parseResult.error.errors,
      meta: { timestamp: new Date().toISOString(), requestId: req.requestId || 'req-unknown' },
    });
    return;
  }

  try {
    const rel = await defaultEntityResolutionService.createRelationship({
      ...parseResult.data,
      reviewedBy: req.user?.id,
    });

    await logAuditEvent({
      action: 'CREATE_ENTITY_RELATIONSHIP',
      entityType: 'EntityRelationship',
      entityId: rel.id,
      after: rel,
      req,
    });

    res.status(201).json({
      success: true,
      data: rel,
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
