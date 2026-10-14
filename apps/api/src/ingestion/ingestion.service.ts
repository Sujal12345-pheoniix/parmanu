import { prisma } from '../prisma/client';
import { RssSourceConnector } from '../connectors/rss.connector';
import { calculateDedupeHash, ConnectorError } from '../connectors/base.connector';
import { NewsSource } from '@prisma/client';

export class IngestionService {
  private rssConnector = new RssSourceConnector();

  /**
   * Runs ingestion for a single news source
   */
  public async ingestSource(source: NewsSource): Promise<{
    success: boolean;
    itemsFound: number;
    itemsNew: number;
    itemsDuplicate: number;
    errorSummary?: string;
  }> {
    const startedAt = new Date();

    // Create an ingestion job record
    const job = await prisma.ingestionJob.create({
      data: {
        sourceId: source.id,
        jobType: source.type === 'RSS' || source.type === 'ATOM' || source.type === 'GOVERNMENT_FEED' ? 'RSS_POLL' : 'API_POLL',
        status: 'RUNNING',
        scheduledAt: startedAt,
        startedAt,
      },
    });

    let itemsFound = 0;
    let itemsNew = 0;
    let itemsDuplicate = 0;
    let errorSummary: string | undefined;
    let httpStatus: number | undefined;

    try {
      if (source.type === 'RSS' || source.type === 'ATOM' || source.type === 'GOVERNMENT_FEED') {
        const fetchResult = await this.rssConnector.fetch({
          id: source.id,
          feedUrl: source.feedUrl,
          category: source.category,
          language: source.language,
          type: source.type,
        });

        itemsFound = fetchResult.items.length;

        for (const item of fetchResult.items) {
          const dedupeHash = calculateDedupeHash(item.sourceId, item.headline);
          const retainUntil = new Date(Date.now() + (item.retentionDays || 90) * 24 * 60 * 60 * 1000);

          try {
            await prisma.sourceItem.upsert({
              where: { dedupeHash },
              update: {
                lastCheckedAt: new Date(),
              },
              create: {
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
                processingState: 'APPROVED', // Automatically approve verified RSS feeds for Phase 1 MVP feed visibility
                provenanceState: item.provenanceState as any,
                rightsStatus: item.rightsStatus as any,
                retentionDays: item.retentionDays,
                retainUntil,
                dedupeHash,
              },
            });
            itemsNew++;
          } catch (dbErr: any) {
            // Unique constraint violation means duplicate item
            if (dbErr.code === 'P2002') {
              itemsDuplicate++;
            } else {
              console.error(`Error saving source item ${item.canonicalUrl}:`, dbErr.message);
            }
          }
        }

        // Record successful attempt
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

        // Update source health state
        await prisma.newsSource.update({
          where: { id: source.id },
          data: {
            lastPolledAt: new Date(),
            lastSuccessAt: new Date(),
            failureCount: 0,
          },
        });

        // Mark job as completed
        await prisma.ingestionJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            itemsFound,
            itemsNew,
          },
        });

        return {
          success: true,
          itemsFound,
          itemsNew,
          itemsDuplicate,
        };
      } else {
        throw new Error(`Unsupported source type: ${source.type}`);
      }
    } catch (err: any) {
      errorSummary = err.message || 'Unknown ingestion error';
      if (err instanceof ConnectorError && err.httpStatus) {
        httpStatus = err.httpStatus;
      }

      console.error(`[INGESTION_ERROR] Source "${source.name}" (${source.id}):`, errorSummary);

      // Record failed attempt
      await prisma.ingestionAttempt.create({
        data: {
          ingestionJobId: job.id,
          attemptNumber: 1,
          startedAt,
          completedAt: new Date(),
          success: false,
          errorCode: err instanceof ConnectorError ? err.failureType : 'INGESTION_FAILED',
          errorMessage: errorSummary,
          httpStatus,
          responseTimeMs: Date.now() - startedAt.getTime(),
        },
      });

      // Increment failure count
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
          errorSummary,
        },
      });

      return {
        success: false,
        itemsFound: 0,
        itemsNew: 0,
        itemsDuplicate: 0,
        errorSummary,
      };
    }
  }

  /**
   * Ingests all active news sources
   */
  public async ingestAllActiveSources(): Promise<Array<{ sourceId: string; name: string; result: any }>> {
    const activeSources = await prisma.newsSource.findMany({
      where: { isActive: true },
    });

    const results = [];
    for (const source of activeSources) {
      const res = await this.ingestSource(source);
      results.push({
        sourceId: source.id,
        name: source.name,
        result: res,
      });
    }

    return results;
  }
}
