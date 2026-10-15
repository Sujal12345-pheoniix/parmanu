import { prisma } from '../prisma/client';
import {
  ClaimVerificationStatus,
  EvidenceStance,
  SourceIndependence,
  StoryClaimType,
} from '@parmanu/types';

export class EvidenceVerificationService {
  /**
   * Evaluates the verification state of a claim based on its attached evidence records
   */
  public calculateClaimStatus(evidenceRecords: Array<{
    stance: EvidenceStance;
    sourceIndependence: SourceIndependence;
    sourceItem: {
      provenanceState: string;
      source: { type: string };
    };
  }>): ClaimVerificationStatus {
    if (!evidenceRecords || evidenceRecords.length === 0) {
      return 'UNASSESSED';
    }

    // Check for explicit contradiction
    const hasContradiction = evidenceRecords.some((e) => e.stance === 'CONTRADICTS');
    if (hasContradiction) {
      return 'DISPUTED';
    }

    // Check for official government feed or direct creator confirmation
    const hasOfficialConfirmation = evidenceRecords.some(
      (e) =>
        e.stance === 'SUPPORTS' &&
        (e.sourceItem.provenanceState === 'OFFICIAL_CONFIRMED' ||
          e.sourceItem.source.type === 'GOVERNMENT_FEED' ||
          e.sourceItem.source.type === 'INSTAGRAM_API')
    );

    if (hasOfficialConfirmation) {
      return 'OFFICIALLY_CONFIRMED';
    }

    // Filter supporting evidence
    const supporting = evidenceRecords.filter((e) => e.stance === 'SUPPORTS');

    // Rule: Multiple websites repeating the same syndicated report DO NOT count as independent corroboration
    const independentSources = supporting.filter(
      (e) => e.sourceIndependence === 'INDEPENDENT'
    );

    if (independentSources.length >= 2) {
      return 'MULTIPLE_SOURCES';
    }

    if (supporting.length >= 1) {
      return 'SINGLE_SOURCE';
    }

    return 'UNASSESSED';
  }

  /**
   * Adds an evidence link to a claim and recalculates claim verification status
   */
  public async attachEvidence(params: {
    claimId: string;
    sourceItemId: string;
    stance?: EvidenceStance;
    quoteExcerpt?: string;
    sourceIndependence?: SourceIndependence;
    notes?: string;
    reviewerUserId?: string;
    processingVersion?: string;
  }): Promise<any> {
    const {
      claimId,
      sourceItemId,
      stance = 'SUPPORTS',
      quoteExcerpt,
      sourceIndependence = 'INDEPENDENT',
      notes,
      reviewerUserId,
      processingVersion = 'v2.2.0-deterministic',
    } = params;

    const [claim, sourceItem] = await Promise.all([
      prisma.storyClaim.findUnique({ where: { id: claimId } }),
      prisma.sourceItem.findUnique({
        where: { id: sourceItemId },
        include: { source: true },
      }),
    ]);

    if (!claim || !sourceItem) {
      throw new Error('Claim or SourceItem not found');
    }

    // Create evidence record
    const evidence = await prisma.claimEvidence.create({
      data: {
        claimId,
        sourceItemId,
        stance,
        quoteExcerpt: quoteExcerpt?.slice(0, 800),
        sourceIndependence,
        processingVersion,
        reviewedBy: reviewerUserId,
        reviewedAt: reviewerUserId ? new Date() : undefined,
        notes,
      },
    });

    // Query all evidence for this claim to re-evaluate status
    const allEvidence = await prisma.claimEvidence.findMany({
      where: { claimId },
      include: {
        sourceItem: {
          include: { source: true },
        },
      },
    });

    const newStatus = this.calculateClaimStatus(
      allEvidence.map((e) => ({
        stance: e.stance as EvidenceStance,
        sourceIndependence: e.sourceIndependence as SourceIndependence,
        sourceItem: {
          provenanceState: e.sourceItem.provenanceState,
          source: { type: e.sourceItem.source.type },
        },
      }))
    );

    await prisma.storyClaim.update({
      where: { id: claimId },
      data: {
        verificationStatus: newStatus,
        resolvedAt: newStatus === 'OFFICIALLY_CONFIRMED' || newStatus === 'MULTIPLE_SOURCES' ? new Date() : undefined,
      },
    });

    // If claim is disputed, propagate to StoryCluster
    if (newStatus === 'DISPUTED') {
      await prisma.storyCluster.update({
        where: { id: claim.storyClusterId },
        data: { status: 'DISPUTED' },
      });
    }

    return {
      evidence,
      updatedClaimStatus: newStatus,
    };
  }

  /**
   * Editorial human review of a claim with notes and reason
   */
  public async reviewClaim(
    claimId: string,
    status: ClaimVerificationStatus,
    reviewerId: string,
    notes: string
  ): Promise<any> {
    const claim = await prisma.storyClaim.findUnique({ where: { id: claimId } });
    if (!claim) {
      throw new Error(`Claim ${claimId} not found`);
    }

    return await prisma.storyClaim.update({
      where: { id: claimId },
      data: {
        verificationStatus: status,
        reviewedBy: reviewerId,
        reviewNotes: notes,
        resolvedAt: new Date(),
      },
    });
  }

  /**
   * Creates a new claim on a story cluster
   */
  public async createClaim(params: {
    storyClusterId: string;
    claimText: string;
    claimType?: StoryClaimType;
    initialEvidenceSourceItemId?: string;
    sourceIndependence?: SourceIndependence;
  }): Promise<any> {
    const {
      storyClusterId,
      claimText,
      claimType = 'FACTUAL_EVENT',
      initialEvidenceSourceItemId,
      sourceIndependence = 'INDEPENDENT',
    } = params;

    const cluster = await prisma.storyCluster.findUnique({ where: { id: storyClusterId } });
    if (!cluster) {
      throw new Error(`StoryCluster ${storyClusterId} not found`);
    }

    const claim = await prisma.storyClaim.create({
      data: {
        storyClusterId,
        claimText: claimText.trim(),
        claimType,
        verificationStatus: initialEvidenceSourceItemId ? 'SINGLE_SOURCE' : 'UNASSESSED',
        confidenceScore: 0.6,
      },
    });

    if (initialEvidenceSourceItemId) {
      await this.attachEvidence({
        claimId: claim.id,
        sourceItemId: initialEvidenceSourceItemId,
        stance: 'SUPPORTS',
        sourceIndependence,
      });
    }

    return claim;
  }
}

export const defaultEvidenceVerificationService = new EvidenceVerificationService();
