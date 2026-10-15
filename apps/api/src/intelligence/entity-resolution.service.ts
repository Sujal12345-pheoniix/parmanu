import { prisma } from '../prisma/client';
import {
  EntityRelationshipType,
  RegisteredEntityType,
  RelationshipStatus,
} from '@parmanu/types';

export class EntityResolutionService {
  /**
   * Matches text tokens against the EntityRegistry (exact match or alias match)
   */
  public async extractEntitiesFromText(text: string): Promise<Array<{
    entityId: string;
    canonicalName: string;
    entityType: RegisteredEntityType;
    matchedAlias: string;
  }>> {
    const normalizedText = text.toLowerCase();
    const allEntities = await prisma.entityRegistry.findMany();

    const matched: Array<{
      entityId: string;
      canonicalName: string;
      entityType: RegisteredEntityType;
      matchedAlias: string;
    }> = [];

    for (const entity of allEntities) {
      // Check canonical name
      const canonLower = entity.canonicalName.toLowerCase();
      const regexCanon = new RegExp(`\\b${canonLower}\\b`, 'i');
      if (regexCanon.test(normalizedText)) {
        matched.push({
          entityId: entity.id,
          canonicalName: entity.canonicalName,
          entityType: entity.entityType as RegisteredEntityType,
          matchedAlias: entity.canonicalName,
        });
        continue;
      }

      // Check aliases
      for (const alias of entity.aliases) {
        const aliasLower = alias.toLowerCase();
        const regexAlias = new RegExp(`\\b${aliasLower}\\b`, 'i');
        if (regexAlias.test(normalizedText)) {
          matched.push({
            entityId: entity.id,
            canonicalName: entity.canonicalName,
            entityType: entity.entityType as RegisteredEntityType,
            matchedAlias: alias,
          });
          break;
        }
      }
    }

    return matched;
  }

  /**
   * Links detected entities to a story cluster
   */
  public async linkEntitiesToCluster(storyClusterId: string, headlineAndExcerpt: string): Promise<number> {
    const matches = await this.extractEntitiesFromText(headlineAndExcerpt);
    let linked = 0;

    for (const match of matches) {
      try {
        await prisma.entityToStoryCluster.upsert({
          where: {
            entityId_storyClusterId: {
              entityId: match.entityId,
              storyClusterId,
            },
          },
          update: {
            prominenceScore: { increment: 0.5 },
          },
          create: {
            entityId: match.entityId,
            storyClusterId,
            prominenceScore: 1.0,
          },
        });
        linked++;
      } catch {
        // Skip duplicate or race condition
      }
    }

    return linked;
  }

  /**
   * Registers a typed relationship between two entities (e.g. Creator and Brand)
   */
  public async createRelationship(params: {
    sourceEntityId: string;
    targetEntityId: string;
    relationshipType: EntityRelationshipType;
    status?: RelationshipStatus;
    storyClusterId?: string;
    evidenceSourceItemId?: string;
    notes?: string;
    reviewedBy?: string;
  }): Promise<any> {
    const {
      sourceEntityId,
      targetEntityId,
      relationshipType,
      status = 'UNVERIFIED',
      storyClusterId,
      evidenceSourceItemId,
      notes,
      reviewedBy,
    } = params;

    if (sourceEntityId === targetEntityId) {
      throw new Error('Source and target entities cannot be the same');
    }

    // Safety check: Rumors must NEVER be created with status 'CONFIRMED'
    let resolvedStatus = status;
    if (relationshipType === 'RUMORED_RELATIONSHIP' && status === 'CONFIRMED') {
      resolvedStatus = 'PROPOSED';
    }

    return await prisma.entityRelationship.create({
      data: {
        sourceEntityId,
        targetEntityId,
        relationshipType,
        status: resolvedStatus,
        confidence: resolvedStatus === 'CONFIRMED' ? 0.95 : 0.5,
        storyClusterId,
        evidenceSourceItemId,
        notes,
        reviewedBy,
        reviewedAt: reviewedBy ? new Date() : undefined,
      },
    });
  }

  /**
   * Registers a new canonical entity in the registry
   */
  public async registerEntity(params: {
    canonicalName: string;
    slug: string;
    entityType: RegisteredEntityType;
    aliases?: string[];
    verifiedUrls?: Record<string, any>;
    isVerified?: boolean;
    creatorProfileId?: string;
    brandProfileId?: string;
  }): Promise<any> {
    return await prisma.entityRegistry.create({
      data: {
        canonicalName: params.canonicalName.trim(),
        slug: params.slug.trim().toLowerCase(),
        entityType: params.entityType,
        aliases: params.aliases || [],
        verifiedUrls: params.verifiedUrls || undefined,
        isVerified: params.isVerified || false,
        creatorProfileId: params.creatorProfileId,
        brandProfileId: params.brandProfileId,
      },
    });
  }
}

export const defaultEntityResolutionService = new EntityResolutionService();
