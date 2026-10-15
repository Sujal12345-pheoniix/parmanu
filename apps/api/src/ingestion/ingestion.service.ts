import { prisma } from '../prisma/client';
import {
  IngestionRunSummary,
  JobType,
  SourceAdapterConfig,
  SourceType,
} from '@parmanu/types';
import {
  calculateDedupeHash,
  ConnectorError,
  ConnectorFailureType,
} from '../connectors/base.connector';
import { defaultAdapterRegistry, AdapterRegistry } from './adapter.registry';
import { defaultStoryClusteringService } from '../intelligence/story-clustering.service';

type NewsSourceRecord = Awaited<ReturnType<typeof prisma.newsSource.findFirst>>;

/**
 * Strips sensitive credentials (tokens, secrets, keys) from error messages before storing/logging
 */
export function sanitizeErrorMessage(message: string): string {
  if (!message) return 'Unknown error';
  return message
    .replace(/(api[_-]?key[=:\s]+)([\w-]+)/gi, '$1[REDACTED]')
    .replace(/(access[_-]?token[=:\s]+)([\w.-]+)/gi, '$1[REDACTED]')
    .replace(/(secret[=:\s]+)([\w-]+)/gi, '$1[REDACTED]')
    .replace(/(password[=:\s]+)([\w!@#$%^&*()]+)/gi, '$1[REDACTED]')
    .replace(/(bearer\s+)([\w.-]+)/gi, '$1[REDACTED]');
}

export class IngestionService {
  private activeLocks = new Set<string>();

  constructor(private adapterRegistry: AdapterRegistry = defaultAdapterRegistry) {}

  /**
   * Maps source type to database JobType enum
   */
  public resolveJobType(type: SourceType): JobType {
    switch (type) {
      case 'RSS':
      case 'ATOM':
      case 'GOVERNMENT_FEED':
        return 'RSS_POLL';
      case 'INSTAGRAM_API':
        return 'INSTAGRAM_SYNC';
      case 'API_GNEWS':
      case 'API_GUARDIAN':
      case 'API_NEWSDATA':
      case 'MANUAL_PR':
      default:
        return 'API_POLL';
    }
  }

  /**
   * Executes idempotent ingestion for a single news source
   */
  public async ingestSource(source: NonNullable<NewsSourceRecord>): Promise<IngestionRunSummary> {
    const startedAt = new Date();

    // 1. Check if source is active
    if (!source.isActive) {
      return {
        sourceId: source.id,
        sourceName: source.name,
        sourceType: source.type as SourceType,
        jobId: 'SKIPPED_DISABLED',
        success: false,
        itemsDiscovered: 0,
        itemsInserted: 0,
        itemsUpdated: 0,
        itemsSkipped: 0,
        itemsRejected: 0,
        durationMs: 0,
        errorCategory: ConnectorFailureType.SOURCE_DISABLED,
        errorMessage: `Source "${source.name}" is disabled`,
      };
    }

    // 2. Concurrency Lock check: Prevent overlapping runs for the same source
    if (this.activeLocks.has(source.id)) {
      return {
        sourceId: source.id,
        sourceName: source.name,
        sourceType: source.type as SourceType,
        jobId: 'SKIPPED_CONCURRENT_RUN',
        success: false,
        itemsDiscovered: 0,
        itemsInserted: 0,
        itemsUpdated: 0,
        itemsSkipped: 0,
        itemsRejected: 0,
        durationMs: 0,
        errorCategory: ConnectorFailureType.RATE_LIMITED,
        errorMessage: `Ingestion job already running for source "${source.name}"`,
      };
    }

    this.activeLocks.add(source.id);

    // 3. Create persistent IngestionJob record
    const jobType = this.resolveJobType(source.type as SourceType);
    let job: any;
    try {
      job = await prisma.ingestionJob.create({
        data: {
          sourceId: source.id,
          jobType,
          status: 'RUNNING',
          scheduledAt: startedAt,
          startedAt,
        },
      });
    } catch (dbErr: any) {
      this.activeLocks.delete(source.id);
      throw new Error(`Failed to initialize ingestion job in database: ${dbErr.message}`);
    }

    let itemsDiscovered = 0;
    let itemsInserted = 0;
    let itemsUpdated = 0;
    let itemsSkipped = 0;
    let itemsRejected = 0;
    let errorCategory: string | undefined;
    let errorMessage: string | undefined;
    let retryAfterSeconds: number | undefined;

    try {
      // 4. Resolve connector adapter from registry
      const adapter = this.adapterRegistry.getAdapter(source.type as SourceType);

      const adapterConfig: SourceAdapterConfig = {
        id: source.id,
        name: source.name,
        type: source.type as SourceType,
        feedUrl: source.feedUrl,
        apiProvider: source.apiProvider,
        apiConfig: (source.apiConfig as Record<string, any>) || null,
        category: source.category,
        language: source.language,
        country: source.country,
        attributionName: source.attributionName,
        attributionUrl: source.attributionUrl,
        isActive: source.isActive,
        pollingIntervalMinutes: source.pollingIntervalMinutes,
        maxItemsPerPoll: 50,
        timeoutMs: 12000,
        permissionClassification: 'PUBLIC_SYNDICATION',
      };

      // 5. Fetch and normalize records via connector
      const fetchResult = await adapter.fetch(adapterConfig);
      itemsDiscovered = fetchResult.rawCount;

      // 6. Idempotent persistence with dedupe check
      for (const item of fetchResult.items) {
        const dedupeHash = calculateDedupeHash(item.sourceId, item.headline);
        const retainUntil = new Date(Date.now() + (item.retentionDays || 90) * 24 * 60 * 60 * 1000);

        try {
          const existing = await prisma.sourceItem.findUnique({
            where: { dedupeHash },
            select: { id: true },
          });

          if (existing) {
            // Item already known: update observation timestamp
            await prisma.sourceItem.update({
              where: { id: existing.id },
              data: {
                lastCheckedAt: new Date(),
              },
            });
            itemsUpdated++;
            // New item: create record
            const createdItem = await prisma.sourceItem.create({
              data: {
                sourceId: item.sourceId,
                externalId: item.externalId,
                canonicalUrl: item.canonicalUrl,
                headline: item.headline,
                excerpt: item.excerpt,
                author: item.author,
                publishedAt: item.publishedAt,
                contentType: item.contentType as any,
                category: item.category,
                language: item.language,
                imageUrl: item.imageUrl,
                processingState: 'APPROVED',
                provenanceState: item.provenanceState as any,
                rightsStatus: item.rightsStatus as any,
                retentionDays: item.retentionDays,
                retainUntil,
                dedupeHash,
              },
            });
            itemsInserted++;

            // Phase 2.2: Automated Story Clustering
            try {
              await defaultStoryClusteringService.clusterSourceItem(createdItem.id);
            } catch (clusterErr: any) {
              console.warn(`[STORY_CLUSTERING] Failed to cluster item ${createdItem.id}:`, clusterErr.message);
            }
          }
        } catch (dbErr: any) {
          if (dbErr.code === 'P2002') {
            // Race condition caught by DB unique constraint
            itemsUpdated++;
          } else {
            itemsRejected++;
            console.error(`[DB_INSERT_ERROR] ${item.canonicalUrl}:`, dbErr.message);
          }
        }
      }

      itemsSkipped = itemsDiscovered - (itemsInserted + itemsUpdated + itemsRejected);
      if (itemsSkipped < 0) itemsSkipped = 0;

      const durationMs = Date.now() - startedAt.getTime();

      // 7. Record successful IngestionAttempt
      await prisma.ingestionAttempt.create({
        data: {
          ingestionJobId: job.id,
          attemptNumber: 1,
          startedAt,
          completedAt: new Date(),
          success: true,
          responseTimeMs: fetchResult.responseTimeMs,
        },
      });

      // 8. Update source health and reset failure counters
      await prisma.newsSource.update({
        where: { id: source.id },
        data: {
          lastPolledAt: new Date(),
          lastSuccessAt: new Date(),
          failureCount: 0,
        },
      });

      // 9. Mark job completed
      await prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          itemsFound: itemsDiscovered,
          itemsNew: itemsInserted,
        },
      });

      return {
        sourceId: source.id,
        sourceName: source.name,
        sourceType: source.type as SourceType,
        jobId: job.id,
        success: true,
        itemsDiscovered,
        itemsInserted,
        itemsUpdated,
        itemsSkipped,
        itemsRejected,
        durationMs,
      };
    } catch (err: any) {
      const durationMs = Date.now() - startedAt.getTime();
      errorMessage = sanitizeErrorMessage(err.message || 'Unknown ingestion error');

      if (err instanceof ConnectorError) {
        errorCategory = err.failureType;
        retryAfterSeconds = err.retryAfterSeconds;
      } else {
        errorCategory = ConnectorFailureType.UNKNOWN;
      }

      console.error(
        `[INGESTION_ERROR] Source "${source.name}" (${source.id}) [${errorCategory}]:`,
        errorMessage
      );

      // Record failed IngestionAttempt
      try {
        await prisma.ingestionAttempt.create({
          data: {
            ingestionJobId: job.id,
            attemptNumber: 1,
            startedAt,
            completedAt: new Date(),
            success: false,
            errorCode: errorCategory,
            errorMessage,
            httpStatus: err instanceof ConnectorError ? err.httpStatus : undefined,
            responseTimeMs: durationMs,
          },
        });

        // Increment source failureCount
        await prisma.newsSource.update({
          where: { id: source.id },
          data: {
            lastPolledAt: new Date(),
            failureCount: { increment: 1 },
          },
        });

        // Mark job as failed
        await prisma.ingestionJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorSummary: errorMessage,
          },
        });
      } catch (logErr: any) {
        console.error('Failed to persist error state for job:', logErr.message);
      }

      return {
        sourceId: source.id,
        sourceName: source.name,
        sourceType: source.type as SourceType,
        jobId: job.id,
        success: false,
        itemsDiscovered: 0,
        itemsInserted: 0,
        itemsUpdated: 0,
        itemsSkipped: 0,
        itemsRejected: 0,
        durationMs,
        errorCategory,
        errorMessage,
        retryAfterSeconds,
      };
    } finally {
      this.activeLocks.delete(source.id);
    }
  }

  /**
   * Ingests all active news sources using bounded concurrency
   */
  public async ingestAllActiveSources(concurrencyLimit: number = 3): Promise<IngestionRunSummary[]> {
    const activeSources = await prisma.newsSource.findMany({
      where: { isActive: true },
    });

    const results: IngestionRunSummary[] = [];
    const queue = [...activeSources];

    const worker = async () => {
      while (queue.length > 0) {
        const source = queue.shift();
        if (!source) break;
        try {
          const res = await this.ingestSource(source);
          results.push(res);
        } catch (workerErr: any) {
          console.error(`Unexpected worker crash for source ${source.id}:`, workerErr);
        }
      }
    };

    const workers = Array.from(
      { length: Math.min(concurrencyLimit, activeSources.length || 1) },
      () => worker()
    );
    await Promise.all(workers);

    return results;
  }
}

export const defaultIngestionService = new IngestionService();
